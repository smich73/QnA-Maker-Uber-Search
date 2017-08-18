var stopwords;

getTextFromURL(stopwordURL, function(result){

    stopwords = result.replace(/["]+/g, '').replace(/[\n]+/g, '').split('\r');
});

module.exports = function (context, medicalDoc) {

    var retryCount = 0;
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

function getTextFromURL(url, callback) {

    var request = require('request');

    request.get(url,function (error, response, body) {

        if (!error && response.statusCode === 200) {

            callback(body);
        }
    });
}

function splitTSV(tsv) {

    var linesOfText = tsv.split('\n');

    var questions = [];
    var answers = [];

    for (var i = 0; i < linesOfText.length; i++){

        var line = linesOfText[i].split('\t');

            questions.push(line[0]);
            answers.push(line[1]);
            //conditions.push(line[2]);
            //sources.push(line[3]);
    }

    var QnA = {
        "questions": questions,
        "answers": answers
    };

    return QnA;
}

function getKeywords(text, numberOfKeywords) {

    var words = getWords(text);

    var countedWords = countWords(words);

    var keywords = getTopWords(countedWords, numberOfKeywords);

    return keywords;
}

function getWords(text) {

    var words = [];

    for (var i = 0; i < text.length - 1; i++){

        var allWords = text[i].replace(/[0-9]/g, '').split(' ');

        for (var j = 0; j < allWords.length; j++){

            var word = allWords[j].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_~()]/g,"").replace(/\s{2,}/g,"");

            if (stopwords.indexOf(word) === -1 && word !== ''){

                words.push(word);
            }
        }
    }

    return words;
}

function countWords(words) {
    var wordCount = {};

    for (var i = 0; i < words.length; i++)
    {

        var word = words[i];

        if(wordCount[word] == null){

            wordCount[word] = 1;
        } else {

            wordCount[word]++;
        }
    }

    return wordCount;
}

function getTopWords(countedWords, numberOfWords) {
    var sortedWords = [];

    for (var word in countedWords) {

        sortedWords.push([word, countedWords[word]]);
    }

    context.log('Found ' + sortedWords.length + ' unique words not in the stopword list.');

    sortedWords.sort(function(a, b) {

        return b[1] - a[1];
    });

    var topWords = [];

    for (var i = 0; i < numberOfWords; i++){

        topWords.push(sortedWords[i][0]);
    }

    context.log("Top " + numberOfWords + " words:\n" + topWords);

    return topWords;
}

function createQnACollection(questions, answers, conditionName, source) {

    var qnaCollection = [];

    for (var i = 0; i < questions.length; i++) {

        getIntent(asasdad, questions[i], function (result){

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
                        "name": "condition",
                        "value": conditionName //TODO: Get entities from LUIS instead?
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