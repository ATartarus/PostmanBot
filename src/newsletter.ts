export default class Newsletter {
    public messages: number[] = [];
    public bots: number[] = [];
    public recievers: number[] = [];

    public isValid(): boolean {
        return this.messages.length > 0 && this.bots.length > 0 && this.recievers.length > 0;
    }
}