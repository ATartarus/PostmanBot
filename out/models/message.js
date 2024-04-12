"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Message {
    constructor(user_id, body, subject, img_id) {
        this.user_id = user_id;
        this.body = body;
        this.subject = subject;
        this.img_id = img_id;
    }
}
exports.default = Message;
