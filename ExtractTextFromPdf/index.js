module.exports = function (context, myBlob) {
    context.log("Trigger from git \n Name:", context.bindingData.name, "\n Blob Size:", myBlob.length, "Bytes");
     const { spawn } = require('child_process');
    //const bat = exec('cmd.exe', ['D:\home\site\wwwroot\BlobTriggerJS1\pdftotext.exe -h']);
    var cp = spawn(process.env.comspec, ['/c', 'pdftotext.exe -nodiag sample.pdf sample.txt']);

    cp.stdout.on("data", function(data) {
        var str = "Out: " + data.toString();
        context.log(str);
        context.done();
        
    });

    cp.stderr.on("data", function(data) {
        var str = "Error: " + data.toString();
        context.log(str);

        context.done();
    });

    cp.on('close', (code) => {
        context.log(`child process exited with code ${code}`);
        var fs = require('fs');
        var array = fs.readFileSync('sample.txt').toString().split("\n");
        for(i in array) {
            context.log(array[i]);
        }
       
        context.done();
      });
};