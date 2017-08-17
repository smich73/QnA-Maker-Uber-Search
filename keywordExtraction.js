function extractKeywordsFromTSV(stopwordURL, tsvURL, numberOfWords){

    getTextFromURL(stopwordURL, function(result){

        var stopwords = result.replace(/["]+/g, '').replace(/[\n]+/g, '').split('\r');
        
        getTextFromURL(tsvURL, function(result){
            
            var topWords = calculateKeywordDensity(result, stopwords, numberOfWords);
        });
    });
}

function getTextFromURL(url, callback){

    var request = require('request');

    request.get(url,function (error, response, body) {

        if (!error && response.statusCode == 200) {

            callback(body);
        }
    });
}

function getWordsFromTSV(tsv, stopwords){

    var linesOfText = tsv.split('\n');

    var answers = [];

    for (var i = 0; i < linesOfText.length; i++){

        var line = linesOfText[i].split('\t');

            //questions.push(line[0]);
            answers.push(line[1]);
            //conditions.push(line[2]);
            //sources.push(line[3]);
    }

    var words = [];

    for (var i = 0; i < answers.length - 1; i++){

        var allWords = answers[i].replace(/[0-9]/g, '').split(' ');

        for (var j = 0; j < allWords.length; j++){

            var word = allWords[j].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_~()]/g,"").replace(/\s{2,}/g,"");

            if (stopwords.indexOf(word) === -1 && word !== ''){

                words.push(word);
            }
        }
    }

    return words;
}

function countWords(words){
    var wordCount = {};

    for(var i = 0; i < words.length; i++)
    {

        var word = words[i];

        if(wordCount[word] == null){

            wordCount[word] = 1;
        }
            
        else{

            wordCount[word]++;
        }
    }

    return wordCount;
}

function getTopWords(countedWords, numberOfWords){
    var sortedWords = [];

    for (var word in countedWords) {

        sortedWords.push([word, countedWords[word]]);
    }

    console.log('Found ' + sortedWords.length + ' unique words not in the stopword list.');

    sortedWords.sort(function(a, b) {

        return b[1] - a[1];
    });

    var topWords = [];

    for (var i = 0; i < numberOfWords; i++){

        topWords.push(sortedWords[i][0]);
    }

    console.log("Top " + numberOfWords + " words:\n" + topWords);

    return topWords;
}

function calculateKeywordDensity(tsv, stopwords, numberOfWords){

    var words = getWordsFromTSV(tsv, stopwords);
    
    var countedWords = countWords(words);

    var topWords = getTopWords(countedWords, numberOfWords);

    return topWords;
}