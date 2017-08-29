"""Return stopword list from file at URL"""

import urllib.request
import spacy

def populate_stopwords(nlp, stopword_url):
    """Return array of stopwords from a URL source"""

    stopwords = urllib.request.urlopen(stopword_url).read().decode("utf8")
    stopwords = stopwords.replace('"', '').replace('\n', '').split("\r")

    for line in stopwords:
        nlp.vocab[line].is_stop = True

    return stopwords
