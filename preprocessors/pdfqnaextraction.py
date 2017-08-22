#!/usr/bin/python

import sys
import csv
import os
import re
import spacy
import json
from multiprocessing import Pool
from requests import get
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfdevice import PDFDevice, TagExtractor
from pdfminer.pdfpage import PDFPage
from pdfminer.converter import XMLConverter, HTMLConverter, TextConverter
from pdfminer.cmapdb import CMapDB
from pdfminer.layout import LAParams
from pdfminer.image import ImageWriter
from spacy.symbols import nsubj, VERB
nlp = spacy.load('en_core_web_md')


dataDir = "/Users/lawrence/OneDrive - Microsoft/PI/Docs"

def getFileName(row):
    leafletTitle = re.sub(r'[^\w]', ' ', row[1])
    filename = os.path.join(dataDir,str.format("{1}_{2}.pdf", dataDir, row[0], leafletTitle).replace("/", ""))
    return filename


def getItem(row):
    filename = getFileName(row)
    print str.format("Getting:{}", filename)
    # print filename
    if os.path.exists(filename):
        print str.format("Already Exists {}", filename)
    else:
        with open(filename, "wb") as file:
            response = get(row[2])
            file.write(response.content)


def extractText(row):
    filename = getFileName(row)
    print str.format("Extracting {}", filename)
    outputFileName = str.format("{}.txt", getFileName(row))

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
    
    def addPair(self, pair):
        self.questions.append(pair)
    
    def saveJson(self, filename):
        fp = open(str.format("{}.json", filename), "w")
        return json.dump(self.__dict__, fp, default=encode_qnaPair)

class QnaPair:
    def __init__(self, question):    
        self.question = question
        self.answer = ""
        self.source = ""

    def addAnswerText(self, text):
        self.answer += text

def encode_qnaPair(obj):
    if isinstance(obj, QnaPair):
        return obj.__dict__
    return obj

# Very basic!
def extractQuestions(row): 
    filename = getFileName(row)
    txtFileName = str.format("{}.txt", getFileName(row))
    fp = file(txtFileName, 'rb')
    txt = fp.read()
    nlpDoc = nlp(txt.decode("utf8"))
    qnadoc = QnaDoc(row[0], row[1], row[2])
    pair = QnaPair("Intro")
    for sent in nlpDoc.sents:
        if "?" in sent.text:
            qnadoc.addPair(pair)
            pair = QnaPair(sent.text)
        else:
            pair.addAnswerText(sent.text)
    qnadoc.saveJson(filename)
    return qnadoc

def extractVerb(sent):
    for possible_subject in sent:
        if possible_subject.dep == nsubj and possible_subject.head.pos == VERB:
            print(possible_subject.head_)
    for word in sent:
        print(word.text, word.lemma, word.lemma_, word.tag, word.tag_, word.pos, word.pos_)

print "Getting started!"

f = open(os.path.join(dataDir, 'PDFs.csv'))
reader = csv.reader(f, 'excel')
rows = list(reader)

p = Pool(4)
try:
    p.map(getItem, rows)
    p.map(extractText, rows)
    p.map(extractQuestions, rows)
except KeyboardInterrupt:
        # **** THIS PART NEVER EXECUTES. ****
    p.terminate()
    print "You cancelled the program!"
    sys.exit(1)


print "Done"
