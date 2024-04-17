export const newsletterPool: Newsletter[] = [];

export default class Newsletter {
    private userId: number;
    public messages: number[] = [];
    public bots: number[] = [];
    public receivers: number[] = [];

    public constructor(userId: number) {
        this.userId = userId;
    }

    public isValid(): boolean {
        return this.messages.length > 0 && this.bots.length > 0 && this.receivers.length > 0;
    }

    public getUserId() {
        return this.userId;
    }
}

export enum NewsletterProperty {
    Messages = "messages",
    Bots = "bots",
    Receivers = "receivers"
}