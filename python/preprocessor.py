#!/usr/bin/python

"""Preprocesses PDF document and enriches with further information to aid in search"""
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
import keywords

from models import QnaDoc, QnaPair

def get_filename(row):
    """Return filename of document constructed from index CSV"""
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

def enrich_qna(qnadoc):
    """Return doc with added metadata (document keywords as well as medical subject and
        answer keywords for each question)"""
    allwords = ""

    for question in qnadoc.questions:
        question.addMetadata("keywords", keywords.extract_keywords(NLP, question.answer, 5))
        question.addMetadata("MedicalSubject", keywords.extract_keywords(NLP, question.question, 1))

        allwords += question.question
        allwords += question.answer

    qnadoc.addMetadata("keywords", keywords.extract_keywords(NLP, allwords, 10))

    return qnadoc

# Very basic!
def extract_questions(row):
    """Return basic JSON doc with question/answer pairs and metadata e.g. source"""
    try:
        filename = get_filename(row)
        txt_filename = ("{}.txt".format(get_filename(row)))
        with open(txt_filename, 'rb') as text_file:
            txt = text_file.read()
            nlp_doc = NLP(txt.decode("utf8"))
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
    except FileNotFoundError:
        text_file = filename.split('/')
        print("Error: File not found:", text_file[-1])
        return None

def find_similar_questions(doclist, simans=None, simdoc=None):
    """Find similar questions in the document corpus"""
    completed = set()
    for qnadoc in doclist:
        for otherdoc in doclist:
            if qnadoc is None or otherdoc is None:
                continue
            combined_name = ''.join(sorted([qnadoc.name, otherdoc.name]))
            if combined_name in completed:
                continue
            completed.add(combined_name)
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

if __name__ == '__main__':
    print("Getting started!")

    DATA_DIR = os.environ["PDATA_DIR"]
    STOPWORD_URL = "https://qnageneratorstorage.blob.core.windows.net/stopwords/customStopwords.txt"
    NLP = spacy.load('en')

    stopwords.populate_stopwords(NLP, STOPWORD_URL)

    print(str.format("Using data dir:{}", DATA_DIR))

    csv_file = open(os.path.join(DATA_DIR, 'PDFs.csv'))
    reader = csv.reader(csv_file, 'excel')
    rows = list(reader)

    filenames = [get_filename(row) for row in rows]

    pool = Pool(4)
    try:
        pool.map(get_item, rows)
        pool.map(pdf.extract_text, filenames)
        docs = pool.map(extract_questions, rows)

        find_similar_questions(docs, simdoc=compare.compare_doc_keywords)
        for doc in docs:
            if doc is None:
                continue
            doc.saveJson()

    except KeyboardInterrupt:
            # **** THIS PART NEVER EXECUTES. ****
        pool.terminate()
        print("You cancelled the program!")
        sys.exit(1)

    print("Done")
