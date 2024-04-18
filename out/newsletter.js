"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterResult = exports.NewsletterProperty = exports.newsletterPool = void 0;
exports.newsletterPool = new Map();
class Newsletter {
    constructor(userId) {
        this.messages = new Set();
        this.bots = new Set();
        this.receivers = new Set();
        this.log = [];
        this.userId = userId;
    }
    isValid() {
        return this.messages.size > 0 && this.bots.size > 0 && this.receivers.size > 0;
    }
    getUserId() {
        return this.userId;
    }
    addLogEntry(botInd, messageInd, receiverListInd, length) {
        const size = process.env.MAX_COLLECTION_DOCUMENTS || 9;
        this.log[botInd * +size * +size + messageInd * +size + receiverListInd] = new Int8Array(length);
    }
    setLogResult(botInd, messageInd, receiverListInd, receiver, result) {
        const size = process.env.MAX_COLLECTION_DOCUMENTS || 9;
        this.log[botInd * +size * +size + messageInd * +size + receiverListInd][receiver] = result;
    }
    getBriefLog() {
        let success = 0, fail = 0;
        for (let listInd = 0; listInd < this.log.length; listInd++) {
            if (!this.log[listInd])
                continue;
            for (let recInd = 0; recInd < this.log[listInd].length; recInd++) {
                if (this.log[listInd][recInd] == NewsletterResult.Succeeded) {
                    success++;
                }
                else {
                    fail++;
                }
            }
        }
        return {
            total: this.log.reduce((total, list) => total += (list) ? list.length : 0, 0),
            success: success,
            fail: fail
        };
    }
}
exports.default = Newsletter;
var NewsletterProperty;
(function (NewsletterProperty) {
    NewsletterProperty["Bots"] = "bots";
    NewsletterProperty["Messages"] = "messages";
    NewsletterProperty["Receivers"] = "receivers";
})(NewsletterProperty || (exports.NewsletterProperty = NewsletterProperty = {}));
var NewsletterResult;
(function (NewsletterResult) {
    NewsletterResult[NewsletterResult["Failed"] = 0] = "Failed";
    NewsletterResult[NewsletterResult["Succeeded"] = 1] = "Succeeded";
    NewsletterResult[NewsletterResult["PartiallySucceded"] = 2] = "PartiallySucceded";
})(NewsletterResult || (exports.NewsletterResult = NewsletterResult = {}));
//# sourceMappingURL=newsletter.js.map