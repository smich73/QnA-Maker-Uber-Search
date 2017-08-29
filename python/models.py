"""Models for QnA Maker QnAs"""

import json

class QnaDoc:
    """Parent model for all QnA documents"""

    def __init__(self, docId, name, url, filename):
        self.id = docId
        self.name = name
        self.url = url
        self.filename = filename
        self.questions = list()
        self.metadata = {}
        self.related = list()

    def add_pair(self, pair):
        """Add QnA pair to parent doc"""

        self.questions.append(pair)

    def save_json(self):
        """Save QnA document as JSON"""

        jsonfn = "{}.json".format(self.filename)
        print("Saving json to:", jsonfn)
        filepath = open(jsonfn, "w")
        return json.dump(self.__dict__, filepath, default=encode_qna_pair)

    def add_metadata(self, key, value):
        """Add metadata to the QnA document"""

        self.metadata[key] = value

    def add_related_doc(self, relatedqna, count, commmonwords):
        """Add related document info to the current QnA document"""

        self.related.append(_RelatedDoc(relatedqna, count, commmonwords))

class _RelatedDoc:
    def __init__(self, qnadoc, count, commmonwords):
        self.id = qnadoc.id
        self.name = qnadoc.name
        self.url = qnadoc.url
        self.count = count
        self.commmonwords = commmonwords

class QnaPair:
    """Represents a single QnA pair, along with metadata"""

    def __init__(self, question):
        self.question = question
        self.answer = ""
        self.source = ""
        self.metadata = {}

    def add_answer_text(self, text):
        """Add answer text to QnA"""

        self.answer += text

    def add_metadata(self, key, value):
        """Add metadata to QnA"""

        self.metadata[key] = value

def encode_qna_pair(obj):
    """Encode QnA pair"""

    #Todo: Add code to ignore questionnlp field
    return obj.__dict__
