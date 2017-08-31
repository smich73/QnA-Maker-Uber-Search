var chokidar = require('chokidar');
var qnaCollection = [];
var timer;
timerActive = false;

var filepath = os.environ["PDATA_DIR"];
var subKey = '';
var qnaURL = '';
var tableConnStr = '';

var watcher = chokidar.watch(filepath);
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

        checkIfExists(qna, function(kbID){
            if (kbID !== '') {
                getQnA(kbID, function(response) {
                    if (response !== 'Error') {
                        var updates = getDiff(JSON.parse(response), qna);
                        updateQnA(updates, kbID, function(response){
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
                createQnA(qna, function(response) {
                    if (response !== 'Error') {
                        createTableEntry(qna, response);
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

function checkIfExists(qna, callback) {
    var azure = require('azure-storage');

    var kbID = '';

    var query = new azure.TableQuery()
    .top(1)
    .where('PartitionKey eq ?', 'Conditions').and('RowKey eq ?', qna.id);

    var retryOperations = new azure.ExponentialRetryPolicyFilter();
    var tableSvc = azure.createTableService(tableConnStr).withFilter(retryOperations);

    tableSvc.queryEntities('newQnAIndex', query, null, function(error, result, response) {
        if(!error) {
          if (result.entries.length > 0) {
              kbID = result.entries[0].KBID._;
          }
        }
        else {
            console.log("Error:", error.message);
        }
        callback(kbID);
    });
}

function getDiff(existingQnA, newQnA) {

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

function createQnA(qnaForUpload, callback) {

    var request = require('request');

    // Set the headers
    var headers = {
        'Ocp-Apim-Subscription-Key': subKey,
        'Content-Type': 'application/json'
    };

    // Configure the request
    var options = {
        url: qnaURL + 'create',
        method: 'POST',
        headers: headers,
        json: qnaForUpload
    };

    // Start the request
    request(options, function (error, response, body) {

        if (!error && response.statusCode === 201) {
            callback(body.kbId);
        } else {
            console.log("Error:", body, "Status code:", response.statusCode);
            callback("Error");
        }
    });
}

function getQnA(kbID, callback) {
    var request = require('request');

    // Set the headers
    var headers = {
        'Ocp-Apim-Subscription-Key': subKey,
        'Content-Type': 'application/json'
    };

    // Configure the request
    var options = {
        url: qnaURL + kbID,
        method: 'GET',
        headers: headers
    };

    // Start the request
    request(options, function (error, response, body) {

        if (!error && response.statusCode === 200) {
            callback(body);
        } else {
            console.log("Error:", body, "Status code:", response.statusCode);
            callback("Error");
        }
    });
}

function updateQnA(patch, kbID, callback) {
    if (patch === 'No change') {
        console.log("No change detected. QnAs left:", qnaCollection.length);
        return;
    }
    var request = require('request');

    // Set the headers
    var headers = {
        'Ocp-Apim-Subscription-Key': subKey,
        'Content-Type': 'application/json'
    };

    // Configure the request
    var options = {
        url: qnaURL + kbID,
        method: 'PATCH',
        headers: headers,
        json: patch
    };

    // Start the request
    request(options, function (error, response, body) {

        if (!error && response.statusCode === 204) {
            callback(body);
        } else {
            console.log("Error:", body, "Status code:", response.statusCode);
            callback("Error");
        }
    });
}

function createTableEntry(qna, kbID) {

    var azure = require('azure-storage');

    var retryOperations = new azure.ExponentialRetryPolicyFilter();
    var tableSvc = azure.createTableService(tableConnStr).withFilter(retryOperations);

    var qnaEntry = {
        PartitionKey: {'_': 'Conditions'},
        RowKey: {'_': qna.id},
        Condition: {'_': qna.name},
        KBID: {'_': kbID},
        DocURL: {'_': qna.source}
    };

    tableSvc.insertEntity('newQnAIndex', qnaEntry, function (error, result, response) {
        if (error) {
            console.log("Error inserting to Azure Table:", error.message);
        }
    });
}