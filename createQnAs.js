var count = 1;

// Function to create N copies of the same QnA using the QnA Maker API & store the generated KB IDs in an Azure Table
function createAndRegisterQnAs(qnaURL, qnaNamePrefix, qnaSubKey, tableConnectionString, tableName, tablePartitionKey, numberToCreate){

    var repeat = setInterval(function () { 

        var qnaName = qnaNamePrefix + count;      

        createQnA(qnaName, qnaURL, qnaSubKey, function(response){

            if (!response.includes('Error')){

                createTableEntry(response, qnaName, tableConnectionString, tableName, tablePartitionKey);

                if (count >= numberToCreate){
                    clearInterval(repeat);
                }
            }
            else {

                console.log(response);

                setTimeout(function () {
                    
                    console.log("Trying again:", qnaName);
                    createAndRegisterQnAs(qnaURL, qnaNamePrefix, tableConnectionString, numberToCreate);

                }, 8000);
            }
        });
    }, 8000);
}

function createTableEntry(result, qnaName, connectionString, tableName, partitionKey){

        var azure = require('azure-storage');

        var retryOperations = new azure.ExponentialRetryPolicyFilter();
        var tableSvc = azure.createTableService(connectionString).withFilter(retryOperations);

        var qna = {
            PartitionKey: {'_': partitionKey},
            RowKey: {'_': qnaName},
            KBID: {'_': result}
        };

        tableSvc.insertEntity(tableName, qna, function(error, result, response)
        {
            if(!error){
                count++;
                console.log("Success:", qnaName);
            }
            else {

                console.log("Error inserting to Azure Table:", error.message);
            }
        }); 
}

function createQnA(qnaName, docURL, subKey, callback) {

        var request = require('request');

        // Set the headers
        var headers = {
            'Ocp-Apim-Subscription-Key': subKey,
            'Content-Type': 'application/json'
        }

        // Configure the request
        var options = {
            url: 'https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/create',
            method: 'POST',
            headers: headers,
            form: {
                "name" : qnaName,
                "qnaPairs": [],
                "urls": [
                    docURL
                ]
            }
        }

        // Start the request
        request(options, function (error, response, body) {

            if (!error && response.statusCode == 201) {
                callback(JSON.parse(body).kbId);
            }
            else {
                callback("Error: " + JSON.parse(body).message + " Status code: " + response.statusCode);
            }
        })
    }