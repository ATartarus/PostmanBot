import TelegramBot from "node-telegram-bot-api";
import Message from "../models/message";

export const messageBuilderPool: MessageBuilder[] = []
//Таймер отправки последнего сообщения в группе
export const messageAwaitTime = 1000;

export default class MessageBuilder {
    private buildingMessage: Message;
    public timeout: NodeJS.Timeout | undefined; 

    public constructor(userId: number) {
        this.buildingMessage = new Message(userId);
    }
    
    public getUserId() {
        return this.buildingMessage?.user_id;
    }

    public appendImageId(imageId: string) {
        if (!this.buildingMessage) return;

        if (!this.buildingMessage.img_id) {
            this.buildingMessage.img_id = [];
        }

        this.buildingMessage.img_id.push(imageId);
    }

    public appendSubject(subject: string) {
        if (!this.buildingMessage) return;

        this.buildingMessage.subject = subject;
    }

    public appendBody(body: string) {
        if (!this.buildingMessage) return;

        this.buildingMessage.body = body;
    }

    public getMessage(): Message {
        return this.buildingMessage;
    }
}

export function fillMessageBuilder(builder: MessageBuilder, msg: TelegramBot.Message) {
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
            while(messageBody.charAt(++end) == '\n');
            messageBody = messageBody.substring(end);
        }
    }

    if (messageBody) {
        builder.appendBody(messageBody);
    }
}