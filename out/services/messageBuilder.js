"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillMessageBuilder = exports.messageAwaitTime = exports.messageBuilderPool = void 0;
const message_1 = __importDefault(require("../models/message"));
exports.messageBuilderPool = [];
//Таймер отправки последнего сообщения в группе
exports.messageAwaitTime = 1000;
class MessageBuilder {
    constructor(userId) {
        this.buildingMessage = new message_1.default(userId);
    }
    getUserId() {
        var _a;
        return (_a = this.buildingMessage) === null || _a === void 0 ? void 0 : _a.user_id;
    }
    appendImageId(imageId) {
        if (!this.buildingMessage)
            return;
        if (!this.buildingMessage.img_id) {
            this.buildingMessage.img_id = [];
        }
        this.buildingMessage.img_id.push(imageId);
    }
    appendSubject(subject) {
        if (!this.buildingMessage)
            return;
        this.buildingMessage.subject = subject;
    }
    appendBody(body) {
        if (!this.buildingMessage)
            return;
        this.buildingMessage.body = body;
    }
    getMessage() {
        return this.buildingMessage;
    }
}
exports.default = MessageBuilder;
function fillMessageBuilder(builder, msg) {
    if (msg.photo) {
        builder.appendImageId(msg.photo[msg.photo.length - 1].file_id);
    }
    let messageBody = "";
    if (msg.text) {
        messageBody = msg.text;
    }
    else if (msg.caption) {
        messageBody = msg.caption;
    }
    if (messageBody && messageBody.charAt(0) == '*') {
        let end = messageBody.indexOf('*', 1);
        if (end) {
            builder.appendSubject(messageBody.substring(1, end));
            while (messageBody.charAt(++end) == '\n')
                ;
            messageBody = messageBody.substring(end);
        }
    }
    if (messageBody) {
        builder.appendBody(messageBody);
    }
}
exports.fillMessageBuilder = fillMessageBuilder;
