module.exports = function (context, myblob) {
    context.log("data.toString()");
        const { spawn } = require('child_process');
        //const bat = exec('cmd.exe', ['D:\home\site\wwwroot\BlobTriggerJS1\pdftotext.exe -h']);
    var cp = spawn(process.env.comspec, ['/c', 'D:\home\site\wwwroot\BlobTriggerJS1\pdftotext.exe', '-arg1', '-arg2']);
    
    cp.stdout.on("data", function(data) {
        context.log(data.toString());
        context.done();
    });
    
    cp.stderr.on("data", function(data) {
        context.log(data.toString());   context.done();
    });
    
    };