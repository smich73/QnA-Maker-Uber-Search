var extractTextFromPdf = require("./ExtractTextFromPDF");

var context = {
    log : function(...text)
    {
    
        console.log(...text);
      
    },
    done : function(){
        console.log("The function is done apparently");
    },
    bindingData : {
        name : 'Beebs'
    }
}

var myBlob = {
    length : 12345
}

var fs = require('fs');
fs.readFile('anxiety.pdf', function(err, myBlob) {
    var response = extractTextFromPdf(context, myBlob);
});

