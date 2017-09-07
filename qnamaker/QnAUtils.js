const request = require('request');

const config = {
    qnaMakerEndpoint: process.env.QNAMAKER_ENDPOINT,
    qnaMakerKey: process.env.QNAMAKER_KEY
};

var headers = {
    'Ocp-Apim-Subscription-Key': config.qnaMakerKey,
    'Content-Type': 'application/json'
};

function createQnA(qnaForUpload) {
    return new Promise((resolve, reject) => {
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
                    resolve(body.kbId);
                } else {
                    reject("Error:", body, "Status code:", response.statusCode);
                }
            });
        }
        else {
            console.log("QnA has no data. QnAs left:", qnaCollection.length); //TODO: reject this?
            return;
        }
    });
}

function getQnA(kbID) {
    return new Promise((resolve, reject) => {
        // Configure the request
        var options = {
            url: qnaURL + kbID,
            method: 'GET',
            headers: headers
        };

        // Start the request
        request(options, function (error, response, body) {

            if (!error && response.statusCode === 200) {
                resolve(body);
            } else {
                reject("Error:", body, "Status code:", response.statusCode);
            }
        });
    });
}

function updateQnA(patch, kbID, callback) {
    return new Promise((resolve, reject) => {
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
                resolve(body);
            } else {
                reject("Error:", body, "Status code:", response.statusCode);
            }
        });
    });
}

//TODO: Should this be fire and forget or should I wait for a response?
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

module.exports = {
    createQnA: createQnA,
    getQnA: getQnA,
    updateQnA: updateQnA,
    deleteQnA: deleteQnA
};