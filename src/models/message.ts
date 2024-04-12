export default class Message {
    constructor(
        public user_id: number,
        public body?: string,
        public subject?: string,
        public img_id?: string[]
    ) {}
}