import { MessageEntity, Message } from "node-telegram-bot-api";

export const messageAwaitTime = 500;

export default class MessageContent {
    private userId: number;
    public body?: string;
    public imgIds?: string[];
    public entities?: MessageEntity[];
    public botInd?: number;

    public mediaGroupEndTimer: NodeJS.Timeout | undefined; 

    constructor(userId: number, body?: string, imgIds?: string[], entities?: MessageEntity[]) {
        this.userId = userId;
        this.body = body;
        this.imgIds = imgIds;
        this.entities = entities;
    }

    public getUserId() {
        return this.userId;
    }

    public isMediaGroup(): boolean {
        return this.imgIds != undefined;
    }

    public append(msg: Message) {
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