module.exports = function (context, myBlob) {
    var fs = require('fs');
    var workingDirectory = "D:\\home\\site\\wwwroot\\"

    context.log("Trigger from git \n Name:", context.bindingData.name, "\n Blob Size:", myBlob.length, "Bytes");
     const { spawn } = require('child_process');
    //const bat = exec('cmd.exe', ['D:\home\site\wwwroot\BlobTriggerJS1\pdftotext.exe -h']);

    fs.writeFile(workingDirectory + "sample.pdf", myBlob, function (err) {
        if (err) return context.log(err); context.done();
        context.log('File Written');
        child_process.execSync("sleep 5");
        context.log('Woke Sleep');
    var cp = spawn(process.env.comspec, ['/c', `${workingDirectory}pdftotext.exe -nodiag ${workingDirectory}sample.pdf ${workingDirectory}sample.txt`]);

    cp.stdout.on("data", function(data) {
        var str = "Out: " + data.toString();
        context.log(str);       
    });

    cp.stderr.on("data", function(data) {
        var str = "Error: " + data.toString();
        context.log(str);
    });

    cp.on('close', (code) => {
        context.log(`child process exited with code ${code}`);
        
        var array = fs.readFileSync(`${workingDirectory}sample.txt`).toString().split("\n");
        for(i in array) {
            context.log(array[i]);
        }
       
        context.done();
      });

    });
};