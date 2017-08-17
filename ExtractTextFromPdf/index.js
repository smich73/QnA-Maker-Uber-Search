module.exports = function (context, myBlob, ...additional) {
    var fs = require('fs');
    var workingDirectory = "D:\\home\\site\\wwwroot\\"
    var tempFileName = "temp3213231.pdf";
    var tempOutputFileName = "temp3213231.txt"
    if (additional.length > 0){
        var workingDirectory = additional[0];
    }

    context.log("Trigger from git \n Name:", context.bindingData.name, "\n Blob Size:", myBlob.length, "Bytes");
     const { spawn } = require('child_process');
    //const bat = exec('cmd.exe', ['D:\home\site\wwwroot\BlobTriggerJS1\pdftotext.exe -h']);

    fs.writeFile(workingDirectory + "sample.pdf", myBlob, function (err) {
        if (err) {return 
            context.log("Failed"); 
            context.log(err); 
            context.done();
        }
        
        context.log('File Written');
        
        context.log('Sending Command');
        var cp = spawn(process.env.comspec, ['/c', `${workingDirectory}pdftotext.exe -nodiag ${workingDirectory}${tempFileName} ${workingDirectory}${tempOutputFileName}`]);

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
            
            var array = fs.readFileSync(`${workingDirectory}${tempOutputFileName}`).toString().split("\n");
            for(i in array) {
                context.log(array[i]);
            }
        
            context.done();
        });

        context.log('Closing?');
    });
};