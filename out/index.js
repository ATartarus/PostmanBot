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
const databaseContext_1 = __importDefault(require("./database/databaseContext"));
const bot_1 = __importDefault(require("./database/bot"));
const user_1 = __importDefault(require("./database/user"));
const commands_1 = __importStar(require("./misc/commands"));
const errors_1 = require("./misc/errors");
const userState_1 = require("./misc/userState");
const utils_1 = require("./misc/utils");
const containers_1 = require("./misc/containers");
const messageContent_1 = __importStar(require("./entity/messageContent"));
const newsletter_1 = __importStar(require("./entity/newsletter"));
dotenv_1.default.config();
const baseBotUrl = "https://api.telegram.org/file/bot";
const bot = (0, utils_1.initBot)(true);
bot.setMyCommands(commands_1.default);
bot.on("message", onMessageReceived);
bot.on("callback_query", onInlineKeyboardClick);
/**
 * Main event handler. Should be only one because library cant handle async listeners properly.
 */
function onMessageReceived(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const userState = (_a = containers_1.userStates.get(msg.from.id)) !== null && _a !== void 0 ? _a : userState_1.UserState.Idle;
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const command = (0, commands_1.textToCommand)(msg.text);
        if (command && command != "cancel" && userState != userState_1.UserState.Idle) {
            bot.sendMessage(chatId, "Complete current operation or type /cancel");
            return;
        }
        switch (msg.text) {
            case "/start": {
                yield onStart(msg);
                break;
            }
            case "/add_bot": {
                onAddBot(msg);
                break;
            }
            case "/show_bots": {
                yield onShowBots(msg);
                break;
            }
            case "/update_bot_receivers": {
                yield onUpdateBotReceivers(msg);
                break;
            }
            case "/create_newsletter": {
                onCreateNewsletter(msg);
                break;
            }
            case "/cancel": {
                yield onCancel(msg);
                return;
            }
            default: {
                if (userState == userState_1.UserState.Idle) {
                    bot.sendMessage(chatId, "Look up for a list of valid commands");
                    return;
                }
            }
        }
        switch (userState) {
            case userState_1.UserState.EnterBotToken: {
                try {
                    yield onTokenReceived(msg);
                    bot.sendMessage(chatId, "Send csv file with users telegram id");
                    containers_1.userStates.set(userId, userState_1.UserState.SendReceiversFile);
                }
                catch (error) {
                    bot.sendMessage(chatId, error.message);
                }
                break;
            }
            case userState_1.UserState.ChooseBotToUpdate: {
                bot.sendMessage(chatId, "Choose one of the bots");
                break;
            }
            case userState_1.UserState.SendReceiversFile: {
                try {
                    yield onFileReceived(msg);
                    const dbContext = yield databaseContext_1.default.getInstance();
                    if (yield dbContext.updateOrInsertStagedBot(userId)) {
                        bot.sendMessage(chatId, "Bot list updated");
                    }
                    else {
                        bot.sendMessage(chatId, "Error occured");
                    }
                    yield endOperation(chatId, userId);
                }
                catch (error) {
                    bot.sendMessage(chatId, error.message);
                    if (error instanceof errors_1.InternalError) {
                        yield endOperation(chatId, userId);
                    }
                }
                break;
            }
            case userState_1.UserState.EnterMessage: {
                onNewsletterMessageReceived(msg);
                break;
            }
            case userState_1.UserState.MessagePreview:
            case userState_1.UserState.ChooseBot: {
                bot.sendMessage(chatId, "Choose one of the options");
                break;
            }
            case userState_1.UserState.ConfirmNewsletter: {
                bot.sendMessage(chatId, "Confirm newsletter or reject by typing /cancel");
                break;
            }
        }
    });
}
/**
 * Main inline keyboard handler.
 */
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
        const userId = ctx.from.id;
        (0, containers_1.deleteKeyboardMessages)(bot, chatId, userId);
        switch (keyboardData.state) {
            case userState_1.UserState.ChooseBotToUpdate: {
                bot.sendMessage(chatId, "Send csv file with users telegram id");
                containers_1.userStates.set(userId, userState_1.UserState.SendReceiversFile);
                const dbContext = yield databaseContext_1.default.getInstance();
                const requiredBot = yield dbContext.getBotByInd(userId, keyboardData.buttonIndex);
                if (!requiredBot) {
                    bot.sendMessage(chatId, "Selected bot is not found");
                    yield endOperation(chatId, userId);
                    return;
                }
                dbContext.stagedObjects.set(userId, requiredBot);
                break;
            }
            case userState_1.UserState.MessagePreview: {
                if (keyboardData.buttonIndex) {
                    bot.sendMessage(chatId, "Enter new message");
                    yield endOperation(chatId, userId);
                    containers_1.userStates.set(userId, userState_1.UserState.EnterMessage);
                }
                else {
                    containers_1.userStates.set(userId, userState_1.UserState.ChooseBot);
                    const dbContext = yield databaseContext_1.default.getInstance();
                    const count = yield dbContext.bots.countDocuments({ user_id: userId });
                    let resultList = "Your saved bots\n";
                    resultList += yield dbContext.getBotList(userId);
                    const message = yield bot.sendMessage(chatId, resultList, {
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: (0, utils_1.createInlineKeyboard)(count, 3, userState_1.UserState.ChooseBot)
                        }
                    });
                    (0, containers_1.appendKeyboardMessage)(userId, message.message_id);
                }
                break;
            }
            case userState_1.UserState.ChooseBot: {
                const botInd = keyboardData.buttonIndex;
                containers_1.messagePool.get(userId).botInd = botInd;
                const dbContext = yield databaseContext_1.default.getInstance();
                const requiredBot = yield dbContext.getBotByInd(userId, botInd);
                const newBot = new node_telegram_bot_api_1.default(requiredBot.token);
                const text = `Newsletter will be sent via bot "<b>${(yield newBot.getMe()).username}</b>".` +
                    `\nMessage will receive <b>${requiredBot === null || requiredBot === void 0 ? void 0 : requiredBot.receivers_count}</b> users.`;
                const message = yield bot.sendMessage(chatId, text, {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: (0, utils_1.createInlineKeyboard)(1, 1, userState_1.UserState.ConfirmNewsletter, ["Confirm"])
                    }
                });
                (0, containers_1.appendKeyboardMessage)(userId, message.message_id);
                containers_1.userStates.set(userId, userState_1.UserState.ConfirmNewsletter);
                break;
            }
            case userState_1.UserState.ConfirmNewsletter: {
                const newsletter = yield sendNewsletter(chatId, userId);
                const log = newsletter.getBriefLog();
                bot.sendMessage(chatId, `<b>Newsletter sent!</b>\n
                Total messages: ${log.total}
                Sent successfully: ${log.success}
                Failed to send: ${log.fail}`, {
                    parse_mode: "HTML"
                });
                break;
            }
        }
        bot.answerCallbackQuery(ctx.id);
    });
}
function onStart(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const currentUser = new user_1.default(msg.from.id, (_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name, (_b = msg.from) === null || _b === void 0 ? void 0 : _b.username);
        const dbContext = yield databaseContext_1.default.getInstance();
        const res = yield dbContext.validateUser(currentUser);
        bot.sendMessage(msg.chat.id, res.message, { parse_mode: "HTML" });
    });
}
function onAddBot(msg) {
    containers_1.userStates.set(msg.from.id, userState_1.UserState.EnterBotToken);
    bot.sendMessage(msg.chat.id, "Enter your bot token");
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
            throw new Error("Error. Unable to establish connection with specified bot." +
                "Check token validity and bot settings.");
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
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        containers_1.userStates.set(userId, userState_1.UserState.ChooseBotToUpdate);
        let resultList = "Choose bot to update\n";
        const dbContext = yield databaseContext_1.default.getInstance();
        const count = yield dbContext.bots.countDocuments({ user_id: userId });
        resultList += yield dbContext.getBotList(userId);
        const message = yield bot.sendMessage(chatId, resultList, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: (0, utils_1.createInlineKeyboard)(count, 3, userState_1.UserState.ChooseBotToUpdate)
            },
        });
        (0, containers_1.appendKeyboardMessage)(userId, message.message_id);
    });
}
function onCreateNewsletter(msg) {
    containers_1.userStates.set(msg.from.id, userState_1.UserState.EnterMessage);
    bot.sendMessage(msg.chat.id, "Enter new message");
}
function onNewsletterMessageReceived(msg) {
    const userId = msg.from.id;
    if (msg.media_group_id) {
        let partialMessage = containers_1.messagePool.get(userId);
        if (!partialMessage) {
            partialMessage = new messageContent_1.default(userId);
            containers_1.messagePool.set(userId, partialMessage);
        }
        partialMessage.append(msg);
        clearTimeout(partialMessage.mediaGroupEndTimer);
        partialMessage.mediaGroupEndTimer = setTimeout(() => {
            onNewsletterMessageReady(msg);
        }, messageContent_1.messageAwaitTime);
    }
    else {
        let fullMessage = new messageContent_1.default(userId);
        fullMessage.append(msg);
        containers_1.messagePool.set(userId, fullMessage);
        onNewsletterMessageReady(msg);
    }
}
function onNewsletterMessageReady(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const newsletterMsg = containers_1.messagePool.get(userId);
        containers_1.userStates.set(userId, userState_1.UserState.MessagePreview);
        const previewKeyboard = (0, utils_1.createInlineKeyboard)(2, 2, userState_1.UserState.MessagePreview, ["Continue", "Recreate"]);
        if (newsletterMsg.isMediaGroup()) {
            const media = [];
            newsletterMsg.imgIds.forEach((id) => {
                media.push({ type: 'photo', media: id });
            });
            media[0].caption = newsletterMsg.body;
            media[0].caption_entities = newsletterMsg.entities;
            const messages = yield bot.sendMediaGroup(chatId, media);
            messages.forEach((message) => (0, containers_1.appendKeyboardMessage)(userId, message.message_id));
            const message = yield bot.sendMessage(chatId, "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", {
                reply_markup: {
                    inline_keyboard: previewKeyboard
                }
            });
            (0, containers_1.appendKeyboardMessage)(userId, message.message_id);
        }
        else {
            const message = yield bot.sendMessage(chatId, newsletterMsg.body, {
                entities: newsletterMsg.entities,
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: previewKeyboard
                }
            });
            (0, containers_1.appendKeyboardMessage)(userId, message.message_id);
        }
    });
}
function sendNewsletter(chatId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const newsletter = new newsletter_1.default(userId);
        const messagePromises = [];
        const dbContext = yield databaseContext_1.default.getInstance();
        const message = containers_1.messagePool.get(userId);
        const botDoc = yield dbContext.getBotByInd(userId, message.botInd);
        const helperBot = new node_telegram_bot_api_1.default(botDoc["token"]);
        const file = yield bot.getFile(botDoc["csv_file_id"]);
        const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
        const userIds = (yield (0, utils_1.getResource)(url)).toString("utf8").split(",");
        newsletter.initLog(userIds.length);
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
            }
            let receiverInd = userInd;
            const messagePromise = new Promise((resolve, reject) => {
                let sendPromise;
                if (media) {
                    sendPromise = helperBot.sendMediaGroup(userId, media);
                }
                else {
                    sendPromise = helperBot.sendMessage(userId, message.body);
                }
                sendPromise
                    .then(() => {
                    newsletter.setLogResult(receiverInd, newsletter_1.NewsletterResult.Succeeded);
                    (0, utils_1.removeFromArray)(messagePromises, messagePromise);
                    resolve();
                })
                    .catch((error) => {
                    newsletter.setLogResult(receiverInd, newsletter_1.NewsletterResult.Failed);
                    (0, utils_1.removeFromArray)(messagePromises, messagePromise);
                    reject(error);
                });
            });
            messagePromises.push(messagePromise);
            userInd++;
        }
        yield Promise.allSettled(messagePromises);
        yield endOperation(chatId, userId);
        return newsletter;
    });
}
function onCancel(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        yield endOperation(msg.chat.id, msg.from.id);
        bot.sendMessage(msg.chat.id, "Operation canceled");
    });
}
function endOperation(chatId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        containers_1.userStates.delete(userId);
        const dbContext = yield databaseContext_1.default.getInstance();
        dbContext.stagedObjects.delete(userId);
        containers_1.messagePool.delete(userId);
        yield (0, containers_1.deleteKeyboardMessages)(bot, chatId, userId);
    });
}
//# sourceMappingURL=index.js.map