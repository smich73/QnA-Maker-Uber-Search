"""Get stopword list from URL location"""

import urllib.request
import spacy

def get_text_from_url(url):
    """Return text from UTF8 doc found at the specified URL"""

    return urllib.request.urlopen(url).read().decode("utf8")

def populate_stopwords(nlp, stopword_url):
    """Return array of stopwords from a URL source"""

    stopwords = get_text_from_url(stopword_url)
    stopwords = stopwords.replace('"', '').replace('\n', '').split("\r")

    for line in stopwords:
        nlp.vocab[line].is_stop = True

    return stopwords
