const restify = require('restify');
const builder = require('botbuilder');
const azureStorage = require('azure-storage');
const search = require('azure-search-client');
const ag = require('./lib/AggregateClient');

const config = {
    searchName: process.env.SEARH_NAME,
    searchKey: process.env.SEARCH_KEY,
    searchIndexName: process.env.SEARCH_INDEX_NAME,
    storageConnectionString: process.env.BLOB_CONN_STRING,
    lookupTableName: process.env.LOOKUP_TABLE_NAME,
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD,
    qnaMakerEndpoint: "https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/",
    qnaMakerKey: process.env.QNAMAKER_KEY
};

const chatConnector = new builder.ChatConnector({
    appId: config.appId,
    appPassword: config.appPassword
});

const retryPolicy = new azureStorage.ExponentialRetryPolicyFilter();
const tableClient = azureStorage.createTableService(config.storageConnectionString).withFilter(retryPolicy);
tableClient.lookupTableName = config.lookupTableName;

const searchClient = new search.SearchClient(config.searchName, config.searchKey);
searchClient.indexName = config.searchIndexName;

const agClient = new ag.AggregateClient(searchClient, tableClient, config.qnaMakerKey);


let isServerReady = false;
// Setup Restify Server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);

    //Healthcheck service - can we talk to dependencies?
    searchClient.search(config.searchIndexName, { search: 'Is search available?' }, (err, res) => {
        if (err) {
            console.error("Failed to connect to azure search");
            throw err;
        }

        res.result.value

        tableClient.doesTableExist(config.lookupTableName, (err, res) => {
            if (err) {
                console.error("Failed to connect to table storage");
                throw err;
            }
            if (res.exists) {
                isServerReady = true;
                setupServer();
            }
        })
    })
});

function setupServer() {
    server.post('/api/messages', chatConnector.listen());
    var bot = new builder.UniversalBot(chatConnector);

    bot.dialog('/', (session, args) => {

        session.send("Hello!");
    });
}

let question = 'What is peripheral neuropathy?';
agClient.findRelivantQnaDocs(question).then(
    res => {
        console.log(res);
        agClient.scoreRelivantAnswers(res, question).then(res =>{
            console.log(res);
        })
    },
    err => {
        console.error(err);
    }
);

