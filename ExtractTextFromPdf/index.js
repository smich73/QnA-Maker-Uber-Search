module.exports = function (context, myBlob) {
    context.log("Trigger from git \n Name:", context.bindingData.name, "\n Blob Size:", myBlob.length, "Bytes");
    context.done();
};