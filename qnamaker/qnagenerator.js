var chokidar = require('chokidar');
var qnaCollection = [];
var timer;
timerActive = false;

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
    timer = setInterval(function () {
        var preprocessedDoc = qnaCollection.shift();

        var qna = require(preprocessedDoc);
        var qnaSource = qna.source;
        qna = prepQnAForUpload(qna);
        console.log("Processing:", qna.name);

        createQnA(qna, function(response) {
            if (!response.includes('Error')) {
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
    }, 8000);
}

function prepQnAForUpload(qna){
    // Prepare QnA Maker-friendly JSON for upload
    delete qna.filename;
    delete qna.id;
    delete qna.source;
    delete qna.related;
    delete qna.metadata;

    return qna;
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
        url: qnaURL,
        method: 'POST',
        headers: headers,
        json: qnaForUpload
    };

    // Start the request
    request(options, function (error, response, body) {

        if (!error && response.statusCode === 201) {
            callback(body.kbId);
        } else {
            callback("Error: " + JSON.parse(body).message + " Status code: " + response.statusCode);
        }
    });
}

function createTableEntry(qna, kbID) {

    var azure = require('azure-storage');

    var retryOperations = new azure.ExponentialRetryPolicyFilter();
    var tableSvc = azure.createTableService(tableConnStr).withFilter(retryOperations);

    var qnaEntry = {
        PartitionKey: {'_': 'Conditions'},
        RowKey: {'_': qna.name},
        KBID: {'_': kbID},
        DocURL: {'_': qna.qnaList[0].source}
    };

    tableSvc.insertEntity('qnaIndex', qnaEntry, function (error, result, response) {
        if (error) {
            console.log("Error inserting to Azure Table:", error.message);
        }
    });
}