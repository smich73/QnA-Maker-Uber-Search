const request = require('request');

const config = {
    qnaMakerEndpoint: process.env.QNAMAKER_ENDPOINT,
    qnaMakerKey: process.env.QNAMAKER_KEY
};

var headers = {
    'Ocp-Apim-Subscription-Key': config.qnaMakerKey,
    'Content-Type': 'application/json'
};

function createQnA(qnaForUpload, callback) {
    if (newQnA.qnaList.length > 0) {
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
    else {
        console.log("QnA has no data. QnAs left:", qnaCollection.length);
        return;
    }
}

function getQnA(kbID, callback) {
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

function deleteQnA(qna) {
    // Configure the request
    var options = {
        url: qnaURL + kbID,
        method: 'DELETE',
        headers: headers
    };

    // Start the request
    request(options, function (error, response, body) {

        if (!error && response.statusCode === 204) {
            console.log("Success: QnA deleted. QnA:", qna.name, "QnAs left:", qnaCollection.length);
        } else {
            console.log("Error:", body, "Status code:", response.statusCode);
        }
    });
}