#!/usr/bin/python

import sys
import csv
import os
import re
import json
import time
import spacy
import urllib.request
import pdfminer
from multiprocessing import Pool
from spacy.symbols import nsubj, VERB
from collections import Counter
from requests import get

nlp = spacy.load('en')

def getTextFromURL(url):
    return urllib.request.urlopen(url).read().decode("utf8")

def populateStopwords(stopwordURL):
    stopwords = getTextFromURL(stopwordURL)
    stopwords = stopwords.replace('"', '').replace('\n', '').split("\r")

    for line in stopwords:
        nlp.vocab[line].is_stop = True

dataDir = os.environ["PDATA_DIR"]
print(str.format("Using data dir:{}", dataDir))

stopwords = populateStopwords("https://qnageneratorstorage.blob.core.windows.net/stopwords/customStopwords.txt")

def getFileName(row):
    leafletTitle = re.sub(r'[^\w]', ' ', row[1])
    filename = os.path.join(dataDir,("{1}_{2}.pdf".format(dataDir, row[0], leafletTitle)).replace("/", ""))
    return filename

def getItem(row):
    filename = getFileName(row)
    print ("Getting:{}".format(filename))
    
    # print filename
    if os.path.exists(filename):
        print ("Already Exists {}".format(filename))
    else:
        with open(filename, "wb") as file:
            response = get(row[2])
            file.write(response.content)

def extractText(row):
    filename = getFileName(row)
    print ("Extracting {}".format(filename))
    outputFileName = ("{}.txt".format(getFileName(row)))

    if os.path.exists(outputFileName):
        return

    fp = file(filename, 'rb')
    output = file(outputFileName, 'w')
    rsrcmgr = PDFResourceManager()
    laparams = LAParams()
    device = TextConverter(rsrcmgr, output, laparams=laparams)
    interpreter = PDFPageInterpreter(rsrcmgr, device)
    for page in PDFPage.get_pages(fp):
        # page.rotate = (page.rotate + rotation) % 360
        interpreter.process_page(page)
    fp.close()
    device.close()

class QnaDoc:
    def __init__(self, docId, name, url):
        self.id = docId
        self.name = name
        self.url = url
        self.questions = list()
        self.metadata = list()
    
    def addPair(self, pair):
        self.questions.append(pair)
    
    def saveJson(self, filename):
        fp = open(("{}.json".format(filename)), "w")
        return json.dump(self.__dict__, fp, default=encode_qnaPair)

    def addMetadata(self, k, v):
        self.metadata.append(KeyValue(k,v))

class QnaPair:
    def __init__(self, question):    
        self.question = question
        self.answer = ""
        self.source = ""
        self.metadata = list()

    def addAnswerText(self, text):
        self.answer += text

    def addMetadata(self, k, v):
        self.metadata.append(KeyValue(k,v))

class KeyValue:
    def __init__(self, key, value):
        self.key = key
        self.value = value

def encode_qnaPair(obj):
    return obj.__dict__

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

    sortedWords = Counter(words)

    keywords = ""
    sortedWords = sortedWords.most_common(number)
    for word in sortedWords:
        keywords += "," + word[0]

    return keywords[1:]

def enrichQnA(qnaDoc):
    allwords = ""

    for question in qnaDoc.questions:
        question.addMetadata("AnswerKeywords", extractKeywords(question.answer, 5))
        question.addMetadata("MedicalSubject", extractKeywords(question.question, 1))

        allwords += question.question
        allwords += question.answer
    
    qnaDoc.addMetadata("DocumentKeywords", extractKeywords(allwords, 10))

    return qnaDoc

# Very basic!
def extractQuestions(row): 
    try:
        filename = getFileName(row)
        txtFileName = ("{}.txt".format(getFileName(row)))
        fp = open(txtFileName, 'rb')
        txt = fp.read()
        nlpDoc = nlp(txt.decode("utf8"))
        qnadoc = QnaDoc(row[0], row[1], row[2])
        qnadoc.addMetadata("Created", time.strftime("%H:%M:%S %m/%d/%Y"))
        pair = QnaPair("Intro")
        for sent in nlpDoc.sents:
            if "?" in sent.text:
                pair.addMetadata("EndPosition", str(sent.end))
                qnadoc.addPair(pair)
                pair = QnaPair(sent.text)
                pair.addMetadata("StartPosition", str(sent.start))
            else:
                pair.addAnswerText(sent.text)
        
        qnadoc = enrichQnA(qnadoc)
        qnadoc.saveJson(filename)
        return qnadoc
    except FileNotFoundError as inst:
        textFile = filename.split('/')
        print("Error: File not found:", textFile[-1])

    except Exception as inst:
        print(inst)

def extractVerb(sent):
    for possible_subject in sent:
        if possible_subject.dep == nsubj and possible_subject.head.pos == VERB:
            print(possible_subject.head_)
    for word in sent:
        print(word.text, word.lemma, word.lemma_, word.tag, word.tag_, word.pos, word.pos_)

print ("Getting started!")

f = open(os.path.join(dataDir, 'PDFs.csv'))
reader = csv.reader(f, 'excel')
rows = list(reader)

extractQuestions(rows[0])

p = Pool(4)
try:
    # p.map(getItem, rows)
    # p.map(extractText, rows)
    p.map(extractQuestions, rows)
except KeyboardInterrupt:
        # **** THIS PART NEVER EXECUTES. ****
    p.terminate()
    print ("You cancelled the program!")
    sys.exit(1)

print ("Done")