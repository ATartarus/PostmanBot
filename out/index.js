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
const commands_1 = __importStar(require("./misc/commands"));
const utils_1 = require("./misc/utils");
const userState_1 = require("./misc/userState");
const errors_1 = require("./misc/errors");
const messageContent_1 = require("./entity/messageContent");
dotenv_1.default.config();
const baseBotUrl = "https://api.telegram.org/file/bot";
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
bot.onText(/\/add_bot/, onAddBot);
bot.onText(/\/show_bots/, onShowBots);
bot.onText(/\/update_bot_receivers/, onUpdateBotReceivers);
bot.onText(/\/create_newsletter/, onCreateNewsletter);
bot.onText(/\/cancel/, onCancel);
bot.on("callback_query", onInlineKeyboardClick);
bot.on("message", onMessageReceived);
function onStart(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const currentUser = new user_1.default(msg.from.id, (_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name, (_b = msg.from) === null || _b === void 0 ? void 0 : _b.username);
        const dbContext = yield databaseContext_1.default.getInstance();
        const res = yield dbContext.validateUser(currentUser);
        yield bot.sendMessage(msg.chat.id, res.message, { parse_mode: "HTML" });
    });
}
function onCancel(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        endOperation(msg.from.id);
        yield bot.sendMessage(msg.chat.id, "Operation canceled");
    });
}
function endOperation(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        userState_1.userStates.delete(userId);
        const dbContext = yield databaseContext_1.default.getInstance();
        dbContext.stagedObjects.delete(userId);
        messageContent_1.messagePool.delete(userId);
    });
}
function onMessageReceived(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`userStates: ${userState_1.userStates.size}; stagedObjects: ${(yield databaseContext_1.default.getInstance()).stagedObjects.size}`);
        if ((0, commands_1.textIsCommand)(msg.text))
            return;
        const userState = userState_1.userStates.get(msg.from.id) || userState_1.UserState.Idle;
        switch (userState) {
            case userState_1.UserState.EnterBotToken:
                try {
                    yield onTokenReceived(msg);
                    yield bot.sendMessage(msg.chat.id, "Send csv file with users telegram id");
                    userState_1.userStates.set(msg.from.id, userState_1.UserState.SendReceiversFile);
                }
                catch (error) {
                    bot.sendMessage(msg.chat.id, error.message);
                }
                break;
            case userState_1.UserState.ChooseBotToUpdate:
                yield bot.sendMessage(msg.chat.id, "Choose one of the bots");
                break;
            case userState_1.UserState.SendReceiversFile:
                try {
                    yield onFileReceived(msg);
                    const dbContext = yield databaseContext_1.default.getInstance();
                    if (yield dbContext.updateOrInsertStagedBot(msg.from.id)) {
                        bot.sendMessage(msg.chat.id, "Bot list updated");
                    }
                    else {
                        bot.sendMessage(msg.chat.id, "Error occured");
                    }
                    yield endOperation(msg.from.id);
                }
                catch (error) {
                    bot.sendMessage(msg.chat.id, error.message);
                    if (error instanceof errors_1.InternalError) {
                        yield endOperation(msg.from.id);
                    }
                }
                break;
            case userState_1.UserState.EnterMessage:
                onNewsletterMessageReceived(msg);
                break;
            case userState_1.UserState.MessagePreview:
            case userState_1.UserState.ChooseBot:
                yield bot.sendMessage(msg.chat.id, "Choose one of the options");
                break;
            case userState_1.UserState.ConfirmNewsletter:
                yield bot.sendMessage(msg.chat.id, "Confirm newsletter or reject by typing /cancel");
                break;
            case userState_1.UserState.Idle:
            default:
                bot.sendMessage(msg.chat.id, "Look up for a list of valid commands");
        }
    });
}
function onInlineKeyboardClick(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.data)
            return;
        const sourceMsg = ctx.message;
        if (!sourceMsg) {
            console.log("Callback message is undefined");
            return;
        }
        const keyboardData = (0, utils_1.parseKeyboardCallback)(ctx.data);
        const chatId = sourceMsg.chat.id;
        bot.deleteMessage(chatId, sourceMsg.message_id);
        switch (keyboardData.state) {
            case userState_1.UserState.ChooseBotToUpdate: {
                yield bot.sendMessage(chatId, "Send csv file with users telegram id");
                userState_1.userStates.set(ctx.from.id, userState_1.UserState.SendReceiversFile);
                const dbContext = yield databaseContext_1.default.getInstance();
                const requiredBot = yield dbContext.getBotByInd(ctx.from.id, keyboardData.buttonIndex);
                if (!requiredBot) {
                    yield bot.sendMessage(chatId, "Selected bot is not found");
                    endOperation(ctx.from.id);
                }
                console.log(requiredBot);
                dbContext.stagedObjects.set(ctx.from.id, requiredBot);
                break;
            }
            case userState_1.UserState.MessagePreview: {
                if (keyboardData.buttonIndex) {
                    endOperation(ctx.from.id);
                    userState_1.userStates.set(ctx.from.id, userState_1.UserState.EnterMessage);
                    yield bot.sendMessage(chatId, "Enter new message");
                }
                else {
                    userState_1.userStates.set(ctx.from.id, userState_1.UserState.ChooseBot);
                    const dbContext = yield databaseContext_1.default.getInstance();
                    const count = yield dbContext.bots.countDocuments({ user_id: ctx.from.id });
                    let resultList = "Your saved bots\n";
                    resultList += yield dbContext.getBotList(ctx.from.id);
                    bot.sendMessage(chatId, resultList, {
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: (0, utils_1.createInlineKeyboard)(count, 3, userState_1.UserState.ChooseBot)
                        }
                    });
                }
                break;
            }
            case userState_1.UserState.ChooseBot: {
                const botInd = keyboardData.buttonIndex;
                messageContent_1.messagePool.get(ctx.from.id).botInd = botInd;
                const dbContext = yield databaseContext_1.default.getInstance();
                const requiredBot = yield dbContext.getBotByInd(ctx.from.id, botInd);
                const newBot = new node_telegram_bot_api_1.default(requiredBot.token);
                const text = `Newsletter will be sent via bot "${(yield newBot.getMe()).username}".
            Message will receive ${requiredBot === null || requiredBot === void 0 ? void 0 : requiredBot.receivers_count} users.`;
                userState_1.userStates.set(ctx.from.id, userState_1.UserState.ConfirmNewsletter);
                yield bot.sendMessage(chatId, text, {
                    reply_markup: {
                        inline_keyboard: (0, utils_1.createInlineKeyboard)(1, 1, userState_1.UserState.ConfirmNewsletter, ["Confirm"])
                    }
                });
                break;
            }
            case userState_1.UserState.ConfirmNewsletter: {
                const messagePromises = [];
                const dbContext = yield databaseContext_1.default.getInstance();
                const message = messageContent_1.messagePool.get(ctx.from.id);
                const botDoc = yield dbContext.getBotByInd(ctx.from.id, message.botInd);
                const botToken = botDoc["token"];
                const helperBot = new node_telegram_bot_api_1.default(botToken);
                const fileId = botDoc["csv_file_id"];
                const file = yield bot.getFile(fileId);
                const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
                const fileContent = (yield (0, utils_1.getResource)(url)).toString("utf8");
                const userIds = fileContent.split(",");
                let userInd = 0;
                for (const userId of userIds) {
                    let media;
                    if (message.imgIds) {
                        const imgFiles = yield Promise.all(message.imgIds.map((id) => __awaiter(this, void 0, void 0, function* () { return yield bot.getFile(id); })));
                        const responses = yield Promise.all(imgFiles.map((file) => __awaiter(this, void 0, void 0, function* () {
                            const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
                            return yield (0, utils_1.getResource)(url);
                        })));
                        media = [];
                        responses.forEach(response => {
                            media.push({ type: 'photo', media: response });
                        });
                        media[0].caption = message.body;
                        media[0].caption_entities = message.entities;
                        media[0].parse_mode = "HTML";
                    }
                    let receiverInd = userInd;
                    const messagePromise = new Promise((resolve, reject) => {
                        let sendPromise;
                        if (media) {
                            sendPromise = helperBot.sendMediaGroup(userId, media);
                        }
                        else {
                            sendPromise = helperBot.sendMessage(userId, message.body, {
                                parse_mode: "HTML"
                            });
                        }
                        sendPromise
                            .then(() => {
                            //newsletter.setLogResult(botInd, messageInd, receiversListInd, receiverInd, NewsletterResult.Succeeded);
                            (0, utils_1.removeFromArray)(messagePromises, messagePromise);
                            resolve();
                        })
                            .catch((error) => {
                            //newsletter.setLogResult(botInd, messageInd, receiversListInd, receiverInd, NewsletterResult.Failed);
                            (0, utils_1.removeFromArray)(messagePromises, messagePromise);
                            reject(error);
                        });
                    });
                    messagePromises.push(messagePromise);
                    userInd++;
                }
                yield Promise.allSettled(messagePromises);
                endOperation(ctx.from.id);
                // const log = newsletter.getBriefLog();
                // bot.sendMessage(msg.chat.id, 
                //     `<b>Newsletter sent!</b>\n
                //     Total messages: ${log.total}
                //     Sent successfully: ${log.success}
                //     Failed to send: ${log.fail}`,
                //     {
                //         parse_mode: "HTML"
                //     }
                // );
                break;
            }
        }
        bot.answerCallbackQuery(ctx.id);
    });
}
function onAddBot(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        userState_1.userStates.set(msg.from.id, userState_1.UserState.EnterBotToken);
        yield bot.sendMessage(msg.chat.id, "Enter your bot token");
    });
}
function onTokenReceived(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const botToken = msg.text;
        if (!botToken) {
            throw new Error("You must send bot token");
        }
        const userBot = new node_telegram_bot_api_1.default(botToken);
        try {
            yield userBot.getMe();
        }
        catch (error) {
            throw new Error(`Error. Unable to establish connection with specified bot.
        Check token validity and bot settings.`);
        }
        const dbContext = yield databaseContext_1.default.getInstance();
        const newBot = new bot_1.default(msg.from.id, botToken);
        dbContext.stagedObjects.set(msg.from.id, newBot);
    });
}
function onFileReceived(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!msg.document) {
            throw new Error("You must send csv file");
        }
        const file = yield bot.getFile(msg.document.file_id);
        const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
        const fileContent = (yield (0, utils_1.getResource)(url)).toString("utf8");
        const userIds = fileContent.split(",");
        let receiversCount = 0;
        for (const id of userIds) {
            if (Number.isNaN(parseInt(id))) {
                throw new Error("File has invalid values");
            }
            ++receiversCount;
        }
        const dbContext = yield databaseContext_1.default.getInstance();
        const newBot = dbContext.stagedObjects.get(msg.from.id);
        console.log(newBot instanceof bot_1.default);
        if (!newBot || !(newBot instanceof bot_1.default)) {
            throw new errors_1.InternalError("Something went wrong, try whole operation again");
        }
        newBot.csv_file_id = msg.document.file_id;
        newBot.receivers_count = receiversCount;
    });
}
function onShowBots(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const dbContext = yield databaseContext_1.default.getInstance();
        let resultList = "Your saved bots\n";
        resultList += yield dbContext.getBotList(msg.from.id);
        bot.sendMessage(msg.chat.id, resultList, {
            parse_mode: "HTML"
        });
    });
}
function onUpdateBotReceivers(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        userState_1.userStates.set(msg.from.id, userState_1.UserState.ChooseBotToUpdate);
        let resultList = "Choose bot to update\n";
        const dbContext = yield databaseContext_1.default.getInstance();
        const count = yield dbContext.bots.countDocuments({ user_id: msg.from.id });
        resultList += yield dbContext.getBotList(msg.from.id);
        yield bot.sendMessage(msg.chat.id, resultList, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: (0, utils_1.createInlineKeyboard)(count, 3, userState_1.UserState.ChooseBotToUpdate)
            },
        });
    });
}
function onCreateNewsletter(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        userState_1.userStates.set(msg.from.id, userState_1.UserState.EnterMessage);
        yield bot.sendMessage(msg.chat.id, "Enter new message");
    });
}
function onNewsletterMessageReceived(msg) {
    if (msg.media_group_id) {
        let partialMessage = messageContent_1.messagePool.get(msg.from.id);
        if (!partialMessage) {
            partialMessage = new messageContent_1.MessageContent(msg.from.id);
            messageContent_1.messagePool.set(msg.from.id, partialMessage);
        }
        partialMessage.append(msg);
        clearTimeout(partialMessage.mediaGroupEndTimer);
        partialMessage.mediaGroupEndTimer = setTimeout(() => {
            onNewsletterMessageReady(msg);
        }, messageContent_1.messageAwaitTime);
    }
    else {
        let fullMessage = new messageContent_1.MessageContent(msg.from.id);
        fullMessage.append(msg);
        messageContent_1.messagePool.set(msg.from.id, fullMessage);
        onNewsletterMessageReady(msg);
    }
}
function onNewsletterMessageReady(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const newsletterMsg = messageContent_1.messagePool.get(msg.from.id);
        userState_1.userStates.set(msg.from.id, userState_1.UserState.MessagePreview);
        const previewKeyboard = (0, utils_1.createInlineKeyboard)(2, 2, userState_1.UserState.MessagePreview, ["Continue", "Recreate"]);
        if (newsletterMsg.isMediaGroup()) {
            const media = [];
            newsletterMsg.imgIds.forEach((id) => {
                media.push({ type: 'photo', media: id });
            });
            media[0].caption = newsletterMsg.body;
            media[0].caption_entities = newsletterMsg.entities;
            yield bot.sendMediaGroup(msg.chat.id, media);
            yield bot.sendMessage(msg.chat.id, "113", {
                reply_markup: {
                    inline_keyboard: previewKeyboard
                }
            });
        }
        else {
            yield bot.sendMessage(msg.chat.id, newsletterMsg.body, {
                entities: newsletterMsg.entities,
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: previewKeyboard
                }
            });
        }
    });
}
//# sourceMappingURL=index.js.map