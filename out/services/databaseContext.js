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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const mongodb_1 = require("mongodb");
const mongodb_2 = require("mongodb");
class DatabaseContext {
    constructor() {
        this.subjectFromBodyLength = 30;
    }
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
            this.receivers = db.collection("recievers");
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.close();
        });
    }
    getMessageList(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            const userMessages = this.messages.find({ user_id: userId });
            let ind = 0;
            let resultList = "Your saved messages:";
            try {
                for (var _d = true, userMessages_1 = __asyncValues(userMessages), userMessages_1_1; userMessages_1_1 = yield userMessages_1.next(), _a = userMessages_1_1.done, !_a; _d = true) {
                    _c = userMessages_1_1.value;
                    _d = false;
                    const message = _c;
                    resultList += this.createMessageListEntry(ind, message);
                    ++ind;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = userMessages_1.return)) yield _b.call(userMessages_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return resultList;
        });
    }
    getBotList(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_2, _b, _c;
            const userTokens = this.bots.find({ user_id: userId });
            let ind = 0;
            let resultList = "Your saved bots:";
            try {
                for (var _d = true, userTokens_1 = __asyncValues(userTokens), userTokens_1_1; userTokens_1_1 = yield userTokens_1.next(), _a = userTokens_1_1.done, !_a; _d = true) {
                    _c = userTokens_1_1.value;
                    _d = false;
                    const token = _c;
                    const userBot = new node_telegram_bot_api_1.default(token["token"]);
                    const botName = (yield userBot.getMe()).username;
                    resultList += `\n${ind + 1}. ${botName !== null && botName !== void 0 ? botName : "Unavailable"}`;
                    ++ind;
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = userTokens_1.return)) yield _b.call(userTokens_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return resultList;
        });
    }
    getRecieverList(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_3, _b, _c;
            var _d;
            const userRecievers = this.receivers.find({ user_id: userId });
            let ind = 0;
            let resultList = "Your saved recievers:";
            try {
                for (var _e = true, userRecievers_1 = __asyncValues(userRecievers), userRecievers_1_1; userRecievers_1_1 = yield userRecievers_1.next(), _a = userRecievers_1_1.done, !_a; _e = true) {
                    _c = userRecievers_1_1.value;
                    _e = false;
                    const recievers = _c;
                    resultList += `\n${ind + 1}. ${(_d = recievers["caption"]) !== null && _d !== void 0 ? _d : `Unnamed list ${ind + 1}`}`;
                    ++ind;
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (!_e && !_a && (_b = userRecievers_1.return)) yield _b.call(userRecievers_1);
                }
                finally { if (e_3) throw e_3.error; }
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
    createMessageListEntry(ind, message) {
        let entry;
        if (message["subject"]) {
            entry = `\n${ind + 1}. ${message["subject"]}`;
        }
        else if (message["body"] != null) {
            entry = `\n${ind + 1}. ${message["body"].substring(0, this.subjectFromBodyLength)}...`;
        }
        else {
            entry = `\n${ind + 1}. EmptyMessage`;
        }
        return entry;
    }
}
exports.default = DatabaseContext;
