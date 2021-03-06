"use strict";

const request = require('request');
const Promise = require('promise');
const entities = require("html-entities");

const htmlentities = new entities.AllHtmlEntities();

class QnAContext {
    constructor(qnaMakerKey, id, name, docId, kbid, score, similarContexts, possibleQuestions) {
        this.id = id;
        this.name = name;
        this.docId = docId;
        this.kbid = kbid;
        this._qnaMakerKey = qnaMakerKey;
        this.score = score;
        this.similarContexts = similarContexts;
        this.possibleQuestions = possibleQuestions;
    }

    static fromState(contextState) {
        return new QnAContext(contextState._qnaMakerKey, contextState.id, contextState.name, contextState.docId, contextState.kbid, contextState.score, contextState.similarContexts, contextState.possibleQuestions);
    }

    scoreQuestion(question) {
        return new Promise((resolve, reject) => {
            let numberOfResponses = 3;
            let _this = this;
            var postBody = '{"question":"' + question + '", "top":' + numberOfResponses + '}';
            request({
                url: 'https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/' + this.kbid + '/generateanswer',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': this._qnaMakerKey
                },
                body: postBody
            }, (error, response, body) => {
                var result;
                let isSuccessful = !error && response.statusCode === 200;
                try {
                    if (isSuccessful) {
                        result = JSON.parse(body);
                        var answerEntities = [];
                        if (result.answers !== null && result.answers.length > 0) {
                            result.answers.forEach(function (ans) {
                                ans.score /= 100;
                                ans.answer = htmlentities.decode(ans.answer);
                                var answerEntity = {
                                    context: _this,
                                    questionMatched: ans.questions[0],
                                    score: ans.score,
                                    // The below replacements are temporary - ideally these issues should be fixed during preprocessing (other than the first one which is bot-specific)
                                    entity: ans.answer.replace(/\n\n/g, '\n\n &nbsp; \n\n').replace(/\.\n/g, '.\n\n').replace(/\./g, '. ').replace(/\n\nPage \d of \d\n\n/g, '').replace(/Page \d of \d/g, '').replace(/[a-z]\n[A-Z]/g, function (match) {
                                        return match.replace('\n', '\n\n'); // Separate out subtitles
                                      }).replace(/[a-z]\n[a-z]/g, function (match) {  
                                          return match.replace('\n', ' '); // Lose random newlines from document wrapping
                                      }),
                                    type: 'answer',
                                    kbid: _this.kbid,
                                    name: _this.name,
                                    docId: _this.docId
                                };
                                answerEntities.push(answerEntity);
                            });
                        }
                    }
                }
                catch (e) {
                    error = e;
                    reject(e);
                }
                try {
                    if (isSuccessful) {
                        resolve(answerEntities);
                    }
                    else {
                        console.error(JSON.parse(body));
                        reject(JSON.parse(body));
                    }
                }
                catch (e) {
                    reject(e);
                }
            })
        })
    }

    trainResponse(questionAsked, questionSelected, answerShown, userId) {

        return new Promise((resolve, reject) => {
            let postObject = {
                feedbackRecords: [
                    {
                        userId: userId,
                        userQuestion: questionAsked,
                        kbQuestion: questionSelected,
                        kbAnswer: answerShown
                    }
                ]
            }

            var postBody = JSON.stringify(postObject);
            request({
                url: 'https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/' + this.kbid + '/train',
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': this._qnaMakerKey
                },
                body: postBody
            }, (error, response, body) => {
                let isSuccessful = !error && response.statusCode === 204;
                if (isSuccessful) {
                    resolve();
                } else {
                    reject(JSON.parse(body));
                }

            })
        })
    }
}

module.exports = {
    QnAContext: QnAContext
}
