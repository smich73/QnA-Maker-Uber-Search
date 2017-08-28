"""Extract keywords from text"""

import urllib.request
import re
from collections import Counter
import spacy

def is_word(nlp, word):
    """Return true if specified string is a word (i.e. not an empty string, punctuation etc.)"""
    return not nlp.vocab[word.lemma_].is_stop and word.lemma_ != ''\
        and not word.lemma_.isspace() and word.lemma_ != '-PRON-' and word.lemma_ != "'"

def extract_keywords(nlp, text, number_to_return):
    """Return array of the top N words from a string"""
    text = text.replace('\n', ' ').replace('\r', ' ').replace('"', ' ').lower()
    text = re.sub(r'\d', ' ', text)
    text = re.sub(r'[^a-zA-Z0-9^\w\s \']', ' ', text)

    processed_text = nlp(text)
    words = []

    for word in processed_text:
        if is_word(nlp, word):
            words.append(word.lemma_)

    sorted_words = Counter(words)

    keywords = ""
    sorted_words = sorted_words.most_common(number_to_return)
    for word in sorted_words:
        keywords += "," + word[0]

    return keywords[1:]
