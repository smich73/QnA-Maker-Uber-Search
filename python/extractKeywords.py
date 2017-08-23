import urllib.request
import spacy
import re
from collections import Counter
import json

nlp = spacy.load("en")

def populateStopwords(stopwordURL):
    stopwords = getTextFromURL(stopwordURL)
    stopwords = stopwords.replace('"', '').replace('\n', '').split("\r")

    for line in stopwords:
        nlp.vocab[line].is_stop = True

def extractKeywords(text, number):
    text = text.replace('\n', ' ').replace('\r', ' ').replace('"', ' ').lower()
    text = re.sub('\d',' ', text)
    text = re.sub('[^a-zA-Z0-9^\w\s \']',' ', text) 

    text = text.split(' ')
    words = []

    for word in text:
        if not nlp.vocab[word].is_stop and word != '':
            words.append(word)

    sortedWords = Counter(words)

    keywords = ""
    sortedWords = sortedWords.most_common(number)
    for word in sortedWords:
        keywords += ", " + word[0]
    
    return keywords[1:]

def updateJSON(jsonURL):
    text = getTextFromURL(jsonURL)
    qnaCollection = json.loads(text)

    allwords = ""

    for question in qnaCollection['questions']:
        print(extractKeywords(question['answer'], 5)) # Answer keywords
        print(extractKeywords(question['question'], 1)) # Question subject

        allwords += question['answer']
        allwords += question['question']
    
    print(extractKeywords(allwords, 10)) # Overall document keywords
    #print (qnaCollection)

def getTextFromURL(url):
    return urllib.request.urlopen(url).read().decode("utf8")