const chokidar = require('chokidar');
const qnaUtils = require('./QnAUtils');
const azTableUtils = require('./AzureTableUtils');
const utils = require('./Utils');

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

        if (!timerActive) {
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

        azTableUtils.checkIfEntryExists(qna).then(
            res => {
                let kbID = res;
                qnaUtils.getQnA(kbID).then(
                    res => {
                        let qnaJSON = res;
                        var updates = utils.getDiff(JSON.parse(qnaJSON), qna);

                        qnaUtils.updateQnA(updates, kbID).then(
                            res => {
                                console.log("Updated QnA:", qna.name, "QnAs left:", qnaCollection.length);
                                pauseTimerIfQueueEmpty(qna.name);
                            },
                            err => {
                                addDocToQueue(preprocessedDoc, err);
                            }
                        );
                    },
                    err => {
                        addDocToQueue(preprocessedDoc, err);
                    }
                );
            },
            err => {
                if (err === "Entry not found.") {
                    qnaUtils.createQnA(qna).then(
                        res => {
                            //TODO: handle errors from this?
                            azTableUtils.createTableEntry(qna, res);
                            console.log("Created QnA:", qna.name, "QnAs left:", qnaCollection.length);
                            pauseTimerIfQueueEmpty();
                        },
                        err => {
                            addDocToQueue(preprocessedDoc, err);
                        }
                    );
                }
                else {
                    addDocToQueue(preprocessedDoc, err);
                }
            }
        );
    }, 8000);
}

function pauseTimerIfQueueEmpty() {
    if (qnaCollection.length === 0) {
        clearInterval(timer);
        timerActive = false;
        console.log("No more QnAs found. Pausing timer.");
    }
}

function addDocToQueue(preprocessedDoc, err) {
    qnaCollection.push(preprocessedDoc);
    console.log(err, "QnAs left:", qnaCollection.length);
}