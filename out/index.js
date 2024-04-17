"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const databaseContext_1 = __importDefault(require("./services/databaseContext"));
const bot_1 = __importDefault(require("./models/bot"));
const user_1 = __importDefault(require("./models/user"));
const receiversList_1 = __importDefault(require("./models/receiversList"));
const newsletter_1 = __importStar(require("./newsletter"));
const messageBuilder_1 = __importStar(require("./services/messageBuilder"));
const commands_1 = __importStar(require("./commands"));
const utils_1 = require("./utils");
dotenv_1.default.config();
const baseBotUrl = "https://api.telegram.org/file/bot";
//List of the users that should send token, csv file or message so bot is waiting for their input.
const awaitingList = [];
const bot = new node_telegram_bot_api_1.default(process.env.API_TOKEN, 
//{ webHook: { port: +process.env.PORT! } }
{ polling: {
        interval: 300,
        autoStart: true
    } });
bot.on("polling_error", err => console.log(err.message));
//bot.setWebHook(`${process.env.APP_URL}/bot${process.env.API_TOKEN}`);
bot.setMyCommands(commands_1.default);
bot.onText(/\/start/, onStart);
bot.onText(/\/add_message/, onAddMessage);
bot.onText(/\/add_bot/, onAddBot);
bot.onText(/\/add_receivers/, onAddRecievers);
bot.onText(/\/list_messages/, onListMessages);
bot.onText(/\/list_bots/, onListBots);
bot.onText(/\/list_receivers/, onListReceivers);
bot.onText(/\/create_newsletter/, onCreateNewsletter);
bot.onText(/\/send_newsletter/, onSendNewsletter);
bot.on("message", onMessageReceived);
bot.on("photo", onPhotoRecieved);
function onStart(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const currentUser = new user_1.default(msg.from.id, (_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name, (_b = msg.from) === null || _b === void 0 ? void 0 : _b.username);
        const dbContext = yield databaseContext_1.default.getInstance();
        const res = yield dbContext.validateUser(currentUser);
        yield bot.sendMessage(msg.chat.id, res.message, { parse_mode: "HTML" });
    });
}
/**
 * Initializes message building by pushing new MessageBuilder with sender id into messageBuilderPool.
 * Or creates message directly if not media group.
 */
function onAddMessage(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        bot.sendMessage(msg.chat.id, "Enter new message");
        awaitingList.push(msg.from.id);
        bot.once("message", (msg) => __awaiter(this, void 0, void 0, function* () {
            if ((0, commands_1.textIsCommand)(msg.text))
                return;
            const builder = new messageBuilder_1.default(msg.from.id);
            if (msg.media_group_id) {
                messageBuilder_1.messageBuilderPool.push(builder);
                return;
            }
            else {
                (0, messageBuilder_1.fillMessageBuilder)(builder, msg);
                onMessageBuildEnded(builder);
            }
        }));
    });
}
function onMessageReceived(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const awaiting = awaitingList.find((userId) => { var _a; return userId == ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.id); });
        if (!(0, commands_1.textIsCommand)(msg.text) && !awaiting) {
            bot.sendMessage(msg.chat.id, "Look up for the list of valid commands");
        }
        (0, utils_1.removeFromArray)(awaitingList, msg.from.id);
    });
}
function onPhotoRecieved(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const builder = messageBuilder_1.messageBuilderPool.find((builder) => builder.getUserId() == msg.from.id);
        if (builder) {
            (0, messageBuilder_1.fillMessageBuilder)(builder, msg);
            awaitingList.push(builder.getUserId());
            if (builder.timeout)
                clearTimeout(builder.timeout);
            /*
            Единственный таймаут в проекте, мне и самому не хотелось его сюда пихать, но он тут просто необходим
            т.к. при отправке MediaGroup (нескольких изображений в одном сообшений) тг отсылает каждую пикчу отдельным сообщением,
            и если принадлежность сообщения к группе можно определить через msg.media_group_id, то конец этой группы никак не помечается.
            Остается только просить пользователя подтверждать отправку, либо юзать таймаут.
            */
            builder.timeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                yield onMessageBuildEnded(builder);
            }), messageBuilder_1.messageAwaitTime);
        }
    });
}
/**
 * Called upon end of message building. Retrieves message from MessageBuilder,
 * removes builder from messageBuilderPool and adds message to database.
 * @param builder - MessageBuilder that ended building
 */
function onMessageBuildEnded(builder) {
    return __awaiter(this, void 0, void 0, function* () {
        const message = builder.getMessage();
        (0, utils_1.removeFromArray)(messageBuilder_1.messageBuilderPool, builder);
        (0, utils_1.removeFromArray)(awaitingList, builder.getUserId());
        if (message.isEmpty()) {
            bot.sendMessage(builder.getUserId(), "Error. Message was not added");
            return;
        }
        const dbContext = yield databaseContext_1.default.getInstance();
        try {
            yield dbContext.messages.insertOne(message);
            dbContext.validateCollectionSize(dbContext.messages, builder.getUserId());
            bot.sendMessage(builder.getUserId(), "Message added successfully!");
        }
        catch (error) {
            bot.sendMessage(builder.getUserId(), "Error. Message was not added!");
        }
    });
}
function onListMessages(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const dbContext = yield databaseContext_1.default.getInstance();
        const resultList = yield dbContext.getMessageList(msg.from.id);
        bot.sendMessage(msg.chat.id, resultList);
    });
}
/**
 * Recieves token from user, checks its validity and adds to the database.
 */
function onAddBot(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        bot.sendMessage(msg.chat.id, "Enter your bot token:");
        awaitingList.push(msg.from.id);
        bot.once("message", (msg) => __awaiter(this, void 0, void 0, function* () {
            if ((0, commands_1.textIsCommand)(msg.text))
                return;
            const botToken = msg.text;
            if (!botToken) {
                yield bot.sendMessage(msg.chat.id, "You must send bot token");
                return;
            }
            const userBot = new node_telegram_bot_api_1.default(botToken);
            try {
                yield userBot.getMe();
                try {
                    const dbContext = yield databaseContext_1.default.getInstance();
                    const token = new bot_1.default(msg.from.id, botToken);
                    yield dbContext.bots.insertOne(token);
                    dbContext.validateCollectionSize(dbContext.bots, msg.from.id);
                    yield bot.sendMessage(msg.chat.id, "Bot added successfully!");
                }
                catch (error) {
                    yield bot.sendMessage(msg.chat.id, "Error. Bot was not added!");
                }
            }
            catch (error) {
                yield bot.sendMessage(msg.chat.id, `Error. Unable to establish connection with specified bot.
            Check token validity and bot settings.`);
            }
        }));
    });
}
function onListBots(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const dbContext = yield databaseContext_1.default.getInstance();
        const resultList = yield dbContext.getBotList(msg.from.id);
        bot.sendMessage(msg.chat.id, resultList);
    });
}
/**
 * Recieves csv file from user and adds its id to the database.
 */
function onAddRecievers(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        bot.sendMessage(msg.chat.id, "Send csv file with users id");
        awaitingList.push(msg.from.id);
        bot.once("message", (msg) => __awaiter(this, void 0, void 0, function* () {
            if ((0, commands_1.textIsCommand)(msg.text))
                return;
            if (!msg.document) {
                yield bot.sendMessage(msg.chat.id, "You must send csv file");
                return;
            }
            const recievers = new receiversList_1.default(msg.from.id, msg.document.file_id, msg.caption);
            const dbContext = yield databaseContext_1.default.getInstance();
            try {
                yield dbContext.receivers.insertOne(recievers);
                dbContext.validateCollectionSize(dbContext.receivers, (msg.from.id));
                bot.sendMessage(msg.chat.id, "File added successfully!");
            }
            catch (error) {
                bot.sendMessage(msg.chat.id, "Error. File was not added!");
            }
        }));
    });
}
function onListReceivers(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const dbContext = yield databaseContext_1.default.getInstance();
        const resultList = yield dbContext.getReceiverList(msg.from.id);
        bot.sendMessage(msg.chat.id, resultList);
    });
}
/**
 * Lists user messages, bots and receivers. Adds keyboard under each list for selection.
 * Creates new Newsletter with user id and pushes it to the newsletter pool.
 */
function onCreateNewsletter(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        newsletter_1.newsletterPool.push(new newsletter_1.default(msg.from.id));
        const dbContext = yield databaseContext_1.default.getInstance();
        //Строковый енам не поддерживает реверс маппинг(
        for (const property of [newsletter_1.NewsletterProperty.Messages, newsletter_1.NewsletterProperty.Bots, newsletter_1.NewsletterProperty.Receivers]) {
            let list = "Not found";
            let count = 0;
            switch (property) {
                case newsletter_1.NewsletterProperty.Messages:
                    list = yield dbContext.getMessageList(msg.from.id);
                    //можно было бы обращаться к dbContext.messages/bots/receivers через NewsletterProperty как в обработчике callback_query ниже,
                    //но тогда NewsletterProperty было бы уже и DatabaseContextProperty. Сокращается две строчки но вносится лишняя зависимость.
                    count = yield dbContext.messages.countDocuments({ user_id: msg.from.id });
                    break;
                case newsletter_1.NewsletterProperty.Bots:
                    list = yield dbContext.getBotList(msg.from.id);
                    count = yield dbContext.bots.countDocuments({ user_id: msg.from.id });
                    break;
                case newsletter_1.NewsletterProperty.Receivers:
                    list = yield dbContext.getReceiverList(msg.from.id);
                    count = yield dbContext.receivers.countDocuments({ user_id: msg.from.id });
                    break;
            }
            yield bot.sendMessage(msg.chat.id, list, {
                reply_markup: {
                    inline_keyboard: (0, utils_1.createInlineKeyboard)(count, 3, property)
                }
            });
        }
    });
}
bot.on('callback_query', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (ctx.data == undefined)
        return;
    const keyboardData = (0, utils_1.parseKeyboardCallback)(ctx.data);
    const newsletter = newsletter_1.newsletterPool.find((obj) => obj.getUserId() == ctx.from.id);
    if (!newsletter) {
        console.log("Could not find newsletter in the pool with userid = ", ctx.from.id);
    }
    else {
        newsletter[keyboardData.property].push(keyboardData.buttonIndex);
    }
}));
/**
 * Sends newsletter with corresponding user id from newsletterPool.
 * Each message is sent by each bot to the each of users.
 */
function onSendNewsletter(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const newsletter = newsletter_1.newsletterPool.find((obj) => obj.getUserId() == msg.from.id);
        if (!newsletter) {
            bot.sendMessage(msg.chat.id, "You must create newsletter with create_newsletter command");
            return;
        }
        if (!newsletter.isValid()) {
            bot.sendMessage(msg.chat.id, "Newsletter must contain at least one message, bot and reciever");
            return;
        }
        const dbContext = yield databaseContext_1.default.getInstance();
        const messages = yield dbContext.messages.find({ user_id: msg.from.id }).toArray();
        const bots = yield dbContext.bots.find({ user_id: msg.from.id }).toArray();
        const recievers = yield dbContext.receivers.find({ user_id: msg.from.id }).toArray();
        newsletter.messages.forEach((messageInd) => __awaiter(this, void 0, void 0, function* () {
            const messageDoc = messages[messageInd];
            const imgIds = messageDoc["img_id"];
            let message = "";
            if (messageDoc["subject"]) {
                message += `<b>${messageDoc["subject"]}</b>\n\n`;
            }
            if (messageDoc["body"]) {
                message += messageDoc["body"];
            }
            newsletter.bots.forEach((botInd) => __awaiter(this, void 0, void 0, function* () {
                const botToken = bots[botInd]["token"];
                const helperBot = new node_telegram_bot_api_1.default(botToken);
                newsletter.receivers.forEach((recieverInd) => __awaiter(this, void 0, void 0, function* () {
                    const fileId = recievers[recieverInd]["csv_file_id"];
                    const file = yield bot.getFile(fileId);
                    const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
                    const fileContent = (yield (0, utils_1.getResource)(url)).toString("utf8");
                    const userIds = fileContent.split(",");
                    userIds.forEach((userId) => __awaiter(this, void 0, void 0, function* () {
                        if (imgIds != null) {
                            const imgFiles = yield Promise.all(imgIds.map((id) => __awaiter(this, void 0, void 0, function* () { return yield bot.getFile(id); })));
                            const responses = yield Promise.all(imgFiles.map((file) => __awaiter(this, void 0, void 0, function* () {
                                const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
                                return yield (0, utils_1.getResource)(url);
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
        bot.sendMessage(msg.chat.id, "Newsletter sended!");
        (0, utils_1.removeFromArray)(newsletter_1.newsletterPool, newsletter);
    });
}
