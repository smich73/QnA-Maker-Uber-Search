"use strict";

const request = require('request');
const Promise = require('promise');
const entities = require("html-entities");

const htmlentities = new entities.AllHtmlEntities();

class QnAContext {
    constructor(qnaMakerKey, name, docId, kbid, score) {
        this.name = name;
        this.docId = docId;
        this.kbid = kbid;
        this._qnaMakerKey = qnaMakerKey;
        this.score = score;
    }

    scoreQuestion(question) {
        return new Promise((resolve, reject) => {
            let numberOfRespones = 3;
            let _this = this;
            var postBody = '{"question":"' + question + '", "top":' + numberOfRespones + '}';
            request({
                url: 'https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/'+this.kbid+'/generateanswer',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': this._qnaMakerKey
                },
                body: postBody
            }, (error, response, body) => {
                var result;
                try {
                    if (!error) {
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
                            result.score = result.answers[0].score;
                            result.entities = answerEntities;
                        }
                    }
                }
                catch (e) {
                    error = e;
                    reject(e);
                }
                try {
                    if (!error) {
                        if (result.score = 0){
                            resolve([]);
                        } else {
                            resolve(answerEntities);
                        }
                    }
                    else {
                        reject(error);
                    }
                }
                catch (e) {
                    reject(e);
                }
            })
        })
    }
}

module.exports = {
    QnAContext: QnAContext
}
