import { InternalError } from "../misc/errors";

export default class Newsletter {
    private userId: number;

    private log: Int8Array | undefined;

    public constructor(userId: number) {
        this.userId = userId;
    }

    public getUserId() {
        return this.userId;
    }

    public initLog(length: number) {
        this.log = new Int8Array(length);
    }

    public setLogResult(receiver: number, result: NewsletterResult) {
        if (!this.log) throw new InternalError("Call initLog before setLogResult");

        this.log[receiver] = result;
    }

    public getBriefLog() {
        if (!this.log) throw new InternalError("Call initLog before getBriefLog");
        const success = this.log?.reduce((total, current) => total += (current == NewsletterResult.Succeeded) ? 1 : 0, 0);
        return { 
            total: this.log.length,
            success: success,
            fail: this.log.length - success
        };
    }
}

export enum NewsletterResult {
    Failed,
    Succeeded
}