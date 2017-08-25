var stopwords;

getTextFromURL(stopwordURL, function(result){

    stopwords = result.replace(/["]+/g, '').replace(/[\n]+/g, '').split('\r');

    getTextFromURL(docURL, function(result){
        var keywords = getKeywords(result, 10);
    });
});

function getTextFromURL(url, callback) {

    var request = require('request');

    request.get(url,function (error, response, body) {

        if (!error && response.statusCode === 200) {

            callback(body);
        }
    });
}

function getKeywords(text, numberOfKeywords) {

    var words = getWords(text);

    var countedWords = countWords(words);

    var keywords = getTopWords(countedWords, numberOfKeywords);

    return keywords;
}

function getWords(text) {

    var words = [];

    var allWords = text.replace(/[0-9]/g, '').split(' ');

    for (var j = 0; j < allWords.length; j++){

        var word = allWords[j].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_~()]/g,"").replace(/\s{2,}/g,"");

        if (stopwords.indexOf(word) === -1 && word !== ''){

            words.push(word);
        }
    }

    return words;
}

function countWords(words) {
    var wordCount = {};

    for (var i = 0; i < words.length; i++)
    {

        var word = words[i];

        if(wordCount[word] == null){

            wordCount[word] = 1;
        } else {

            wordCount[word]++;
        }
    }

    return wordCount;
}

function getTopWords(countedWords, numberOfWords) {
    var sortedWords = [];

    for (var word in countedWords) {

        sortedWords.push([word, countedWords[word]]);
    }

    console.log('Found ' + sortedWords.length + ' unique words not in the stopword list.');

    sortedWords.sort(function(a, b) {

        return b[1] - a[1];
    });

    console.log(sortedWords);

    var topWords = [];

    for (var i = 0; i < numberOfWords; i++){

        topWords.push(sortedWords[i][0]);
    }

    console.log("Top " + numberOfWords + " words:\n" + topWords);

    return topWords;
}