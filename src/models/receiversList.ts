export default class ReceiversList {
    constructor (
        public user_id: number,
        public csv_file_id: string,
        public caption?: string
    ) {}
}