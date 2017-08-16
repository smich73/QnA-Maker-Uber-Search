module.exports = function (context, myBlob) {
    var fs = require('fs');

    context.log("Trigger from git \n Name:", context.bindingData.name, "\n Blob Size:", myBlob.length, "Bytes");
     const { spawn } = require('child_process');
    //const bat = exec('cmd.exe', ['D:\home\site\wwwroot\BlobTriggerJS1\pdftotext.exe -h']);

    fs.writeFile(myBlob.name, myBlob, function (err) {
        if (err) return context.log(err); context.done();
        context.log('File Written');

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
        
        var array = fs.readFileSync('sample.txt').toString().split("\n");
        for(i in array) {
            context.log(array[i]);
        }
       
        context.done();
      });

    });
};