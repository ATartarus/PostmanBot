import TelegramBot from "node-telegram-bot-api";
import { Collection, MongoClient } from "mongodb";
import { ServerApiVersion } from 'mongodb';


export default class DatabaseContext {
    private static instance: DatabaseContext;
    private client!: MongoClient;

    public users!: Collection;
    public messages!: Collection;
    public bots!: Collection;
    public recievers!: Collection;


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
        this.recievers = db.collection("recievers");
    }

    public async close(): Promise<void> {
        await this.client.close();
    }

    public async getMessageList(userId: number): Promise<string> {
        const userMessages = await this.messages.find({ user_id: userId }).toArray();

        let resultList = "Your saved messages:";
        for (let ind = 0; ind < userMessages.length; ind++) {
            let message = userMessages[ind];
            if (message!["subject"] != null) {
                resultList += `\n${ind + 1}. ${message!["subject"]}`;
            }
            else if (message!["body"] != null) {
                resultList += `\n${ind + 1}. ${message!["body"].substring(0, 30)}`;
            }
            else {
                resultList += `\n${ind + 1}. EmptyMessage`;
            }
        }

        return resultList;
    }

    public async getBotList(userId: number): Promise<string> {
        const tokens = await this.bots.find({ user_id: userId }).toArray();

        let resultList = "Your saved bots:";
        for (let ind = 0; ind < tokens.length; ind++) {
            const userBot = new TelegramBot(tokens[ind]["token"]);
            const botName = (await userBot.getMe()).username;
            resultList += `\n${ind + 1}. ${botName ?? "Unavailable"}`;
        }
    
        return resultList;
    }

    public async getRecieverList(userId: number): Promise<string> {
        const recievers = await this.recievers.find({ user_id: userId }).toArray();

        let resultList = "Your saved recievers:";
        for (let ind = 0; ind < recievers.length; ind++) {

            resultList += `\n${ind + 1}. ${recievers[ind]["caption"] ?? `Unnamed list ${ind + 1}`}`;
        }
    
        return resultList;
    }

    public async validateCollectionSize(collection: Collection, userId: number) {
        const maxCount = process.env.MAX_COLLECTION_DOCUMENTS || 9
        while (await collection.countDocuments({ user_id: userId }) > +maxCount) {
            collection.deleteOne({ user_id: userId });
        }
    }
}