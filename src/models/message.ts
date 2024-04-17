export default class Message {
    constructor(
        public user_id: number,
        public body?: string,
        public subject?: string,
        public img_id?: string[]
    ) {}

    public isEmpty() {
        return !this.body && !this.subject && !this.img_id;
    }
}