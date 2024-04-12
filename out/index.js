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
const dotenv_1 = __importDefault(require("dotenv"));
const https_1 = __importDefault(require("https"));
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const user_1 = __importDefault(require("./models/user"));
const databaseContext_1 = __importDefault(require("./services/databaseContext"));
const bot_1 = __importDefault(require("./models/bot"));
const recieversList_1 = __importDefault(require("./models/recieversList"));
const newsletter_1 = __importDefault(require("./newsletter"));
const messageBuilder_1 = __importDefault(require("./services/messageBuilder"));
const commands_1 = __importDefault(require("./commands"));
dotenv_1.default.config();
let currentUser;
let newsletter = new newsletter_1.default();
let waitingInput = false;
const bot = new node_telegram_bot_api_1.default(process.env.API_TOKEN, { webHook: { port: +process.env.PORT } }
// { polling: {
//     interval: 300,
//     autoStart: true
//   }}
);
//bot.on("polling_error", err => console.log(err.message));
bot.setWebHook(`${process.env.APP_URL}/bot${process.env.API_TOKEN}`);
bot.setMyCommands(commands_1.default);
bot.onText(/\/start/, onStart);
bot.onText(/\/add_message/, onAddMessage);
bot.onText(/\/add_bot/, onAddBot);
bot.onText(/\/add_recievers/, onAddRecievers);
bot.onText(/\/list_messages/, onListMessages);
bot.onText(/\/list_bots/, onListBots);
bot.onText(/\/list_recievers/, onListRecievers);
bot.onText(/\/create_newsletter/, onCreateNewsletter);
bot.onText(/\/send_newsletter/, onSendNewsletter);
bot.on("message", (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const builder = messageBuilder_1.default.getInstance();
    if (builder.isActive()) {
        if (msg.photo) {
            builder.appendImageId(msg.photo[msg.photo.length - 1].file_id);
        }
        let messageBody = "";
        if (msg.text) {
            messageBody = msg.text;
        }
        else if (msg.caption) {
            messageBody = msg.caption;
        }
        if (messageBody && messageBody.charAt(0) == '*') {
            let end = messageBody.indexOf('*', 1);
            if (end) {
                builder.appendSubject(messageBody.substring(1, end));
                while (messageBody.charAt(++end) == '\n')
                    ;
                messageBody = messageBody.substring(end);
            }
        }
        if (messageBody) {
            builder.appendBody(messageBody);
        }
        if (builder.timeout)
            clearTimeout(builder.timeout);
        builder.timeout = setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
            yield onMessageAddCallback();
        }), 1000);
    }
    else if (msg.text) {
        let textIsCommand = false;
        commands_1.default.forEach((command) => {
            if (`/${command.command}` == msg.text) {
                textIsCommand = true;
                return;
            }
        });
        if (!textIsCommand && !waitingInput) {
            bot.sendMessage(msg.chat.id, "Look up for a list of valid commands");
        }
    }
}));
function onStart(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        if (currentUser) {
            bot.sendMessage(msg.chat.id, "<i>Bot is ready!</i>", { parse_mode: "HTML" });
            return;
        }
        ;
        bot.sendMessage(msg.chat.id, "<i>Initializing...</i>", { parse_mode: "HTML" });
        currentUser = new user_1.default((_a = msg.from) === null || _a === void 0 ? void 0 : _a.id, (_b = msg.from) === null || _b === void 0 ? void 0 : _b.first_name, (_c = msg.from) === null || _c === void 0 ? void 0 : _c.username);
        const dbContext = yield databaseContext_1.default.getInstance();
        try {
            const exists = yield dbContext.users.findOne({ id: currentUser.id });
            if (exists) {
                yield bot.sendMessage(msg.chat.id, "<i>User already exists, bot is ready!</i>", { parse_mode: "HTML" });
                return;
            }
            else {
                const res = yield dbContext.users.insertOne(currentUser);
                if (!res.acknowledged)
                    console.log("insert error");
            }
        }
        catch (error) {
            console.error(error);
        }
        const message = "<i>User " + (currentUser.username == undefined
            ? `with id ${currentUser.id}`
            : `${currentUser.username}`)
            + " has been recorded. Bot is ready!</i>";
        yield bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
    });
}
function onAddMessage() {
    return __awaiter(this, void 0, void 0, function* () {
        bot.sendMessage(currentUser.id, "Enter new message");
        messageBuilder_1.default.getInstance().init(currentUser.id);
    });
}
function onMessageAddCallback() {
    return __awaiter(this, void 0, void 0, function* () {
        const builder = messageBuilder_1.default.getInstance();
        const message = builder.getMessage();
        builder.close();
        if (!message) {
            bot.sendMessage(currentUser.id, "Error. Message was not added");
            return;
        }
        const dbContext = yield databaseContext_1.default.getInstance();
        yield dbContext.messages.insertOne(message)
            .then((doc) => {
            dbContext.validateCollectionSize(dbContext.messages, currentUser.id);
            bot.sendMessage(currentUser.id, "Message added successfully!");
        })
            .catch((error) => {
            bot.sendMessage(currentUser.id, "Error. Message was not added!");
        });
    });
}
function onListMessages() {
    return __awaiter(this, void 0, void 0, function* () {
        const dbContext = yield databaseContext_1.default.getInstance();
        const resultList = yield dbContext.getMessageList(currentUser.id);
        bot.sendMessage(currentUser.id, resultList);
    });
}
function onAddBot() {
    return __awaiter(this, void 0, void 0, function* () {
        bot.sendMessage(currentUser.id, "Enter your bot token:");
        waitingInput = true;
        bot.once("text", (msg) => __awaiter(this, void 0, void 0, function* () {
            waitingInput = false;
            const botToken = msg.text;
            const userBot = new node_telegram_bot_api_1.default(botToken);
            yield userBot.getMe()
                .then((userBot) => __awaiter(this, void 0, void 0, function* () {
                const token = new bot_1.default(currentUser.id, botToken);
                const dbContext = yield databaseContext_1.default.getInstance();
                yield dbContext.bots.insertOne(token)
                    .then((doc) => {
                    dbContext.validateCollectionSize(dbContext.bots, currentUser.id);
                    bot.sendMessage(msg.chat.id, "Bot added successfully!");
                })
                    .catch((error) => {
                    bot.sendMessage(msg.chat.id, "Error. Bot was not added!");
                });
            }))
                .catch((error) => {
                bot.sendMessage(msg.chat.id, `Error. Unable to establish connection with specified bot.
                    Check token validity and bot settings.`);
            });
        }));
    });
}
function onListBots() {
    return __awaiter(this, void 0, void 0, function* () {
        const dbContext = yield databaseContext_1.default.getInstance();
        const resultList = yield dbContext.getBotList(currentUser.id);
        bot.sendMessage(currentUser.id, resultList);
    });
}
function onAddRecievers() {
    return __awaiter(this, void 0, void 0, function* () {
        bot.sendMessage(currentUser.id, "Send csv file with users id");
        bot.once("message", (msg) => __awaiter(this, void 0, void 0, function* () {
            if (!msg.document) {
                bot.sendMessage(msg.chat.id, "You must send csv file");
                return;
            }
            const recievers = new recieversList_1.default(currentUser.id, msg.document.file_id, msg.caption);
            const dbContext = yield databaseContext_1.default.getInstance();
            yield dbContext.recievers.insertOne(recievers)
                .then((doc) => {
                dbContext.validateCollectionSize(dbContext.recievers, currentUser.id);
                bot.sendMessage(msg.chat.id, "File added successfully!");
            })
                .catch((error) => {
                bot.sendMessage(msg.chat.id, "Error. File was not added!");
            });
        }));
    });
}
function onListRecievers() {
    return __awaiter(this, void 0, void 0, function* () {
        const dbContext = yield databaseContext_1.default.getInstance();
        const resultList = yield dbContext.getRecieverList(currentUser.id);
        bot.sendMessage(currentUser.id, resultList);
    });
}
function onCreateNewsletter() {
    return __awaiter(this, void 0, void 0, function* () {
        newsletter = new newsletter_1.default();
        const dbContext = yield databaseContext_1.default.getInstance();
        let list = yield dbContext.getMessageList(currentUser.id);
        let count = yield dbContext.messages.countDocuments({ user_id: currentUser.id });
        let keyboard = [];
        let row = [];
        for (let i = 0; i < count; i++) {
            if (i % 3 == 0) {
                keyboard.push(row);
                row = [];
            }
            row.push({ text: (i + 1).toString(), callback_data: 'm' + i });
        }
        if (row.length > 0) {
            keyboard.push(row);
        }
        yield bot.sendMessage(currentUser.id, list, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
        list = yield dbContext.getBotList(currentUser.id);
        count = yield dbContext.bots.countDocuments({ user_id: currentUser.id });
        keyboard = [];
        row = [];
        for (let i = 0; i < count; i++) {
            if (i % 3 == 0) {
                keyboard.push(row);
                row = [];
            }
            row.push({ text: (i + 1).toString(), callback_data: 'b' + i });
        }
        if (row.length > 0) {
            keyboard.push(row);
        }
        yield bot.sendMessage(currentUser.id, list, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
        list = yield dbContext.getRecieverList(currentUser.id);
        count = yield dbContext.recievers.countDocuments({ user_id: currentUser.id });
        keyboard = [];
        row = [];
        for (let i = 0; i < count; i++) {
            if (i % 3 == 0) {
                keyboard.push(row);
                row = [];
            }
            row.push({ text: (i + 1).toString(), callback_data: 'r' + i });
        }
        if (row.length > 0) {
            keyboard.push(row);
        }
        yield bot.sendMessage(currentUser.id, list, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    });
}
bot.on('callback_query', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const data = ctx.data;
    if (data == undefined)
        return;
    if (data.charAt(0) == 'm') {
        newsletter.messages.push(Number.parseInt(data.substring(1)));
    }
    else if (data.charAt(0) == 'b') {
        newsletter.bots.push(Number.parseInt(data.substring(1)));
    }
    else if (data.charAt(0) == 'r') {
        newsletter.recievers.push(Number.parseInt(data.substring(1)));
    }
}));
function onSendNewsletter() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!newsletter.isValid()) {
            bot.sendMessage(currentUser.id, "Newsletter must contain at least one message/bot/reciever");
            return;
        }
        const dbContext = yield databaseContext_1.default.getInstance();
        const messages = yield dbContext.messages.find({ user_id: currentUser.id }).toArray();
        const bots = yield dbContext.bots.find({ user_id: currentUser.id }).toArray();
        const recievers = yield dbContext.recievers.find({ user_id: currentUser.id }).toArray();
        newsletter.messages.forEach((messageInd) => __awaiter(this, void 0, void 0, function* () {
            const messageDoc = messages[messageInd];
            const imgIds = messageDoc["img_id"];
            let message = "";
            if (messageDoc["subject"] != null) {
                message += `<b>${messageDoc["subject"]}</b>\n\n`;
            }
            message += messageDoc["body"];
            newsletter.bots.forEach((botInd) => __awaiter(this, void 0, void 0, function* () {
                const botToken = bots[botInd]["token"];
                const helperBot = new node_telegram_bot_api_1.default(botToken);
                newsletter.recievers.forEach((recieverInd) => __awaiter(this, void 0, void 0, function* () {
                    const fileId = recievers[recieverInd]["csv_file_id"];
                    const file = yield bot.getFile(fileId);
                    const url = `https://api.telegram.org/file/bot${process.env.API_TOKEN}/${file.file_path}`;
                    const fileContent = (yield getResource(url)).toString("utf8");
                    const userIds = fileContent.split(",");
                    userIds.forEach((userId) => __awaiter(this, void 0, void 0, function* () {
                        if (imgIds != null) {
                            const imgFiles = yield Promise.all(imgIds.map((id) => __awaiter(this, void 0, void 0, function* () { return yield bot.getFile(id); })));
                            const responses = yield Promise.all(imgFiles.map((file) => __awaiter(this, void 0, void 0, function* () {
                                const url = `https://api.telegram.org/file/bot${process.env.API_TOKEN}/${file.file_path}`;
                                return yield getResource(url);
                            })));
                            const media = [];
                            responses.forEach(response => {
                                media.push({ type: 'photo', media: response });
                            });
                            media[0].caption = message;
                            media[0].parse_mode = "HTML";
                            helperBot.sendMediaGroup(userId, media)
                                .then((message) => {
                                console.log("Message sent successfully", messageDoc._id);
                            })
                                .catch((error) => {
                                console.log("Error. Message was not sent", messageDoc._id);
                            });
                        }
                        else {
                            helperBot.sendMessage(userId, message, {
                                parse_mode: "HTML"
                            })
                                .then((message) => {
                                console.log("Message sent successfully", messageDoc._id);
                            })
                                .catch((error) => {
                                console.log("Error. Message was not sent", messageDoc._id);
                            });
                            ;
                        }
                    }));
                }));
            }));
        }));
        bot.sendMessage(currentUser.id, "Newsletter sended!");
    });
}
function getResource(url) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            https_1.default.get(url, (response) => {
                const chunks = [];
                response.on("data", (chunk) => {
                    chunks.push(chunk);
                });
                response.on("end", () => {
                    resolve(Buffer.concat(chunks));
                });
            }).on("error", (error) => {
                reject(error);
            });
        });
    });
}
