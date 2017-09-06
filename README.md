# Broad Contextual QnA Bot and Document Ingest pipeline

## Why was this made?

We saw a number of customers with a large volume of existing QnA material, thousands of documents with hundreds of questions. 

Issues seen with this workload:

* Currently QnAMaker isn't able to scale to this volume of questions.
* With a large number of documents covering diverse topics the lack of context, between sequential questions, caused a poor user experience.
* Document parsing in QnA maker was sometimes hit and miss, depending on the formatting.

## When would this be useful?

If you have:

* A large number of QnA based documents (100-1000s)
* Would like to do custom preprocessing before or after question/answer extration

## Proposed solution

We attempted to ingest this large quantity of documents and process them to create a simple Knowledge graph of documents and questions, with relations, which could be used to create a QnA bot capable of answering questions from a broad range of questions.

| Stage         | Purpose                                                                                  | Tech                    | Status                  | Folders |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------- | ----------------------- |-------------|
| Preprocessing | Extract Question-Answer pairs from documents, fixup text and extract additional metadata | Python, Spacy, PDFMiner | Early workable solution | /python |
| Ingest        | Upload Json output from Preprocessor to QnAMaker + Azure Search then create a mapping table    | Javascript              | Working                 | /qnamaker & /azuresearch |
| Bot Interface | Enable broad searching with context by combinding Azure search and QnAMaker output       | Javascript, BotBuilder  | Completed               | /qnabot |

## User interaction

Users are able to start a conversation with a top level question and future questions, the document selected for this question then becomes they're context. Future questions are scored in this context until a low scoring result is found. At which point other documents are consulted and the results are presented to the user. 

The rough flow is as follows:

```
+-----------------------------+
|  Question:                  |-------> ? Per-question ?
|  What is x condition?       |         Spell checking Middleware using Bing API
+------------+----------------+ <------ to correct mispellings.
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
                                |  answers, along with their context  |
                                |  and offered a choice.              |
                                |                                     |
                                |  Results fed back into QnA maker    |
                                |  for training the models.           |
                                +-------------------------------------+
```

## Outstanding work

* Greater use of NLP in question extraction and document processing. 
* Complete testing of continuous process for processing document updates. 
* Assistive review process, flagging question or answers which seem to be anomalous for human review. 
* Integration with Ibex analytics dashboard to create an overview of document populatarity, hit rate, top unanswerable questions etc. 