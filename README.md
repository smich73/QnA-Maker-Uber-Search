# Broad Contextual QnA Bot and Document Ingestion pipeline

## Why was this made?

We saw a number of customers with a large volume of existing QnA material - thousands of documents with hundreds of questions. 

Issues seen with this workload:

* Currently QnA Maker isn't able to scale to this volume of questions.
* With a large number of documents covering diverse topics, the lack of context between sequential questions caused a poor user experience.
* Document parsing in QnA Maker was sometimes hit and miss, depending on the formatting.

## When would this be useful?

If you have:

* A large number of QnA based documents (100-1000s)
* Would like to do custom preprocessing before or after question/answer extraction

## Proposed solution

We attempted to ingest this large quantity of documents and process them to create a simple knowledge graph of documents and questions (with relations), which could be used to create a QnA bot capable of answering questions for a broad range of topics.

| Stage         | Purpose                                                                                  | Tech                    | Status                  | Folders |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------- | ----------------------- |-------------|
| Preprocessing | Extract Question-Answer pairs from documents, correct formatting errors and extract additional metadata | Python, Spacy, PDFMiner | Early workable solution | /python |
| Ingest        | Upload JSON output from preprocessor to QnAMaker + Azure Search then create a mapping table    | Javascript              | Working                 | /qnamaker & /azuresearch |
| Bot Interface | Enable broad searching with context by combining Azure search with the QnA Maker output       | Javascript, BotBuilder  | Completed               | /qnabot |

## User interaction

Users are able to start a conversation with a top level question. The document returned for this question then becomes their context. Future questions are scored in this context until a low scoring result is found, at which point other documents are consulted and the results are presented to the user. 

The rough flow is as follows:

```
+-----------------------------+
|  Question:                  |-------> ? Per-question ?
|  What is x condition?       |         Middleware used to correct mispellings in
+------------+----------------+ <------ input using the Bing Spell Check API
             |
             |
             |
             v
+------------+----------------+
| Azure Search queried to find|
| relevant documents.         |
|                             |
| QnA Maker used to score     |
| question against top docs   |
+------------+----------------+
             |
             |
             v
+------------+----------------+
| Follow up question:         |
| How is it treated?          |
+----+-----------------------++
     ^                       |
     |                       |
     |                       v
     |             +---------+------------+
     |             | Current context used |
     |             | to score question    |
     |             +----------------------+
     |             |                      |
     |  IF high score                 IF low score
     |             |                      +
     |             v                      |
   +-+-------------+--+         +---------+---------------------------+
   | Answer presented.|         |  Azure Search queried to            |
   | Loop for further qs        |  find relevant docs.                |
   +------------------+         |                                     |
                                |  Top results and current context    |
                                |  scored in QnA maker.               |
                                |                                     |
                                |  User presented with top scoring    |
                                |  answers along with their context  |
                                |  and offered a choice.              |
                                |                                     |
                                |  Results fed back into QnA maker    |
                                |  for training the models.           |
                                +-------------------------------------+
```

## Outstanding work

* More sophisticated use of NLP for question extraction and document processing. 
* Complete testing of continuous processing for document updates. 
* Assistive review process: flagging apparently anomalous questions/answers for human review. 
* Integration with Ibex analytics dashboard to create an overview of document popularity, hit rate, top unanswerable questions etc. 