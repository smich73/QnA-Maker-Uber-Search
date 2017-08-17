var extractTextFromPdf = require("./ExtractTextFromPdf");
var convertTextToQuestions = require("./ConvertTextToQuestions");

var context = {
    log : function(...text)
    {
    
        // If you would like to see what the function is logging then uncomment below
        //console.log(...text);
        this.logArray.push(...text);
      
    },
    done : function(){
        //console.log("The function is done apparently");
        this.finished();
    },
    bindingData : {
        name : 'Beebs'
    },
    logArray : [],
    logContains : function(textToFind){
        var found = false;
        for (var index = 0; index < this.logArray.length; index++) {
            var element = this.logArray[index];
            if (element == textToFind){
                found = true;
            }            
        }
       return found;
    }
}

var myBlob = {
    length : 12345
}
exports.testSomething = function(test) {
    test.expect(1);
    test.ok(true, "this assertion should pass");
    test.done();
};

exports.testSomethingElse = function(test) {
    test.ok(false, "this assertion should fail");
    test.done();
};

exports.testExtractTextFromPDF = function(test) {
    var fs = require('fs');
    fs.readFile('anxiety.pdf', function(err, myBlob) {
        var response = extractTextFromPdf(context, myBlob, "");

        context.finished = function(){
            test.ok(context.logContains("File Written as UTF8"), "The File Wasn't written as UTF8 ");
            //test.ok(context.logContains("It Worked"), "The function did not report that it worked");
            test.done();
        }
    });
};

// The text has 2 questions
`
Officia consectetur quis reprehenderit nostrud in consequat eu ad est reprehenderit laboris. 
Lorem aliqua cupidatat aliqua ipsum duis nostrud quis labore aliquip labore. Ex labore ipsum occaecat eu nostrud anim tempor occaecat amet ullamco ex incididunt. Est anim pariatur irure aute nostrud ullamco officia magna Lorem tempor.

How much is that doggie in the window?
Anim eu deserunt ex irure velit aute id deserunt ea pariatur. Cillum tempor magna consectetur amet mollit veniam velit tempor fugiat sit tempor laboris. Velit ad eu non labore officia officia quis proident exercitation dolore. Labore tempor id enim commodo dolore sit. Aute fugiat id occaecat Lorem ut excepteur magna consectetur ipsum ut id.
Labore mollit sit nisi laborum culpa.

Does the parser
support questions over two lines?
Anim eu deserunt ex irure velit aute id deserunt ea pariatur. Cillum tempor magna consectetur amet mollit veniam velit tempor fugiat sit tempor laboris. Velit ad eu non labore officia officia quis proident exercitation dolore. Labore tempor id enim commodo dolore sit. Aute fugiat id occaecat Lorem ut excepteur magna consectetur ipsum ut id.
Labore mollit sit nisi laborum culpa.

`

exports.testConvertTextToQuestions = function(test) {  
    convertTextToQuestions(context, myBlob, "")
    test.ok(context.logContains("There are 2 questions"), "Not enough questions were found");
    test.ok(context.logContains("Question: How much is that doggie in the window?"), "The 1st question was not found ");
    test.ok(!context.logContains("Question: support questions over two lines?"), "The parser is not finding questions that span two lines");
    test.ok(context.logContains("Question: Does the parser support questions over two lines?"), "The 2nd question was not found ");
    test.done();
};



