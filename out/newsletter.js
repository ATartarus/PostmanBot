"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterProperty = exports.newsletterPool = void 0;
exports.newsletterPool = [];
class Newsletter {
    constructor(userId) {
        this.messages = [];
        this.bots = [];
        this.receivers = [];
        this.userId = userId;
    }
    isValid() {
        return this.messages.length > 0 && this.bots.length > 0 && this.receivers.length > 0;
    }
    getUserId() {
        return this.userId;
    }
}
exports.default = Newsletter;
var NewsletterProperty;
(function (NewsletterProperty) {
    NewsletterProperty["Messages"] = "messages";
    NewsletterProperty["Bots"] = "bots";
    NewsletterProperty["Receivers"] = "receivers";
})(NewsletterProperty || (exports.NewsletterProperty = NewsletterProperty = {}));
