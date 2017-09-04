
function top(arr, t) {
        if (t <= arr.length) {
            return arr.slice(0, t - 1);
        } else {
            return arr;
        }
}

module.exports = {
    top: top
}