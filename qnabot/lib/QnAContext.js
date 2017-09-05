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
            let numberOfRespones = 3;
            let _this = this;
            var postBody = '{"question":"' + question + '", "top":' + numberOfRespones + '}';
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
                                    entity: ans.answer,
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
