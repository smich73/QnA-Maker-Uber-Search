"use strict";

const Promise = require('promise');
const qna = require('./QnAContext');
const utils = require('./Utils')
const azureStorage = require('azure-storage')

class AggregateClient {
    constructor(searchClient, tableClient, qnaMakerKey, searchConfidence = 0.7) {
        this._searchClient = searchClient;
        this._qnaMakerKey = qnaMakerKey;
        this._tableClient = tableClient;
        this._searchConfidence = searchConfidence;
    }

    _lookupQna(item) {
        return new Promise((resolve) => {
            let query = new azureStorage.TableQuery().top(1).where('RowKey eq ?', item.name);
            this._tableClient.queryEntities(this._tableClient.lookupTableName, query, null, (err, res) => {
                if (err) {
                    console.error(err);
                    resolve(null);  //Because of proimse.all limited error handling, using null to return error response.                   
                }

                if (res.entries.length > 0) {
                    let kbId = res.entries[0].KBID._;
                    let context = new qna.QnAContext(
                        this._qnaMakerKey,
                        item.name,
                        item.source,
                        kbId,
                        item["@search.score"],
                        null, //TODO: Add in similar contexts here!
                        JSON.parse(item.questions)
                    );

                    resolve(context);
                } else {
                    console.error('Item not found in lookup table for ' + item.name);
                    resolve(null);
                }
            });
        });
    }

    _getQnaContexts(items) {
        return new Promise((resolve) => {
            let lookups = [];
            items.forEach((item) => {
                lookups.push(this._lookupQna(item));
            });

            Promise.all(lookups).then(rawResults => {
                let filteredResults = rawResults.filter((i) => i != null);
                resolve(filteredResults);
            });
        });
    }

    findRelivantQnaDocs(question, top = 3) {
        return new Promise((resolve, reject) => {
             this._searchClient.search(this._searchClient.indexName, { search: question, top: top }, (err, res) => {
                if (err) {
                    reject(err);
                }
                this._getQnaContexts(res.result.value).then(contexts => {
                    resolve(contexts
                            .filter(x => x.score > this._searchConfidence)
                            .sort((a, b) => b.score - a.score)
                    ); //TODO: pull out score cutoff into config 
                });
            });
        });
    }

    scoreRelivantAnswers(qnaDocList, question) {
        return new Promise((resolve) => {

            var results = qnaDocList.map((doc) => {
                return doc.scoreQuestion(question)
            });

            // Catch any errors that are returned from promises
            // as promise.all will complete on first reject
            var results = results.map(p => p.catch(e => {
                console.error(`Failed scoring result: ${e}`);
                return [];
            }));

            Promise.all(results).then(res => {
                let allAnwers = [];
                res.forEach(answers => {
                    allAnwers.push(...answers);
                });
                allAnwers = allAnwers.sort((a, b) => b.score - a.score);
                
                resolve(allAnwers);
            });
        });
    }

    searchAndScore(question, top = 3) {
        return new Promise((resolve, reject) => {
            this.findRelivantQnaDocs(question, top).then(
                contexts => {
                    this.scoreRelivantAnswers(contexts, question).then(
                        answers => {
                            resolve({
                                contexts: utils.top(contexts, top),
                                answers: answers
                            });
                        },
                        err => {
                            reject(err);
                        })
                },
                err => {
                    reject(err);
                }
            );
        });
    }
}

module.exports = {
    AggregateClient: AggregateClient
}

