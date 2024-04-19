export const newsletterPool: Map<number, Newsletter> = new Map<number, Newsletter>();

export default class Newsletter {
    private userId: number;
    public messages: Set<number> = new Set<number>();
    public bots: Set<number> = new Set<number>();
    public receivers: Set<number> = new Set<number>();

    private log: Int8Array[] = [];

    public constructor(userId: number) {
        this.userId = userId;
    }

    public isValid(): boolean {
        return this.messages.size > 0 && this.bots.size > 0 && this.receivers.size > 0;
    }

    public getUserId() {
        return this.userId;
    }

    public addLogEntry(botInd: number, messageInd: number, receiverListInd: number, length: number) {
        const size = process.env.MAX_COLLECTION_DOCUMENTS || 9;
        this.log[botInd * +size * +size + messageInd * +size + receiverListInd] = new Int8Array(length);
    }

    public setLogResult(
        botInd: number,
        messageInd: number,
        receiverListInd: number,
        receiver: number,
        result: NewsletterResult
    ) {
        const size = process.env.MAX_COLLECTION_DOCUMENTS || 9;
        this.log[botInd * +size * +size + messageInd * +size + receiverListInd][receiver] =  result;
    }

    public getBriefLog() {
        let success = 0, fail = 0;
        for (let listInd = 0; listInd < this.log.length; listInd++) {
            if (!this.log[listInd]) continue;

            for (let recInd = 0; recInd < this.log[listInd].length; recInd++) {
                if (this.log[listInd][recInd] == NewsletterResult.Succeeded) {
                    success++;
                } else {
                    fail++;
                }
            }
        }

        return { 
            total: this.log.reduce((total, list) => total += (list) ? list.length : 0, 0),
            success: success,
            fail: fail 
        };
    }
}

export enum NewsletterProperty {
    Bots = "bots",
    Messages = "messages",
    Receivers = "receivers"
}

export enum NewsletterResult {
    Failed,
    Succeeded,
    PartiallySucceded
}