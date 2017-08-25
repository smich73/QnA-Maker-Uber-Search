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

    processedText = nlp(text)
    #text = text.split(' ')
    words = []

    for word in processedText:
        if not nlp.vocab[word.lemma_].is_stop and word.lemma_ != '' and not word.lemma_.isspace() and word.lemma_ != '-PRON-' and word.lemma_ != "'":
            words.append(word.lemma_)
            #print(word.lemma_)

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

populateStopwords("https://qnageneratorstorage.blob.core.windows.net/stopwords/customStopwords.txt")
updateJSON("https://qnageneratorstorage.blob.core.windows.net/qnadocs/4194_Tricyclic%20Antidepressants.pdf.json")