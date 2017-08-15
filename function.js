module.exports = function (context, myBlob) {
    context.log("JavaScript blob trigger function processed blob \n Name:", context.bindingData.name, "\n Blob Size:", myBlob.length, "Bytes");


var pdftotext = require('pdftotextjs'),
    pdf = new pdftotext('sample1.pdf');
 
pdf.getText(function(err, data, cmd) {
  if (err) {
    console.error(err);
context.log(err);
}
  else {
    context.log(data);
    // additionally you can also access cmd array
    // it contains params which passed to pdftotext ['filename', '-f', '1', '-l', '1', '-']
    //console.log(cmd.join(' '));
  }
    context.done();
});

};