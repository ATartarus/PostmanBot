import TelegramBot from "node-telegram-bot-api";
import { Collection, MongoClient } from "mongodb";
import { ServerApiVersion, Filter } from 'mongodb';
import User from "./user";
import Bot from "./bot";


export default class DatabaseContext {
    private static instance: DatabaseContext;
    private client!: MongoClient;

    public stagedObjects: Map<number, any> = new Map<number, any>();
    public users!: Collection;
    public bots!: Collection;


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
        this.bots = db.collection("bots");
    }

    public async close(): Promise<void> {
        await this.client.close();
    }

    public async getBotByInd(userId: number, botInd: number): Promise<Bot | undefined> {
        const userBots = this.bots.find({ user_id: userId});
        let ind = 0;
        let res: any;
        for await (const bot of userBots) {
            if (ind == botInd) res = bot;
            ++ind;
        }
        
        return res ? new Bot(
            res["user_id"],
            res["token"],
            res["csv_file_id"],
            res["receivers_count"]
        ) : res;
    }

    public async getBotList(userId: number): Promise<string> {
        const userBots = this.bots.find({ user_id: userId });

        let ind = 0;
        let resultList = "";
        for await (const bot of userBots) {
            const userBot = new TelegramBot(bot["token"]);
            const botName = (await userBot.getMe()).username;
            resultList += `\n<b>${ind + 1}. ${botName ?? "Unavailable"}</b>
            Number of receivers: ${bot["receivers_count"]}`;
            ++ind;
        }
    
        return resultList;
    }

    public async updateOrInsertStagedBot(userId: number): Promise<boolean> {
        const bot = this.stagedObjects.get(userId);
        if (!(bot instanceof Bot)) return false;

        try {
            await this.bots.updateOne(
                { user_id: bot.user_id, token: bot.token },
                { 
                    $set: {
                        csv_file_id: bot.csv_file_id,
                        receivers_count: bot.receivers_count
                    }
                },
                { upsert: true }
            );
            this.validateCollectionSize(this.bots, bot.user_id);
        }
        catch (error) {
            return false;
        }

        return true;
    }

    public async validateCollectionSize(collection: Collection, userId: number) {
        const maxCount = process.env.MAX_COLLECTION_DOCUMENTS || 9;
        let countDocuments = await collection.countDocuments({ user_id: userId });
        while (countDocuments--  > +maxCount) {
            await collection.deleteOne({ user_id: userId });
        }
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