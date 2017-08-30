#!/usr/bin/python

"""Preprocesses PDF document(s) and enriches with further information
    (e.g. keywords, similar documents...) to aid in search"""

import sys
import csv
import os
import re
import time
from multiprocessing import Pool
from requests import get
import spacy

#Started trying to split this out into nicer small files
import compare
import pdf
import stopwords
import keywords

from models import QnaDoc, QnaPair

DATA_DIR = os.environ["PDATA_DIR"]
STOPWORD_URL = "https://qnageneratorstorage.blob.core.windows.net/stopwords/customStopwords.txt"
NLP = spacy.load('en')

def _get_filename(row):
    leaflet_title = re.sub(r'[^\w]', ' ', row[1])
    name = "{0}_{1}.pdf".format(row[0], leaflet_title)
    filename = os.path.join(DATA_DIR, name)
    return filename

def _get_item(row):
    filename = _get_filename(row)
    print("Getting:{}".format(filename))

    if os.path.exists(filename):
        print("Already Exists {}".format(filename))
    else:
        with open(filename, "wb") as file:
            response = get(row[2])
            file.write(response.content)

def _matches_main_doc_subject(subject, doc_name):
    return subject == '' or subject.isspace()\
        or subject in doc_name or subject.lower() == "intro"

def _get_question_subject(question, doc_name):
    question_subject = keywords.extract_keywords(NLP, question, 1)

    if _matches_main_doc_subject(question_subject, doc_name):
        question_subject = doc_name
    elif "complication" in question_subject or "complication" in question:
        question_subject = "complications of " + doc_name
    return question_subject

def _enrich_qna(qnadoc):
    allwords = ""

    for qna_pair in qnadoc.qnaList:
        qna_pair.add_metadata("keywords", keywords.extract_keywords(NLP, qna_pair.answer, 5))

        subject = _get_question_subject(qna_pair.questions[0], qnadoc.name.lower())
        qna_pair.add_metadata("subject", subject)

        allwords += qna_pair.questions[0]
        allwords += qna_pair.answer

    qnadoc.add_metadata("keywords", keywords.extract_keywords(NLP, allwords, 10))

    return qnadoc

# Very basic!
def _extract_questions(row):
    try:
        filename = _get_filename(row)
        txt_filename = ("{}.txt".format(_get_filename(row)))

        with open(txt_filename, 'rb') as text_file:
            txt = text_file.read()
            nlp_doc = NLP(txt.decode("utf8"))
            qnadoc = QnaDoc(row[0], row[1], row[2], filename)
            qnadoc.add_metadata("Created", time.strftime("%H:%M:%S %m/%d/%Y"))
            pair = QnaPair("Intro", qnadoc.source)

            for sent in nlp_doc.sents:
                if "?" in sent.text:
                    pair.add_metadata("EndPosition", str(sent.end))
                    qnadoc.add_pair(pair)
                    pair = QnaPair(sent.text, qnadoc.source)
                    pair.add_metadata("StartPosition", str(sent.start))
                else:
                    pair.add_answer_text(sent.text)
            qnadoc = _enrich_qna(qnadoc)

            print("Extracted qs for:", txt_filename)
            return qnadoc

    except FileNotFoundError:
        text_file = filename.split('/')
        print("Error: File not found:", text_file[-1])
        return None

def _find_similar_questions(doclist, simans=None, simdoc=None):
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
                for question in qnadoc.qnaList:
                    for otherquestion in otherdoc.qnaList:
                        simans(qnadoc, otherdoc, question, otherquestion)

def preprocess_docs():
    """Take in raw PDFs, extract Q&A pairs, enrich with metadata and
        produce JSON file ready for upload to QnA Maker"""

    print("Getting started!")
    stopwords.populate_stopwords(NLP, STOPWORD_URL)

    print(str.format("Using data dir:{}", DATA_DIR))

    csv_file = open(os.path.join(DATA_DIR, 'PDFs.csv'))
    reader = csv.reader(csv_file, 'excel')
    rows = list(reader)

    filenames = [_get_filename(row) for row in rows]

    pool = Pool(4)

    try:
        pool.map(_get_item, rows)
        pool.map(pdf.extract_text, filenames)
        docs = pool.map(_extract_questions, rows)

        _find_similar_questions(docs, simdoc=compare.compare_doc_keywords)

        for doc in docs:
            if doc is None:
                continue
            doc.save_json()

    except KeyboardInterrupt:
        pool.terminate()
        print("You cancelled the program!")
        sys.exit(1)

    print("Done")

if __name__ == '__main__':
    preprocess_docs()
