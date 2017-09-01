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
server.get('/healthz', (req, res) => {
    if (isServerReady) {
        res.send(200);
    } else {
        res.send(500);
    }
});

server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);

    //Healthcheck service - can we talk to dependencies?
    searchClient.search(config.searchIndexName, { search: 'Is search available?' }, (err, res) => {
        if (err) {
            console.error("Failed to connect to azure search");
            throw err;
        }

        tableClient.doesTableExist(config.lookupTableName, (err, res) => {
            if (err) {
                console.error("Failed to connect to table storage");
                throw err;
            }
            if (res.exists) {
                isServerReady = true;
                setupServer();
            }
        });
    });
});

function setupServer() {
    server.post('/api/messages', chatConnector.listen());
    var bot = new builder.UniversalBot(chatConnector);

    bot.dialog('/',
        [
            (session, args) => {
                builder.Prompts.text(session, "Welcome to QnA bot, you can ask questions and I'll lookup relivant information for you.");
            },
            (session, results, args) => {
                session.replaceDialog('TopLevelQuestion', results.response);
            }
        ]);

    bot.dialog('TopLevelQuestion',
        [
            (session, args) => {
                agClient.searchAndScore(args).then(
                    res => {
                        if (res.length < 1) {
                            session.replaceDialog('NotFound');
                        }
                        session.privateConversationData.questionContext = res[0].context;
                        var msg = new builder.Message(session);
                        msg.attachmentLayout(builder.AttachmentLayout.carousel)
                        msg.attachments([
                            new builder.HeroCard(session)
                                .title(res[0].question)
                                .text(res[0].answer)
                        ]);
                        builder.Prompts.text(session, msg);
                    },
                    err => {
                        session.send("Sorry I had a problem finding an answer to that question");
                        console.error(err);
                    }
                );
            },
            (session, result, args) => {
                session.replaceDialog('FollowupQuestion', result.response);
            }
        ]
    );

    bot.dialog('NotFound', 
    [
        (session, args) => {
            builder.Prompts.text("I'm sorry we couldn't find any answers to that one, could you reword the question and retry?");
        },
        (session, result, args) => {
            session.replaceDialog('TopLevelQuestion', result.reponse);
        }
    ]);

    bot.dialog('FollowupQuestion',
        [
            (session, args) => {
                let context = session.privateConversationData.questionContext
                context.scoreQuestion(args).then(
                    res => {
                        let topResult = res[0];
                        if (topResult.score < 0.5) {
                            session.replaceDialog('TopLevelQuestion', args.question);
                        }
                        session.privateConversationData.questionContext = res[0].context;
                        var msg = new builder.Message(session);
                        msg.attachmentLayout(builder.AttachmentLayout.carousel)
                        msg.attachments([
                            new builder.HeroCard(session)
                                .title(res[0].question)
                                .text(res[0].answer)
                        ]);
                        builder.Prompts.text(session, msg);
                    },
                    err => {
                        session.send("Sorry I had a problem finding an answer to that question");
                        console.error(err);
                    }
                )
            },
            (session, result, args) => {
                session.replaceDialog('FollowupQuestion', result.reponse);
            }
        ]
    );
}

