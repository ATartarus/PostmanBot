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
const bot_1 = __importDefault(require("./bot"));
class DatabaseContext {
    constructor() {
        this.stagedObjects = new Map();
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
            this.bots = db.collection("bots");
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.close();
        });
    }
    getBotByInd(userId, botInd) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            const userBots = this.bots.find({ user_id: userId });
            let ind = 0;
            let res;
            try {
                for (var _d = true, userBots_1 = __asyncValues(userBots), userBots_1_1; userBots_1_1 = yield userBots_1.next(), _a = userBots_1_1.done, !_a; _d = true) {
                    _c = userBots_1_1.value;
                    _d = false;
                    const bot = _c;
                    if (ind == botInd)
                        res = bot;
                    ++ind;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = userBots_1.return)) yield _b.call(userBots_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return res ? new bot_1.default(res["user_id"], res["token"], res["csv_file_id"], res["receivers_count"]) : res;
        });
    }
    getBotList(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_2, _b, _c;
            const userBots = this.bots.find({ user_id: userId });
            let ind = 0;
            let resultList = "";
            try {
                for (var _d = true, userBots_2 = __asyncValues(userBots), userBots_2_1; userBots_2_1 = yield userBots_2.next(), _a = userBots_2_1.done, !_a; _d = true) {
                    _c = userBots_2_1.value;
                    _d = false;
                    const bot = _c;
                    const userBot = new node_telegram_bot_api_1.default(bot["token"]);
                    const botName = (yield userBot.getMe()).username;
                    resultList += `\n<b>${ind + 1}. ${botName !== null && botName !== void 0 ? botName : "Unavailable"}</b>
            Number of receivers: ${bot["receivers_count"]}`;
                    ++ind;
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = userBots_2.return)) yield _b.call(userBots_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return resultList;
        });
    }
    updateOrInsertStagedBot(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const bot = this.stagedObjects.get(userId);
            if (!(bot instanceof bot_1.default))
                return false;
            try {
                yield this.bots.updateOne({ user_id: bot.user_id, token: bot.token }, {
                    $set: {
                        csv_file_id: bot.csv_file_id,
                        receivers_count: bot.receivers_count
                    }
                }, { upsert: true });
                this.validateCollectionSize(this.bots, bot.user_id);
            }
            catch (error) {
                return false;
            }
            return true;
        });
    }
    validateCollectionSize(collection, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxCount = process.env.MAX_COLLECTION_DOCUMENTS || 9;
            let countDocuments = yield collection.countDocuments({ user_id: userId });
            while (countDocuments-- > +maxCount) {
                yield collection.deleteOne({ user_id: userId });
            }
        });
    }
    /**
     * Validates user by trying to find his id in the database and if not found adding new entry.
     * @param user - user to validate.
     * @returns object { passed: boolean; message: string}.
     * passed: true if user exists/added, false otherwise.
     * message: message with error or success string.
     */
    validateUser(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const dbContext = yield DatabaseContext.getInstance();
            let result;
            try {
                const exists = yield dbContext.users.findOne({ id: user.id });
                if (exists) {
                    result = {
                        passed: true,
                        message: "<i>User already exists, bot is ready!</i>"
                    };
                }
                else {
                    try {
                        yield dbContext.users.insertOne(user);
                        result = {
                            passed: true,
                            message: "<i>User " + (user.username == undefined
                                ? `with id ${user.id}`
                                : `${user.username}`)
                                + " has been recorded. Bot is ready!</i>"
                        };
                    }
                    catch (error) {
                        result = {
                            passed: false,
                            message: "<i>Unable to add user!</i>"
                        };
                    }
                }
            }
            catch (error) {
                result = {
                    passed: false,
                    message: "<i>Error occured. Try again</i>"
                };
                console.error(error);
            }
            return result;
        });
    }
}
exports.default = DatabaseContext;
//# sourceMappingURL=databaseContext.js.map