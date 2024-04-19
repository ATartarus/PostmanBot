import { MessageEntity, Message } from "node-telegram-bot-api";

export const messagePool: Map<number, MessageContent> = new Map<number, MessageContent>();
export const messageAwaitTime = 1000;

export class MessageContent {
    public userId: number;
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