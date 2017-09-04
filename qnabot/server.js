const restify = require('restify');
const builder = require('botbuilder');
const azureStorage = require('azure-storage');
const search = require('azure-search-client');
const ag = require('./lib/AggregateClient');
const qna = require('./lib/QnAContext');
const utils = require('./lib/Utils');

const config = {
    searchName: process.env.SEARH_NAME,
    searchKey: process.env.SEARCH_KEY,
    searchIndexName: process.env.SEARCH_INDEX_NAME,
    storageConnectionString: process.env.BLOB_CONN_STRING,
    lookupTableName: process.env.LOOKUP_TABLE_NAME,
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD,
    qnaMakerEndpoint: "https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/",
    qnaMakerKey: process.env.QNAMAKER_KEY,
    choiceConfidenceDelta: 0.2, //If two items are returned and their scores are within this delta of each other the user is offered a choice. 
    qnaConfidencePrompt: 0.6 //If scores are lower than this users will be offered a choice. 
};

const chatConnector = new builder.ChatConnector({
    appId: config.appId,
    appPassword: config.appPassword
});

console.info("Starting with config:");
console.info(config);

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

function buildResponseMessage(session, response) {
    var msg = new builder.Message(session);
    msg.attachmentLayout(builder.AttachmentLayout.carousel)
    msg.attachments([
        new builder.HeroCard(session)
            .title(response.questionMatched)
            .subtitle(response.name)
            .text(response.entity)
    ]);
    msg.inputHint = "expectingInput";
    return msg;
}

function setupServer() {
    server.post('/api/messages', chatConnector.listen());
    var bot = new builder.UniversalBot(chatConnector);

    bot.dialog('/',
        [
            (session, args) => {
                builder.Prompts.text(session, 'Welcome to QnA bot, you can ask questions and I\'ll lookup relivant information for you.');
            },
            (session, results, args) => {
                session.replaceDialog('TopLevelQuestion', results.response);
            }
        ]);

    bot.dialog('TopLevelQuestion',
        [
            (session, args) => {
                let questionAsked = args;
                session.privateConversationData.lastQuestion = questionAsked;
                agClient.searchAndScore(questionAsked).then(
                    res => {
                        if (res.length < 1 || res.score === 0) {
                            //TODO: In low confidence scenario office available contexts for user to pick. 
                            session.replaceDialog('NotFound', null);
                        } else {
                            session.privateConversationData.questionContexts = res.contexts;

                            //Todo: Should this be moved into the aggregate client? 
                            // I think potentially this sits better as part of it's concerns. 
                            let options = [];
                            let scoreToBeat = res.contexts[0].score - config.choiceConfidenceDelta;
                            res.contexts.forEach(currentContext => {
                                if (currentContext.score >= scoreToBeat) {
                                    options.push(currentContext);
                                }
                            });

                            if (options.length > 1) {
                                session.replaceDialog('SelectContext', questionAsked);
                            } else {
                                session.privateConversationData.selectedContext = res.contexts[0];
                                builder.Prompts.text(session, buildResponseMessage(session, res.answers[0]));
                            }
                        }
                    },
                    err => {
                        session.send('Sorry I had a problem finding an answer to that question');
                        console.error(err);
                    }
                );
            },
            (session, result, args) => {
                session.replaceDialog('FollowupQuestion', result.response);
            }
        ]
    );

    bot.dialog('SelectContext', [
        (session, args) => {
            let options = session.privateConversationData.questionContexts.map(x => x.name);
            options.push('None of the above');
            builder.Prompts.choice(
                session,
                'We\'ve found a few options, which is the best fit?', options, { listStyle: builder.ListStyle.button }
            );
        },
        (session, result, args) => {
            if (result.response.index > session.privateConversationData.questionContexts.length - 1) {
                session.replaceDialog('NotFound');
            } else {
                session.privateConversationData.selectedContext = session.privateConversationData.questionContexts[result.response.index];
                session.replaceDialog('FollowupQuestion', session.privateConversationData.lastQuestion);
            }
        }
    ]);

    bot.dialog('NotFound',
        [
            (session, args) => {
                if (session.privateConversationData.selectedContext) {
                    session.replaceDialog('NotFoundWithContext');
                } else {
                    builder.Prompts.text(session, "Sorry we couldn't find any answers to that one, can you reword the question and try again?");
                }

            },
            (session, result, args) => {
                session.replaceDialog('TopLevelQuestion', result.response);
            }
        ]);

    bot.dialog('NotFoundWithContext',
        [
            (session, args) => {
                if (session.privateConversationData.selectedContext) {
                    //TODO: Offer available questions....
                    let options = session.privateConversationData.selectedContext.possibleQuestions;
                    options.push('None of these are useful');
                    builder.Prompts.choice(
                        session, 
                        `I'm sorry we couldn't find a good answer to that one in "${session.privateConversationData.selectedContext.name}". We can answer these, are any of these useful?`, options,
                        { listStyle: builder.ListStyle.button });

                } else {
                    session.replaceDialog('NotFound');
                }
            },
            (session, result, args) => {
                // User didn't find a question that was right 
                if (result.response.index > session.privateConversationData.selectedContext.possibleQuestions.length - 1) {
                    session.privateConversationData.selectedContext = null;
                    session.replaceDialog('NotFound');
                    
                } else {
                    session.replaceDialog('FollowupQuestion', result.response.entity);

                }
            }
        ]);

    // Check a question against the current qnaMaker Context
    // If this is unable provide a good answer, requery at the top level. 
    bot.dialog('FollowupQuestion',
        [
            (session, args) => {
                let questionAsked = args;
                // Score using the highest matching context
                let context = qna.QnAContext.fromState(session.privateConversationData.selectedContext);
                context.scoreQuestion(questionAsked).then(
                    res => {
                        let topResult = res[0];
                        if (topResult.score > config.qnaConfidencePrompt) {
                            builder.Prompts.text(session, buildResponseMessage(session, topResult));
                        } else {
                            session.replaceDialog('FollowupQuestionLowConfidence', { answers: res, questionAsked: questionAsked });
                        }
                    },
                    err => {
                        session.send("Sorry I had a problem finding an answer to that question");
                        console.error(err);
                    }
                )
            },
            (session, result, args) => {
                session.replaceDialog('FollowupQuestion', result.response);
            }
        ]
    );

    bot.dialog('FollowupQuestionLowConfidence', [
        (session, args) => {
            let results = args.answers;
            let questionAsked = args.questionAsked;

            // If we don't get a good result score using all the remaining contexts
            let contexts = session.privateConversationData.questionContexts.map(x => qna.QnAContext.fromState(x));
            agClient.scoreRelivantAnswers(contexts, questionAsked, 3).then(
                res => {
                    let topResult = res[0];
                    if (topResult === undefined || topResult.score < 0.3) {
                        session.replaceDialog('NotFound', args);
                    } else {
                        var msg = new builder.Message(session);
                        msg.inputHint = "expectingInput";
                        msg.text("We've found some answers but we're not sure if they're a good fit. Do any of these work?");
                        session.send(msg);

                        let attachments = utils.top(res, 3).map(x => {
                            return new builder.HeroCard(session)
                            .title(x.questionMatched)
                            .subtitle(x.name)
                            .buttons([
                                builder.CardAction.imBack(session, x.questionMatched, "This one please!")
                            ])
                        });

                        var msg = new builder.Message(session);
                        msg.attachmentLayout(builder.AttachmentLayout.list)
                        msg.attachments(attachments);
                        msg.inputHint = "expectingInput";
                                      
                        builder.Prompts.text(session, msg);
                    }
                },
                err => {
                    session.send("Sorry I had a problem finding an answer to that question");
                    console.error(err);
                    session.endDialog();
                }
            )
        },
        (session, result, args) => {
            session.replaceDialog('FollowupQuestion', result.response);
        }
    ])
}

