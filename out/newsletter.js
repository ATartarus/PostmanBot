"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterProperty = void 0;
class Newsletter {
    constructor() {
        this.messages = [];
        this.bots = [];
        this.receivers = [];
    }
    isValid() {
        return this.messages.length > 0 && this.bots.length > 0 && this.receivers.length > 0;
    }
}
exports.default = Newsletter;
var NewsletterProperty;
(function (NewsletterProperty) {
    NewsletterProperty["Messages"] = "messages";
    NewsletterProperty["Bots"] = "bots";
    NewsletterProperty["Receivers"] = "receivers";
})(NewsletterProperty || (exports.NewsletterProperty = NewsletterProperty = {}));
