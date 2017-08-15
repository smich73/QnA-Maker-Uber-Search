var pdftotext = require('pdftotextjs'),
    pdf = new pdftotext('sample1.pdf');
 
// Convert first page only
// These options will be passed to pdftotext
// You may use any valid option
 
pdf.getText(function(err, data, cmd) {
  if (err) {
    console.error(err);
}
  else {
    console.log(data);
    // additionally you can also access cmd array
    // it contains params which passed to pdftotext ['filename', '-f', '1', '-l', '1', '-']
    //console.log(cmd.join(' '));
  }
});