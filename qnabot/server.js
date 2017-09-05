const restify = require('restify');
const builder = require('botbuilder');
const lodash = require('lodash');
const azureStorage = require('azure-storage');
const search = require('azure-search-client');
const ag = require('./lib/AggregateClient');
const qna = require('./lib/QnAContext');
const utils = require('./lib/Utils');
const sp = require('./lib/Spellcheck');

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
    spellcheckEndpoint: process.env.SPELLCHECK_ENDPOINT,
    spellcheckMode: process.env.SPELLCHECK_MODE,
    spellcheckMkt: process.env.SPELLCHECK_MKT,
    spellcheckKey: process.env.SPELLCHECK_KEY,
    choiceConfidenceDelta: 0.2, //If two items are returned and their scores are within this delta of each other the user is offered a choice. 
    qnaConfidencePrompt: 0.6, //If scores are lower than this users will be offered a choice. 
    qnaMinConfidence: 0.4, //Don't show answers below this level of confidence
    answerUncertainWarning: 0.85, //If scores are lower than this a warning is shown.
    searchConfidence: 0.7
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

const agClient = new ag.AggregateClient(searchClient, tableClient, config.qnaMakerKey, config.searchConfidence);
const spellcheck = new sp.Spellcheck(config.spellcheckMode, config.spellcheckMkt, config.spellcheckEndpoint, config.spellcheckKey);


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
    let attachment =
        new builder.HeroCard(session)
            .title(response.questionMatched)
            .subtitle("@" + response.name)
            .text(response.entity);

    if (response.score < config.answerUncertainWarning) {
        attachment = attachment.buttons([
            builder.CardAction.dialogAction(session, 'NotFound', null, 'Wrong question? Click here for options')
        ]);
    }


    var msg = new builder.Message(session);
    msg.attachmentLayout(builder.AttachmentLayout.carousel)
    msg.attachments([attachment]);
    msg.inputHint = "expectingInput";
    return msg;
}

function setupServer() {
    server.post('/api/messages', chatConnector.listen());
    var bot = new builder.UniversalBot(chatConnector, [
        (session, args) => {
            builder.Prompts.text(session, `Welcome to QnA bot, you can ask questions and I\'ll look up relevant information for you.\

            \n\nYou can find out what questions are available for your current conversation topic (once we\'ve started chatting) by typing \'questions\'.\

            \n\nYou can switch context at any time by typing \'@\' followed by the name of the condition you are interested in, for example \'@Toothache\' will allow you to ask\
            questions about toothache if there is a match found for the condition in my records.\

            \n\nType \'help\' at any time to display this message again.`);
        },
        (session, results, args) => {
            session.replaceDialog('TopLevelQuestion', results.response);
        }
    ]);

    // Set up interceptor on all incoming messages (user -> Bot) for spellcheck
    bot.use({
        botbuilder: function (session, next) {
            spellcheck.spellcheckMessage(session, next).then(
            res => {
                let result = res;
                if (result !== undefined) {
                    session.message.text = result.corrected;
                    console.log('Original:', result.original, 'Corrected:', result.corrected);
                }
                else {
                    session.message.text = result.original;
                    console.log('ERROR SPELLCHECKING:', result.original);
                }
                next();
            });
        }
    });

    bot.beginDialogAction('FollowupQuestionLowConfidence', 'FollowupQuestionLowConfidence');
    bot.beginDialogAction('FollowupQuestion', 'FollowupQuestion');
    bot.beginDialogAction('NotFound', 'NotFound');

    bot.dialog('Help', [
        (session, args, next) => {
            var contextDetails;
            if (session.privateConversationData.selectedContext === undefined){
                contextDetails = 'You don\'t currently have a context. Please ask a question about a medical condition to continue.';
            }
            else{
                contextDetails = 'Your current context is: @' + session.privateConversationData.selectedContext.name;
            }

            builder.Prompts.text(session, `I\'m QnA bot, you can ask questions and I\'ll look up relevant information for you.\

            \nYou can find out what questions are available for your current conversation topic by typing \'questions\' at any time.\

            \nYou can switch context at any time by typing \'@\' followed by the name of the condition you are interested in, for example \'@Toothache\' will allow you to ask\
            questions about toothache if there is a match found for the condition in my records. ${contextDetails}.\

            \nType \'help\' at any time to display this message again.`);
        },
        (session, result, args) => {
            session.replaceDialog('FollowupQuestion', { question: result.response });
        }
    ])
        .triggerAction({
            matches: /^help$/i,
            onSelectAction: (session, args, next) => {
                // Add the help dialog to the dialog stack 
                // (override the default behavior of replacing the stack)
                session.beginDialog(args.action);
            }
        });

    bot.dialog('Questions', [
        (session, args) => {
            if (session.privateConversationData.selectedContext) {
                let options = session.privateConversationData.selectedContext.possibleQuestions.slice(0); //Take a copy otherwise changes get saved to state
                options.push('None of these are useful');
                builder.Prompts.choice(
                    session,
                    `I can provide answers to the following questions for @${session.privateConversationData.selectedContext.name}: `, options,
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
                let originalQuestion = session.privateConversationData.lastQuestion;
                session.privateConversationData.lastQuestion = result.response.entity;
                session.replaceDialog('FollowupQuestion', { question: result.response.entity, originalQuestion: originalQuestion });

            }
        }
    ])
        .triggerAction({
            matches: /^questions$/i,
            onSelectAction: (session, args, next) => {
                // Add the help dialog to the dialog stack 
                // (override the default behavior of replacing the stack)
                session.beginDialog(args.action, args);
            }
        });

    bot.dialog('TopLevelQuestion',
        [
            (session, args) => {
                let questionAsked = args;
                if (questionAsked.charAt(0) === '@'){
                    questionAsked = questionAsked.substring(1);
                }
                var questionSegments = questionAsked.split(':');

                if (questionSegments.length > 1){
                    if (questionSegments[1].charAt(0) === ' '){
                        questionSegments[1] = questionSegments[1].substring(1).replace('?', '');
                    }
                    session.privateConversationData.lastQuestion = questionSegments[1];
                    var contextWords = questionSegments[0].split(' ');

                    var conditionWordInQuestion = false;
                    for (var i = 0; i < contextWords.length; i++){
                        if (questionSegments[1].indexOf(contextWords[i]) !== -1) {
                            conditionWordInQuestion = true;
                        }
                    }
                    if (!conditionWordInQuestion){
                        questionAsked = questionSegments[1] + ' of ' + questionSegments[0];
                    }
                    else {
                        questionAsked = questionSegments[1];
                    }
                }

                session.privateConversationData.lastQuestion = questionAsked;

                agClient.searchAndScore(questionAsked).then(
                    res => {
                        if (res.length < 1 || res.score === 0 || res.score < config.qnaMinConfidence) {
                            //TODO: In low confidence scenario offer available contexts for user to pick. 
                            session.replaceDialog('NotFound', null);
                        } else {
                            session.privateConversationData.questionContexts = res.contexts;

                            //Todo: Should this be moved into the aggregate client? 
                            // I think potentially this sits better as part of its concerns. 
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
                        session.send('Sorry, I had a problem finding an answer to that question');
                        console.error(err);
                    }
                );
            },
            (session, result, args) => {
                session.privateConversationData.lastQuestion = result.response;
                session.replaceDialog('FollowupQuestion', { question: result.response });
            }
        ])
        .triggerAction({
            matches: /\@.*$/i,
            onSelectAction: (session, args, next) => {
                // Add the help dialog to the dialog stack 
                // (override the default behavior of replacing the stack)
                session.beginDialog(args.action, session.message.text);
            }
        });

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
                session.replaceDialog('FollowupQuestion', { question: session.privateConversationData.lastQuestion });
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
                    let options = session.privateConversationData.selectedContext.possibleQuestions.slice(0); //Take a copy otherwise changes get saved to state
                    options.push('None of these are useful');
                    builder.Prompts.choice(
                        session,
                        `I'm sorry we couldn't find a good answer to that one in @${session.privateConversationData.selectedContext.name}. We can answer these, are any of these useful?`, options,
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
                    let originalQuestion = session.privateConversationData.lastQuestion;
                    session.privateConversationData.lastQuestion = result.response.entity;
                    session.replaceDialog('FollowupQuestion', { question: result.response.entity, originalQuestion: originalQuestion });

                }
            }
        ]);

    // Check a question against the current qnaMaker Context
    // If this is unable provide a good answer, requery at the top level. 
    bot.dialog('FollowupQuestion',
        [
            (session, args) => {
                if (args !== undefined) {
                    let questionAsked = args.question;

                    //Handle users selecting to change context for a followup question. 
                    if (args.context !== undefined) {
                        session.privateConversationData.selectedContext = args.context;
                    }

                    let context = qna.QnAContext.fromState(session.privateConversationData.selectedContext);

                    // Score using the highest matching context
                    context.scoreQuestion(questionAsked).then(
                        res => {
                            let topResult = res[0];
                            if (topResult.score > config.qnaConfidencePrompt) {
                                //If the user has selected a question manually, use this data to train QnAMaker
                                if (args.originalQuestion !== undefined) {
                                    context.trainResponse(args.originalQuestion, questionAsked, topResult.entity, session.message.user.id).catch(x => console.error('Error training model: ' + x));
                                }

                                builder.Prompts.text(session, buildResponseMessage(session, topResult));
                            } else {
                                session.replaceDialog('FollowupQuestionLowConfidence', questionAsked);
                            }
                        },
                        err => {
                            session.send("Sorry I had a problem finding an answer to that question");
                            console.error(err);
                        }
                    )
                }
                else {
                    session.replaceDialog('NotFound');
                }
            },
            (session, result, args) => {
                //Todo: Fixup temp workaround
                if (result.response === 'action?not found') {
                    session.replaceDialog('NotFound');
                } else {
                    session.privateConversationData.lastQuestion = result.response;
                    session.replaceDialog('FollowupQuestion', { question: result.response });
                }
            }
        ]
    );

    // Handle low confidence scenarios
    //  As we're unsure on how to answer this question we use a 2 fold approach
    //
    //  1. We consult the existing question context and related contexts
    //  2. We also requery azure search to see if it returns and new contexts
    //
    // These are then all score and top options presented to the user. 
    bot.dialog('FollowupQuestionLowConfidence', [
        (session, args) => {
            let questionAsked = args;

            if (questionAsked === undefined || args.action !== undefined) {
                questionAsked = session.privateConversationData.lastQuestion;
            }

            //Check for any new contexts that might be relevant.
            agClient.findRelevantQnaDocs(questionAsked).then(
                res => {
                    let currentContext = session.privateConversationData.selectedContext;

                    //Add in the existing contexts that are being tracked. 
                    let contexts = session.privateConversationData.questionContexts.map(x => qna.QnAContext.fromState(x));
                    //Add in new contexts which matched at the top level.
                    if (res !== undefined && res.length > 1) {
                        contexts.push(...res);
                    }

                    //Deduplicate contexts based on kbid.
                    let keySet = new Map(contexts.map(x => [x.id, x]));
                    contexts = Array.from(keySet.values());
                    //TOBO: Does this steadily bloat the contexts over a chat? Yes
                    session.privateConversationData.questionContexts = contexts;

                    agClient.scoreRelevantAnswers(contexts, questionAsked).then(
                        res => {
                            let topResult = res[0];
                            if (topResult === undefined || topResult.score === 0) {
                                session.replaceDialog('NotFound', args);
                            } else {
                                let attachments = [new builder.HeroCard(session)
                                    .text(`We've found some answers but we're not sure if they're a good fit, you may have changed topics. We included what you can ask in @${currentContext.name}, as well as some alternatives`)];

                                let cardsToCreate = []
                                let answersFromOtherContexts = utils.top(res.filter(x => x.score > config.qnaMinConfidence && x.context.id !== currentContext.id), 3);
                                cardsToCreate.push(answersFromOtherContexts);

                                let answersFromCurrentContext = utils.top(res.filter(x => x.score > config.qnaMinConfidence && x.context.id === currentContext.id), 3);

                                //If none of these answers are from the current context
                                // offer the user the option to see what he can ask in that context
                                if (answersFromCurrentContext.length < 1) {
                                    attachments.push(
                                        new builder.HeroCard(session)
                                            .subtitle("@" + currentContext.name + ": No answers found for this area")
                                            .buttons([
                                                builder.CardAction.dialogAction(session, "NotFound", null, "What can I ask?")])
                                    );
                                } else {
                                    cardsToCreate.push(...answersFromCurrentContext);
                                }

                                //Add all the cards to the attachments
                                attachments.push(...cardsToCreate.map(x => {
                                    return new builder.HeroCard(session)
                                        .subtitle("@" + x.name + ": " + x.questionMatched)
                                        .buttons([
                                            builder.CardAction.imBack(session, `@${x.name}: ${utils.decodeASCII(x.questionMatched)}`, `Ask this`)
                                        ])
                                }));


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
                err => {
                    session.send("Sorry I had a problem finding an answer to that question");
                    console.error(err);
                    session.endDialog();
                }
            )
        }/* ,
        (session, result, args) => {
            let text = result.response;
            if (text.includes('@') && text.includes(':')) {
                let indexOfSeperator = text.indexOf(':');
                let contextName = text.substring(1, indexOfSeperator);
                let question = text.substring(indexOfSeperator + 1);
                let context = session.privateConversationData.questionContexts.filter(x => x.name === contextName)[0];

                let originalQuestion;
                if (context.id === session.privateConversationData.selectedContext.id) {
                    //Add the necessary data to train the qna model. 
                    originalQuestion = session.privateConversationData.lastQuestion;
                } else {
                    session.privateConversationData.lastQuestion = question;
                    session.replaceDialog('FollowupQuestion', { question: question, context: context, originalQuestion: originalQuestion });
                }


            } else {
                if (result.response === 'action?not found') {
                    session.replaceDialog('NotFound');
                }
                session.privateConversationData.lastQuestion = result.response;
                session.replaceDialog('FollowupQuestion', { question: result.response });
            }
        } */
    ])
}

