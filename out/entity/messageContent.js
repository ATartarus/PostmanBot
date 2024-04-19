"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageContent = exports.messageAwaitTime = exports.messagePool = void 0;
exports.messagePool = new Map();
exports.messageAwaitTime = 1000;
class MessageContent {
    constructor(userId, body, imgIds, entities) {
        this.userId = userId;
        this.body = body;
        this.imgIds = imgIds;
        this.entities = entities;
    }
    isMediaGroup() {
        return this.imgIds != undefined;
    }
    append(msg) {
        if (msg.photo) {
            if (!this.imgIds) {
                this.imgIds = [];
            }
            this.imgIds.push(msg.photo[msg.photo.length - 1].file_id);
        }
        let messageBody = "";
        if (msg.text) {
            messageBody = msg.text;
            if (msg.entities) {
                if (!this.entities) {
                    this.entities = [];
                }
                this.entities = this.entities.concat(msg.entities);
            }
        }
        else if (msg.caption) {
            messageBody = msg.caption;
            if (msg.caption_entities) {
                if (!this.entities) {
                    this.entities = [];
                }
                this.entities = this.entities.concat(msg.caption_entities);
            }
        }
        if (messageBody) {
            this.body = messageBody;
        }
    }
}
exports.MessageContent = MessageContent;
//# sourceMappingURL=messageContent.js.map