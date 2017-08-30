var chokidar = require('chokidar');
var fs = require('fs');
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
            console.log("Starting timer.");
            startTimer();
        }
    }
}

// Try to upload QnA once every 8 seconds. If this fails, add QnA back to queue for processing later.
function startTimer() {
    timer = setInterval(function () {
        timerActive = true;

        var preprocessedDoc = qnaCollection.shift();

        var qna = fs.readFileSync (preprocessedDoc);
        var qnaForUpload = prepQnAForUpload(qna);
        console.log("Processing:", qnaForUpload.name);

        createQnA(qnaForUpload, function(response) {
            if (!response.includes('Error')) {
                createTableEntry(qna, response);
                console.log("Success:", qnaForUpload.name);

                if (qnaCollection.length === 0) {
                    clearInterval(timer);
                    timerActive = false;
                    console.log("No more QnAs found. Pausing timer.");
                }
            }
            else {
                console.log(response);
                qnaCollection.push(preprocessedDoc);
            }
        });
    }, 8000);
}

function prepQnAForUpload(preprocessedDoc){
    // Prepare QnA Maker-friendly JSON for upload
    delete preprocessedDoc.filename;
    delete preprocessedDoc.id;
    delete preprocessedDoc.source;
    delete preprocessedDoc.related;
    delete preprocessedDoc.metadata;

    return preprocessedDoc;
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
        form: qnaForUpload
    };

    // Start the request
    request(options, function (error, response, body) {

        if (!error && response.statusCode === 201) {
            callback(JSON.parse(body).kbId);
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
        DocURL: {'_': qna.source}
    };

    tableSvc.insertEntity('qnaIndex', qnaEntry, function (error, result, response) {
        if (!error) {
            count++;
            context.log("Success:", qna.name);

        } else {

            context.log("Error inserting to Azure Table:", error.message);
        }
    });
}