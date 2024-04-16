export default class Newsletter {
    public messages: number[] = [];
    public bots: number[] = [];
    public receivers: number[] = [];

    public isValid(): boolean {
        return this.messages.length > 0 && this.bots.length > 0 && this.receivers.length > 0;
    }
}

export enum NewsletterProperty {
    Messages = "messages",
    Bots = "bots",
    Receivers = "receivers"
}