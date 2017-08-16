var extractTextFromPdf = require("./ExtractTextFromPDF");

var context = {
    log : function(text)
    {
        console.log(text);
    },
    done : function(){
        console.log("The function is done apparently");
    },
    bindingData : {
        name : "test payload"
    }
}

var myBlob = {
    length : 12345
}

var response = extractTextFromPdf(context, myBlob);