function getDiff(existingQnA, newQnA) {

    if (newQnA.qnaList.length > 0) {
        // Compare QnAs and create update JSON for POST to QnA Maker API
        var diff = require('deep-diff').diff;

        // Add 'Editorial' QnA created by the QnA Maker service to ensure parity
        if (newQnA.qnaList[0].source !== "Editorial") {
            newQnA.qnaList.unshift({
                "qnaId": 1,
                "answer": "Hello",
                "source": "Editorial",
                "questions": ["Hi"],
                "metadata": []
            });
        }

        var differences = diff(existingQnA, newQnA);

        // Schema from https://westus.dev.cognitive.microsoft.com/docs/services/597029932bcd590e74b648fb/operations/5970428523618c05e45ab128
        var patch = {
            "add": {
                "qnaList": [],
                "urls": [],
                "users": []
            },
            "delete": {
                "qnaIds": [],
                "sources": [],
                "users": []
            },
            "update": {
                "name": newQnA.name,
                "qnaList": [],
                "urls": []
            }
        };
        var blankPatch = JSON.stringify(patch);

        for (var i = 0; i < differences.length; i++) {
            var change = differences[i];
            // Add new question
            if (change.kind === "A" && change.item.kind === "N" && change.path[0] === "qnaList" && change.path.length === 1) {
                patch.add.qnaList.push(change.item.rhs);
            }
            // Delete question
            if (change.kind === "A" && change.item.kind === "D" && change.path[0] === "qnaList" && change.path.length === 1) {
                patch.delete.qnaIds.push(change.item.lhs.qnaId);
            }
            // Modify existing questions in a QnA set
            if (change.kind === "A" && change.item.kind === "E" && change.path[0] === "qnaList" && change.path[2] === "questions") {
                patch.update.qnaList.push({
                    "qnaId": newQnA.qnaId,
                    "answer": newQnA.answer,
                    "source": newQnA.source,
                    "questions": {
                        "add": change.item.rhs,
                        "delete": change.item.lhs
                    },
                    "metadata": {}
                });
            }
            // Modify existing metadata in a QnA set
            if (change.kind === "A" && change.item.kind === "E" && change.path[0] === "qnaList" && change.path[2] === "metadata") {
                patch.update.qnaList.push({
                    "qnaId": newQnA.qnaId,
                    "answer": newQnA.answer,
                    "source": newQnA.source,
                    "questions": {},
                    "metadata": {
                        "add": change.item.rhs,
                        "delete": change.item.lhs
                    }
                });
            }
        }
        if (JSON.stringify(patch) === blankPatch) {
            return "No change";
        }
        else {
            return patch;
        }
    }
    else {
        console.log("QnA has no data. Deleting KB.");
        qnaUtils.deleteQnA(newQnA);
    }
}

module.exports = {
    getDiff: getDiff
};