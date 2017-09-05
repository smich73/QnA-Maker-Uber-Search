
function top(arr, t) {
        if (t <= arr.length) {
            return arr.slice(0, t - 1);
        } else {
            return arr;
        }
}

function decodeASCII(str) {
    return str.replace(/&#([0-9]{1,7});/g, function (g, m1) {
        return String.fromCharCode(parseInt(m1, 10));
    }).replace(/&#[xX]([0-9a-fA-F]{1,6});/g, function (g, m1) {
        return String.fromCharCode(parseInt(m1, 16));
    });
}

module.exports = {
    top: top,
    decodeASCII: decodeASCII
};