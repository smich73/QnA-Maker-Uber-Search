#!/usr/bin/python

import sys
import csv
import os
import re
import time
from multiprocessing import Pool
from collections import Counter
from requests import get
import spacy


#Started trying to split this out into nicer small files
import compare
import pdf
import stopwords
from models import QnaDoc, QnaPair

def get_filename(row):
    leaflet_title = re.sub(r'[^\w]', ' ', row[1])
    name = "{0}_{1}.pdf".format(row[0], leaflet_title)
    filename = os.path.join(DATA_DIR, name)
    return filename

def get_item(row):
    filename = get_filename(row)
    print("Getting:{}".format(filename))
    # print filename
    if os.path.exists(filename):
        print("Already Exists {}".format(filename))
    else:
        with open(filename, "wb") as file:
            response = get(row[2])
            file.write(response.content)


def extract_keywords(text, number):
    text = text.replace('\n', ' ').replace('\r', ' ').replace('"', ' ').lower()
    text = re.sub(r'\d', ' ', text)
    text = re.sub(r'[^a-zA-Z0-9^\w\s \']', ' ', text)

    processed_text = nlp(text)
    #text = text.split(' ')
    words = []

    for word in processed_text:
        if not nlp.vocab[word.lemma_].is_stop and word.lemma_ != '' and not word.lemma_.isspace() and word.lemma_ != '-PRON-' and word.lemma_ != "'":
            words.append(word.lemma_)

    sorted_words = Counter(words)

    keywords = ""
    sorted_words = sorted_words.most_common(number)
    for word in sorted_words:
        keywords += "," + word[0]

    return keywords[1:]

def enrich_qna(qnadoc):
    allwords = ""

    for question in qnadoc.questions:
        question.addMetadata("keywords", extract_keywords(question.answer, 5))
        question.addMetadata("MedicalSubject", extract_keywords(question.question, 1))

        allwords += question.question
        allwords += question.answer

    qnadoc.addMetadata("keywords", extract_keywords(allwords, 10))

    return qnadoc

# Very basic!
def extract_questions(row):
    try:
        filename = get_filename(row)
        txt_filename = ("{}.txt".format(get_filename(row)))
        with open(txt_filename, 'rb') as text_file:
            txt = text_file.read()
            nlp_doc = nlp(txt.decode("utf8"))
            qnadoc = QnaDoc(row[0], row[1], row[2], filename)
            qnadoc.addMetadata("Created", time.strftime("%H:%M:%S %m/%d/%Y"))
            pair = QnaPair("Intro")
            for sent in nlp_doc.sents:
                if "?" in sent.text:
                    pair.addMetadata("EndPosition", str(sent.end))
                    qnadoc.addPair(pair)
                    pair = QnaPair(sent.text)
                    pair.addMetadata("StartPosition", str(sent.start))
                else:
                    pair.addAnswerText(sent.text)           
            qnadoc = enrich_qna(qnadoc)
            print("Extracted qs for:", txt_filename)
            return qnadoc
    except FileNotFoundError as inst:
        text_file = filename.split('/')
        print("Error: File not found:", text_file[-1])
        return None
    except Exception as inst:
        print(inst)
        return None

def findSimilarQuestions(doclist, simans=None, simdoc=None):
    completed = set()
    for qnadoc in doclist:
        for otherdoc in doclist:
            if qnadoc is None or otherdoc is None:
                continue
            combinded_name = ''.join(sorted([qnadoc.name, otherdoc.name]))
            if combinded_name in completed:
                continue
            completed.add(combinded_name)
            if qnadoc.name == otherdoc.name:
                continue
            if simdoc is not None:
                simdoc(qnadoc, otherdoc)
            if simans is None:
                continue
            else:
                for question in qnadoc.questions:
                    for otherquestion in otherdoc.questions:
                        simans(qnadoc, otherdoc, question, otherquestion)


print("Getting started!")

nlp = spacy.load('en')

STOPWORD_URL = "https://qnageneratorstorage.blob.core.windows.net/stopwords/customStopwords.txt"
stopwords.populate_stopwords(nlp, STOPWORD_URL)

DATA_DIR = os.environ["PDATA_DIR"]
print(str.format("Using data dir:{}", DATA_DIR))

f = open(os.path.join(DATA_DIR, 'PDFs.csv'))
reader = csv.reader(f, 'excel')
rows = list(reader)

filenames = [get_filename(row) for row in rows]

p = Pool(4)
try:
    p.map(get_item, rows)
    p.map(pdf.extract_text, filenames)
    docs = p.map(extract_questions, rows)
    findSimilarQuestions(docs, simdoc=compare.compare_doc_keywords)    
    for doc in docs:
        if doc is None:
            continue
        doc.saveJson()

except KeyboardInterrupt:
        # **** THIS PART NEVER EXECUTES. ****
    p.terminate()
    print("You cancelled the program!")
    sys.exit(1)




print("Done")