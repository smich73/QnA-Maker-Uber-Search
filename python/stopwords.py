import spacy
import urllib.request

def get_text_from_url(url):
    return urllib.request.urlopen(url).read().decode("utf8")

def populate_stopwords(nlp, stopwordURL):
    stopwords = get_text_from_url(stopwordURL)
    stopwords = stopwords.replace('"', '').replace('\n', '').split("\r")

    for line in stopwords:
        nlp.vocab[line].is_stop = True

    return stopwords