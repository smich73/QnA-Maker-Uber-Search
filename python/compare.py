import spacy

def compare_word_vec(qnadoc, otherdoc, question, otherquestion):
    nlp = spacy.load('en')
    qnlp = nlp(qnadoc.name +" "+ question.question)
    oqnlp = nlp(otherdoc.name +" "+ otherquestion.question)

    similarity = qnlp.similarity(oqnlp)
    if similarity > 0.95:
        print(qnadoc.name, ":", qnlp.text)
        print(otherdoc.name, ":", oqnlp.text)
        print(similarity)

def compare_answer_keywords(qnadoc, otherdoc, question, otherquestion):
    """Compare answer keywords"""
    keywords = question.metadata["keywords"].split(',')
    other_keywords = otherquestion.metadata["keywords"].split(',')
    results = set(keywords).intersection(other_keywords)
    if len(results) > 1:
        print(qnadoc.name, ":", question.question)
        print(otherdoc.name, ":", otherquestion.question)
        print("Shared Keywords:",len(results),list(results))

def compare_doc_keywords(qnadoc, otherdoc):
    """Compare document keywords"""
    keywords = qnadoc.metadata["keywords"].split(',')
    other_keywords = otherdoc.metadata["keywords"].split(',')

    results = set(keywords).intersection(other_keywords)
    count = len(results)
    if count > 2:
        print(qnadoc.name, keywords)
        print(otherdoc.name, other_keywords)
        print("Shared Keywords:",len(results),list(results))
        qnadoc.addRelatedDoc(otherdoc, count, ','.join(results))
        otherdoc.addRelatedDoc(qnadoc, count, ','.join(results))
