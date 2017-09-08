const azureStorage = require('azure-storage');

const config = {
    storageConnectionString: process.env.BLOB_CONN_STRING,
    azTableName: process.env.LOOKUP_TABLE_NAME,
    azTablePartitionKey: process.env.LOOKUP_TABLE_PARTITIONKEY
};

function createTableEntry(qna, kbID) {
    var retryOperations = new azureStorage.ExponentialRetryPolicyFilter();
    var tableSvc = azureStorage.createTableService(config.storageConnectionString).withFilter(retryOperations);

    var qnaEntry = {
        PartitionKey: {'_': config.azTablePartitionKey},
        RowKey: {'_': qna.id},
        Condition: {'_': qna.name},
        KBID: {'_': kbID},
        DocURL: {'_': qna.source}
    };

    tableSvc.insertEntity(config.azTableName, qnaEntry, function (error, result, response) {
        if (error) {
            console.log("Error inserting to Azure Table:", error.message);
        }
    });
}

function checkIfEntryExists(qna) {
    return new Promise((resolve, reject) => {
        var kbID = '';

        var query = new azure.TableQuery().top(1).where('PartitionKey eq ?', config.azTablePartitionKey).and('RowKey eq ?', qna.id);

        var retryOperations = new azureStorage.ExponentialRetryPolicyFilter();
        var tableSvc = azureStorage.createTableService(config.storageConnectionString).withFilter(retryOperations);

        tableSvc.queryEntities(config.azTableName, query, null, function(error, result, response) {
            if(!error) {
                if (result.entries.length > 0) {
                    kbID = result.entries[0].KBID._;
                }
            }
            else {
                reject("Error:", error.message);
            }
            if (kbID !== '') {
                resolve(kbID);
            }
            else {
                reject("Entry not found.");
            }
        });
    });
}

module.exports = {
    createTableEntry: createTableEntry,
    checkIfEntryExists: checkIfEntryExists
};