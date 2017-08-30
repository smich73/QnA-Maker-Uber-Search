"""Models for QnA Maker QnAs"""

import json



class QnaDoc:
    """Parent model for all QnA documents, including QnA pairs, source information,
        metadata and related documents"""

    def __init__(self, docId, name, source, filename):
        self.id = docId
        self.name = name
        self.source = source
        self.filename = filename
        self.qnaList = list() # Non-standard attribute name required by QnA Maker API
        self.metadata = {}
        self.related = list()
        self.allquestions = list()

    def add_pair(self, pair):
        """Add QnA pair to parent document"""
        self.qnaList.append(pair)      
        for question in pair.questions:
            self.allquestions.append(question)

    def save_json(self):
        """Save QnA document as JSON file"""

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
        self.source = qnadoc.source
        self.count = count
        self.commmonwords = commmonwords

class _QuestionMetaDataPair:
    def __init__(self, key, value):
        self.name = key
        self.value = value

class QnaPair:
    """Represents a single QnA pair, along with metadata"""

    def __init__(self, question, source):
        self.questions = list()
        self.answer = ""
        self.source = source
        self.metadata = list()
        self.questions.append(question)

    def add_answer_text(self, text):
        """Add answer text to QnA"""

        self.answer += text

    def add_metadata(self, key, value):
        """Add metadata to QnA"""
        self.metadata.append(_QuestionMetaDataPair(key, value))

def encode_qna_pair(obj):
    """Encode QnA pair"""

    #Todo: Add code to ignore questionnlp field
    return obj.__dict__
