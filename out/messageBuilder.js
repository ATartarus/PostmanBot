"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const message_1 = __importDefault(require("./models/message"));
class MessageBuilder {
    constructor() { }
    static getInstance() {
        if (!this.instance) {
            this.instance = new MessageBuilder();
        }
        return this.instance;
    }
    init(userId) {
        this.buildingMessage = new message_1.default(userId);
    }
    close() {
        this.buildingMessage = undefined;
        clearTimeout(this.timeout);
    }
    isActive() {
        return this.buildingMessage != undefined;
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
