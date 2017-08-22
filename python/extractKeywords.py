import urllib.request
import spacy
import re
from collections import Counter
nlp = spacy.load("en")

def populateStopwords(stopwordURL):
    stopwords = urllib.request.urlopen(stopwordURL).read().decode("utf8")
    stopwords = stopwords.replace('\n', '').replace('"', '').split("\r")
    return stopwords

def extractKeywords(documentURL):
    for line in stopwords:
        nlp.vocab[line].is_stop = True

    textForAnalysis = urllib.request.urlopen(documentURL).read().decode("utf8")
    textForAnalysis = textForAnalysis.replace('\n', '').replace('"', '')
    textForAnalysis = re.sub('\d','', textForAnalysis)
    textForAnalysis = re.sub('[^a-zA-Z0-9^\w\s]','', textForAnalysis) 

    textForAnalysis = textForAnalysis.split(' ')
    words = []

    for word in textForAnalysis:
        if not nlp.vocab[word].is_stop and word != '':
            words.append(word)

    sortedWords = Counter(words)
    print(sortedWords.most_common(10))

    return sortedWords