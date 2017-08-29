module.exports = function (context, medicalDoc) {

    var fileName = context.bindingData.name;
    var conditionName = fileName.split(".")[0];

    var docURL = process.env['StorageURL'] + fileName;

    getTextFromURL(docURL, function(result){

        var qna = splitTSV(result);

        var questions = qna.questions;
        var answers = qna.answers;

        var keywords = getKeywords(answers, process.env['NumberOfKeywords']);
        var qnaCollection = createQnACollection(questions, answers, conditionName, docurl);

        //TODO: Check if KB already exists first
        createAndRegisterQnA(conditionName, qnaCollection, keywords);
    });
};

function createQnACollection(questions, answers, conditionName, source) {

    var qnaCollection = [];

    for (var i = 0; i < questions.length; i++) {

        getIntent(asasdad, questions[i], function (result){

            //TODO: Check for errors first
            var qna = {
                "answer": answers[i],
                "questions": [
                    questions[i]
                ],
                "source": source,
                "metadata": [
                    {
                        "name": "intent",
                        "value": result
                    },
                    {
                        "name": "parentCondition",
                        "value": conditionName
                    },
                    {
                        "name": "subject",
                        "value": subject
                    }
                ]
            };

            qnaCollection.push(qna);
        });
    }

    return qnaCollection;
}

function getIntent(query, callback) {

    var request = require('request');

    var url = process.env['LUISURL'] + '&q=' + query;

    request.get(url, function (error, response, body) {

        if (!error && response.statusCode === 200) {
            callback(JSON.parse(body).topScoringIntent.intent);
        }
    });
}








function createAndRegisterQnA(qnaName, qnaPairs, keywords) {

        createQnA(qnaName, qnaPairs, function(response) {

            if (!response.includes('Error')) {

                createTableEntry(qnaName, response, keywords, docURL); //TODO: Download TSV once KB is created and push to Blob (add output) - docURL is then stored in the Table for future edits
            }
            else {

                context.log(response);

                setTimeout(function () {

                    context.log("Trying again:", qnaName);
                    createAndRegisterQnA(qnaName, qnaPairs, keywords);

                }, 8000);
            }
        });
}

function createQnA(qnaName, qnaPairs, callback) {

    var request = require('request');

    // Set the headers
    var headers = {
        'Ocp-Apim-Subscription-Key': process.env['QnASubKey'],
        'Content-Type': 'application/json'
    };

    // Configure the request
    var options = {
        url: process.env['QnAURL'],
        method: 'POST',
        headers: headers,
        form: {
            "name": qnaName,
            "qnaPairs": qnaPairs,
            "urls": []
        }
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

function createTableEntry(qnaName, kbID, keywords, docURL) {

    var azure = require('azure-storage');

    var retryOperations = new azure.ExponentialRetryPolicyFilter();
    var tableSvc = azure.createTableService(process.env['TableStorageConnString']).withFilter(retryOperations);

    var qnaEntry = {
        PartitionKey: {'_': process.env['TablePartitionKey']},
        RowKey: {'_': qnaName},
        KBID: {'_': kbID},
        Keywords: {'_': keywords},
        DocURL: {'_': docURL}
    };

    tableSvc.insertEntity(process.env['TableName'], qnaEntry, function (error, result, response) {
        if (!error) {
            count++;
            context.log("Success:", qnaName);

        } else {

            context.log("Error inserting to Azure Table:", error.message);
        }
    });
}