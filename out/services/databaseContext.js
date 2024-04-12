"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const mongodb_1 = require("mongodb");
const mongodb_2 = require("mongodb");
class DatabaseContext {
    constructor() { }
    static getInstance() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.instance) {
                this.instance = new DatabaseContext();
            }
            yield this.instance.connect();
            return this.instance;
        });
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.client = new mongodb_1.MongoClient(process.env.CONNECTION_STRING, {
                serverApi: {
                    version: mongodb_2.ServerApiVersion.v1,
                    strict: true,
                    deprecationErrors: true,
                }
            });
            yield this.client.connect();
            const db = this.client.db(process.env.DATABASE_NAME);
            this.users = db.collection("users");
            this.messages = db.collection("messages");
            this.bots = db.collection("bots");
            this.recievers = db.collection("recievers");
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.close();
        });
    }
    getMessageList(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const userMessages = yield this.messages.find({ user_id: userId }).toArray();
            let resultList = "Your saved messages:";
            for (let ind = 0; ind < userMessages.length; ind++) {
                let message = userMessages[ind];
                if (message["subject"] != null) {
                    resultList += `\n${ind + 1}. ${message["subject"]}`;
                }
                else if (message["body"] != null) {
                    resultList += `\n${ind + 1}. ${message["body"].substring(0, 30)}`;
                }
                else {
                    resultList += `\n${ind + 1}. EmptyMessage`;
                }
            }
            return resultList;
        });
    }
    getBotList(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokens = yield this.bots.find({ user_id: userId }).toArray();
            let resultList = "Your saved bots:";
            for (let ind = 0; ind < tokens.length; ind++) {
                const userBot = new node_telegram_bot_api_1.default(tokens[ind]["token"]);
                const botName = (yield userBot.getMe()).username;
                resultList += `\n${ind + 1}. ${botName !== null && botName !== void 0 ? botName : "Unavailable"}`;
            }
            return resultList;
        });
    }
    getRecieverList(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const recievers = yield this.recievers.find({ user_id: userId }).toArray();
            let resultList = "Your saved recievers:";
            for (let ind = 0; ind < recievers.length; ind++) {
                resultList += `\n${ind + 1}. ${(_a = recievers[ind]["caption"]) !== null && _a !== void 0 ? _a : `Unnamed list ${ind + 1}`}`;
            }
            return resultList;
        });
    }
    validateCollectionSize(collection, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxCount = process.env.MAX_COLLECTION_DOCUMENTS || 9;
            while ((yield collection.countDocuments({ user_id: userId })) > +maxCount) {
                collection.deleteOne({ user_id: userId });
            }
        });
    }
}
exports.default = DatabaseContext;
