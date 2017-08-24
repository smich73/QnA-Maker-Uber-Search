import json

class QnaDoc:
    def __init__(self, docId, name, url, filename):
        self.id = docId
        self.name = name
        self.url = url
        self.filename = filename
        self.questions = list()
        self.metadata = {}
        self.related = list()
    
    def addPair(self, pair):
        self.questions.append(pair)
    
    def saveJson(self):
        jsonfn = "{}.json".format(self.filename)
        print("Saving json to:", jsonfn)
        fp = open(jsonfn, "w")
        return json.dump(self.__dict__, fp, default=encode_qnaPair)

    def addMetadata(self, k, v):
        self.metadata[k] = v

    def addRelatedDoc(self, relatedqna, count, commmonwords):
        self.related.append(RelatedDoc(relatedqna, count, commmonwords))

class RelatedDoc:
    def __init__(self, qnadoc, count, commmonwords):
        self.id = qnadoc.id
        self.name = qnadoc.name
        self.url = qnadoc.url
        self.count = count
        self.commmonwords = commmonwords

class QnaPair:
    def __init__(self, question):    
        self.question = question
        self.answer = ""
        self.source = ""
        self.metadata = {}

    def addAnswerText(self, text):
        self.answer += text

    def addMetadata(self, k, v):
        self.metadata[k] = v

def encode_qnaPair(obj):
    #Todo: Add code to ignore questionnlp field
    return obj.__dict__