class Spellcheck {
    constructor(spellcheckMode, spellcheckMkt, spellcheckEndpoint, spellcheckKey) {
        this._spellcheckMode = spellcheckMode;
        this._spellcheckMkt = spellcheckMkt;
        this._spellcheckEndpoint = spellcheckEndpoint;
        this._spellcheckKey = spellcheckKey;
    }

    spellcheckMessage(session, next) {
        const request = require('request');
        return new Promise((resolve, reject) => {
            var query = '?text=' + session.message.text + '&mode=' + this._spellcheckMode + '&mkt=' + this._spellcheckMkt;
            request({
                url: this._spellcheckEndpoint + query,
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': this._spellcheckKey
                }
            }, (error, response, body) => {
                var result;
                let isSuccessful = !error && response.statusCode === 200;

                let spellcheckPair = {
                    'original': session.message.text,
                    'corrected': session.message.text
                };

                try {
                    if (isSuccessful) {
                        result = JSON.parse(body);

                        if (result.flaggedTokens !== null && result.flaggedTokens.length > 0) {
                            for (var i = 0; i < result.flaggedTokens.length; i++) {
                                spellcheckPair.corrected = spellcheckPair.corrected.replace(result.flaggedTokens[i].token, result.flaggedTokens[i].suggestions[0].suggestion);
                            }
                            //console.log(spellcheckPair.corrected);
                        }
                    }
                }
                catch (e) {
                    error = e;
                    reject(e);
                }
                try {
                    if (isSuccessful) {
                        resolve(spellcheckPair);
                    }
                    else {
                        reject(JSON.parse(body));
                    }
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
}

module.exports = {
    Spellcheck: Spellcheck
}