export default class Bot {
    constructor(
        public user_id: number,
        public token: string,
        public csv_file_id?: string,
        public receivers_count?: number
    ) { }
}