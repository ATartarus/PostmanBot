import TelegramBot from "node-telegram-bot-api";
import { Collection, MongoClient, WithId } from "mongodb";
import { ServerApiVersion } from 'mongodb';
import Message from "../models/message";


export default class DatabaseContext {
    private static instance: DatabaseContext;
    private client!: MongoClient;
    private subjectFromBodyLength = 30;

    public users!: Collection;
    public messages!: Collection;
    public bots!: Collection;
    public receivers!: Collection;


    private constructor() { }

    public static async getInstance() : Promise<DatabaseContext> {
        if (!this.instance) {
            this.instance = new DatabaseContext();
        }
        await this.instance.connect();
        return this.instance;
    }

    private async connect(): Promise<void> {
        this.client = new MongoClient(
            process.env.CONNECTION_STRING!, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });

        await this.client.connect();
        const db = this.client.db(process.env.DATABASE_NAME);
        this.users = db.collection("users");
        this.messages = db.collection("messages");
        this.bots = db.collection("bots");
        this.receivers = db.collection("recievers");
    }

    public async close(): Promise<void> {
        await this.client.close();
    }

    public async getMessageList(userId: number): Promise<string> {
        const userMessages = this.messages.find({ user_id: userId });

        let ind = 0;
        let resultList = "Your saved messages:";
        for await (const message of userMessages) {
            resultList += this.createMessageListEntry(ind, message as unknown as Message);
            ++ind;
        }

        return resultList;
    }

    public async getBotList(userId: number): Promise<string> {
        const userTokens = this.bots.find({ user_id: userId });

        let ind = 0;
        let resultList = "Your saved bots:";
        for await (const token of userTokens) {
            const userBot = new TelegramBot(token["token"]);
            const botName = (await userBot.getMe()).username;
            resultList += `\n${ind + 1}. ${botName ?? "Unavailable"}`;
            ++ind;
        }
    
        return resultList;
    }

    public async getRecieverList(userId: number): Promise<string> {
        const userRecievers = this.receivers.find({ user_id: userId });

        let ind = 0;
        let resultList = "Your saved recievers:";
        for await (const recievers of userRecievers) {
            resultList += `\n${ind + 1}. ${recievers["caption"] ?? `Unnamed list ${ind + 1}`}`;
            ++ind;
        }
    
        return resultList;
    }

    public async validateCollectionSize(collection: Collection, userId: number) {
        const maxCount = process.env.MAX_COLLECTION_DOCUMENTS || 9
        while (await collection.countDocuments({ user_id: userId }) > +maxCount) {
            collection.deleteOne({ user_id: userId });
        }
    }

    private createMessageListEntry(ind: number, message: Message) {  
        let entry: string;      
        if (message["subject"]) {
            entry = `\n${ind + 1}. ${message!["subject"]}`;
        }
        else if (message!["body"] != null) {
            entry = `\n${ind + 1}. ${message!["body"].substring(0, this.subjectFromBodyLength)}...`;
        }
        else {
            entry = `\n${ind + 1}. EmptyMessage`;
        }

        return entry;
    }
}