import TelegramBot from "node-telegram-bot-api";
import { Collection, MongoClient, WithId } from "mongodb";
import { ServerApiVersion } from 'mongodb';
import Message from "../models/message";
import User from "../models/user";


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
        this.receivers = db.collection("receivers");
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

    public async getReceiverList(userId: number): Promise<string> {
        const userReceivers = this.receivers.find({ user_id: userId });

        let ind = 0;
        let resultList = "Your saved recievers:";
        for await (const recievers of userReceivers) {
            resultList += `\n${ind + 1}. ${recievers["caption"] ?? `Unnamed list ${ind + 1}`}`;
            ++ind;
        }
    
        return resultList;
    }

    public async validateCollectionSize(collection: Collection, userId: number) {
        const maxCount = process.env.MAX_COLLECTION_DOCUMENTS || 9
        let countDocuments = await collection.countDocuments({ user_id: userId });
        while (countDocuments--  > +maxCount) {
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

    /**
     * Validates user by trying to find his id in the database and if not found adding new entry.
     * @param user - user to validate.
     * @returns object { passed: boolean; message: string}.
     * passed: true if user exists/added, false otherwise.
     * message: message with error or success string.
     */
    public async validateUser(user: User) {
        const dbContext = await DatabaseContext.getInstance();
        let result: { passed: boolean; message: string};

        try {
            const exists = await dbContext.users.findOne({ id: user.id });
    
            if (exists) {
                result = {
                    passed: true,
                    message: "<i>User already exists, bot is ready!</i>"
                };
            }
            else {
                try {
                    await dbContext.users.insertOne(user);
                    result = {
                        passed: true,
                        message: "<i>User " + (user.username == undefined
                            ? `with id ${user.id}`
                            : `${user.username}`)
                            + " has been recorded. Bot is ready!</i>"
                    };
                } catch (error) {
                    result = {
                        passed: false,
                        message: "<i>Unable to add user!</i>"
                    };
                }
            }
        } catch(error) {
            result = {
                passed: false,
                message: "<i>Error occured. Try again</i>"
            }
            console.error(error);
        }

        return result;
    }
}