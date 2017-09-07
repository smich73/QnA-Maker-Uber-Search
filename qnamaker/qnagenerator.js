const chokidar = require('chokidar');
const qnaUtils = require('./QnAUtils');
const azTableUtils = require('./AzureTableUtils');

var qnaCollection = [];
var timer;
timerActive = false;

const config = {
    docFilepath: process.env.PDATA_DIR
};

var watcher = chokidar.watch(docFilepath);
watcher
    .on('add', path => process(path))
    .on('change', path => process(path));

function process(path) {
    var fileParts = path.split('.');

    if (fileParts.slice(-1)[0] === 'json') {
        console.log("New QnA found.", path);

        qnaCollection.push(path);
        if(!timerActive){
            timerActive = true;
            console.log("Starting timer.");
            startTimer();
        }
    }
}

// Try to upload QnA once every 8 seconds. If this fails, add QnA back to end of queue for processing later.
function startTimer() {
    timer = setInterval(function() {
        var preprocessedDoc = qnaCollection.shift();

        var qna = require(preprocessedDoc);
        console.log("Processing:", qna.name);

        azTableUtils.checkIfEntryExists(qna, function(kbID){
            if (kbID !== '') {
                qnaUtils.getQnA(kbID, function(response) {
                    if (response !== 'Error') {
                        var updates = getDiff(JSON.parse(response), qna);
                        qnaUtils.updateQnA(updates, kbID, function(response){
                            if (response !== 'Error') {
                                console.log("Updated QnA:", qna.name, "QnAs left:", qnaCollection.length);

                                if (qnaCollection.length === 0) {
                                    clearInterval(timer);
                                    timerActive = false;
                                    console.log("No more QnAs found. Pausing timer.");
                                }
                            }
                            else {
                                qnaCollection.push(preprocessedDoc);
                                console.log(response,"QnAs left:", qnaCollection.length);
                            }
                        });
                    }
                    else {
                        qnaCollection.push(preprocessedDoc);
                        console.log(response,"QnAs left:", qnaCollection.length);
                    }
                });
            }
            else {
                qnaUtils.createQnA(qna, function(response) {
                    if (response !== 'Error') {
                        azTableUtils.createTableEntry(qna, response);
                        console.log("Success:", qna.name, "QnAs left:", qnaCollection.length);

                        if (qnaCollection.length === 0) {
                            clearInterval(timer);
                            timerActive = false;
                            console.log("No more QnAs found. Pausing timer.");
                        }
                    }
                    else {
                        qnaCollection.push(preprocessedDoc);
                        console.log(response,"QnAs left:", qnaCollection.length);
                    }
                });
            }
        });
    }, 8000);
}

function getDiff(existingQnA, newQnA) {

    if (newQnA.qnaList.length > 0) {
        // Compare QnAs and create update JSON for POST to QnA Maker API
        var diff = require('deep-diff').diff;

        // Add 'Editorial' QnA created by the QnA Maker service to ensure parity
        if (newQnA.qnaList[0].source !== "Editorial") {
            newQnA.qnaList.unshift({
                "qnaId": 1,
                "answer": "Hello",
                "source": "Editorial",
                "questions": ["Hi"],
                "metadata": []
            });
        }

        var differences = diff(existingQnA, newQnA);

        // Schema from https://westus.dev.cognitive.microsoft.com/docs/services/597029932bcd590e74b648fb/operations/5970428523618c05e45ab128
        var patch = {
            "add": {
                "qnaList": [],
                "urls": [],
                "users": []
            },
            "delete": {
                "qnaIds": [],
                "sources": [],
                "users": []
            },
            "update": {
                "name": newQnA.name,
                "qnaList": [],
                "urls": []
            }
        };
        var blankPatch = JSON.stringify(patch);

        for (var i = 0; i < differences.length; i++) {
            var change = differences[i];
            // Add new question
            if (change.kind === "A" && change.item.kind === "N" && change.path[0] === "qnaList" && change.path.length === 1) {
                patch.add.qnaList.push(change.item.rhs);
            }
            // Delete question
            if (change.kind === "A" && change.item.kind === "D" && change.path[0] === "qnaList" && change.path.length === 1) {
                patch.delete.qnaIds.push(change.item.lhs.qnaId);
            }
            // Modify existing questions in a QnA set
            if (change.kind === "A" && change.item.kind === "E" && change.path[0] === "qnaList" && change.path[2] === "questions") {
                patch.update.qnaList.push({
                    "qnaId": newQnA.qnaId,
                    "answer": newQnA.answer,
                    "source": newQnA.source,
                    "questions": {
                        "add": change.item.rhs,
                        "delete": change.item.lhs
                    },
                    "metadata": {}
                });
            }
            // Modify existing metadata in a QnA set
            if (change.kind === "A" && change.item.kind === "E" && change.path[0] === "qnaList" && change.path[2] === "metadata") {
                patch.update.qnaList.push({
                    "qnaId": newQnA.qnaId,
                    "answer": newQnA.answer,
                    "source": newQnA.source,
                    "questions": {},
                    "metadata": {
                        "add": change.item.rhs,
                        "delete": change.item.lhs
                    }
                });
            }
        }
        if (JSON.stringify(patch) === blankPatch) {
            return "No change";
        }
        else {
            return patch;
        }
    }
    else {
        console.log("QnA has no data. Deleting KB.");
        qnaUtils.deleteQnA(newQnA);
    }
}