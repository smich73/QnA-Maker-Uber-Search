const search = require('azure-search-client')


const config = {
    searchName: process.env.SEARH_NAME,
    key: process.env.SEARCH_KEY,
    blobConnectionString: process.env.BLOB_CONN_STRING,
    blobContainer: 'json2',
    datasourceName: 'jsonblobstore2',
    indexName: 'jsondataindex2',
    indexerName: 'jsondataindexer2'
}

const client = new search.SearchClient(config.searchName, config.key)


function setupSearch() {
    let datasource = {
        name:  config.datasourceName,
        type: "azureblob",
        credentials: { connectionString: config.blobConnectionString },
        container: { name: config.blobContainer }
    }

    client.createDatasource(datasource, (err, res) => {
        if (err) {
            throw err
        }

        let index = {
            name: config.indexName,
            fields: [
                { name: "source", type: "Edm.String", key: true},
                { name: "name", type: "Edm.String" },
                { name: "keywords", type: "Edm.String", sortable: false },
                { name: "questions", type: "Edm.String", sortable: false },

            ]
        }

        client.createIndex(index, (err, res) => {
            if (err) {
                throw err
            }

            createIndexer()
        })

    })
}

function createIndexer() {
    let indexer = {
        name: config.indexerName,
        dataSourceName: config.datasourceName,
        targetIndexName: config.indexName,
        schedule: {
            interval: "PT2H"
        },
        parameters: {
            configuration:
            {
                parsingMode: "json"
            }
        },
        fieldMappings: [
            { sourceFieldName: "/name", targetFieldName: "name" },
            { sourceFieldName: "/metadata/keywords", targetFieldName: "keywords" },
            { sourceFieldName: "/allquestions", targetFieldName: "questions" }
        ]
    }

    client.createIndexer(indexer, (err, res) => {
        if (err) {
            throw err
        }
        
        console.log(res)
    }) 
}

//setupSearch()
createIndexer()