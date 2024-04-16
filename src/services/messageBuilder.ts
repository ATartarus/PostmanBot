import Message from "../models/message";

export default class MessageBuilder {
    private static instance: MessageBuilder;
    private buildingMessage: Message | undefined;
    public timeout: NodeJS.Timeout | undefined; 

    private constructor() {}

    public static getInstance(): MessageBuilder {
        if (!this.instance) {
            this.instance = new MessageBuilder();
        }

        return this.instance;
    }

    public init(userId: number) {
        this.buildingMessage = new Message(userId);
    }

    public close() {
        this.buildingMessage = undefined;
        clearTimeout(this.timeout);
    }

    public isActive() {
        return this.buildingMessage != undefined;
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

    public getMessage(): Message | undefined {
        return this.buildingMessage;
    }
}