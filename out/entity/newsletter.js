"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterResult = void 0;
const errors_1 = require("../misc/errors");
class Newsletter {
    constructor(userId) {
        this.userId = userId;
    }
    getUserId() {
        return this.userId;
    }
    initLog(length) {
        this.log = new Int8Array(length);
    }
    setLogResult(receiver, result) {
        if (!this.log)
            throw new errors_1.InternalError("Call initLog before setLogResult");
        this.log[receiver] = result;
    }
    getBriefLog() {
        var _a;
        if (!this.log)
            throw new errors_1.InternalError("Call initLog before getBriefLog");
        const success = (_a = this.log) === null || _a === void 0 ? void 0 : _a.reduce((total, current) => total += (current == NewsletterResult.Succeeded) ? 1 : 0, 0);
        return {
            total: this.log.length,
            success: success,
            fail: this.log.length - success
        };
    }
}
exports.default = Newsletter;
var NewsletterResult;
(function (NewsletterResult) {
    NewsletterResult[NewsletterResult["Failed"] = 0] = "Failed";
    NewsletterResult[NewsletterResult["Succeeded"] = 1] = "Succeeded";
})(NewsletterResult || (exports.NewsletterResult = NewsletterResult = {}));
//# sourceMappingURL=newsletter.js.map