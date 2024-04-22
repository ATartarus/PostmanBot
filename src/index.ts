import dotenv from "dotenv";
import TelegramBot, { InputMedia} from "node-telegram-bot-api";
import DatabaseContext from "./database/databaseContext";
import Bot from "./database/bot";
import User from "./database/user";
import commands, { textToCommand } from "./misc/commands";
import { InternalError } from "./misc/errors";
import { UserState } from "./misc/userState";
import { getResource, createInlineKeyboard, parseKeyboardCallback, removeFromArray, initBot } from "./misc/utils";
import { appendKeyboardMessage, deleteKeyboardMessages, messagePool, userStates } from "./misc/containers";
import MessageContent, { messageAwaitTime } from "./entity/messageContent";
import Newsletter, { NewsletterResult } from "./entity/newsletter";


dotenv.config();

const baseBotUrl = "https://api.telegram.org/file/bot";
const bot = initBot(false);
bot.setMyCommands(commands);


bot.on("message", onMessageReceived);
bot.on("callback_query", onInlineKeyboardClick);

/**
 * Main event handler. Should be only one because library cant handle async listeners properly.
 */
async function onMessageReceived(msg: TelegramBot.Message) {
    const userState = userStates.get(msg.from!.id) ?? UserState.Idle;
    const userId = msg.from!.id;
    const chatId = msg.chat.id;

    const command = textToCommand(msg.text);
    if (command && command != "cancel" && userState != UserState.Idle) {
        bot.sendMessage(chatId, "Complete current operation or type /cancel");
        return;
    }

    switch (msg.text) {
        case "/start": {
            await onStart(msg);
            break;
        }
        case "/add_bot": {
            onAddBot(msg);
            break;
        }
        case "/show_bots": {
            await onShowBots(msg);
            break;
        }
        case "/update_bot_receivers": {
            await onUpdateBotReceivers(msg);
            break;
        }
        case "/create_newsletter": {
            onCreateNewsletter(msg);
            break;
        }
        case "/cancel": {
            await onCancel(msg);
            return;
        }
        default: {
            if (userState == UserState.Idle) {
                bot.sendMessage(chatId, "Look up for a list of valid commands");
                return;
            }
        }
    }

    switch (userState) {
        case UserState.EnterBotToken: {
            try {
                await onTokenReceived(msg);
                bot.sendMessage(chatId, "Send csv file with users telegram id");
                userStates.set(userId, UserState.SendReceiversFile);
            } catch (error) {
                bot.sendMessage(chatId, (error as Error).message);
            }

            break;
        }
        case UserState.ChooseBotToUpdate: {
            bot.sendMessage(chatId, "Choose one of the bots");
            break;
        }
        case UserState.SendReceiversFile: {
            try {
                await onFileReceived(msg);
                const dbContext = await DatabaseContext.getInstance();

                if (await dbContext.updateOrInsertStagedBot(userId)) {
                    bot.sendMessage(chatId, "Bot list updated");
                } else {
                    bot.sendMessage(chatId, "Error occured");
                }
                await endOperation(chatId, userId);
            } catch (error) {
                bot.sendMessage(chatId, (error as Error).message);

                if (error instanceof InternalError) {
                    await endOperation(chatId, userId);
                }
            }

            break;
        }
        case UserState.EnterMessage: {
            onNewsletterMessageReceived(msg);
            break;
        }
        case UserState.MessagePreview:
        case UserState.ChooseBot: {
            bot.sendMessage(chatId, "Choose one of the options");
            break;
        }
        case UserState.ConfirmNewsletter: {
            bot.sendMessage(chatId, "Confirm newsletter or reject by typing /cancel");
            break;
        }
    }
}

/**
 * Main inline keyboard handler. 
 */
async function onInlineKeyboardClick(ctx: TelegramBot.CallbackQuery) {
    if (!ctx.data) return;

    const sourceMsg = ctx.message;
    if (!sourceMsg) {
        console.log("Callback message is undefined");
        return;
    }

    const keyboardData = parseKeyboardCallback(ctx.data);
    const chatId = sourceMsg.chat.id;
    const userId = ctx.from!.id;
    deleteKeyboardMessages(bot, chatId, userId);
    
    switch (keyboardData.state) {
        case UserState.ChooseBotToUpdate: {
            bot.sendMessage(chatId, "Send csv file with users telegram id");
            userStates.set(userId, UserState.SendReceiversFile);
            
            const dbContext = await DatabaseContext.getInstance();
            const requiredBot = await dbContext.getBotByInd(userId, keyboardData.buttonIndex);
            
            if (!requiredBot) {
                bot.sendMessage(chatId, "Selected bot is not found");
                await endOperation(chatId, userId);
                return;
            }
            dbContext.stagedObjects.set(userId, requiredBot);
            break;
        }
        case UserState.MessagePreview: {
            if (keyboardData.buttonIndex) {
                bot.sendMessage(chatId, "Enter new message");
                await endOperation(chatId, userId);
                userStates.set(userId, UserState.EnterMessage);
            } else {
                userStates.set(userId, UserState.ChooseBot);
                
                const dbContext = await DatabaseContext.getInstance();
                const count = await dbContext.bots.countDocuments({ user_id: userId});
                let resultList = "Your saved bots\n";
                resultList += await dbContext.getBotList(userId);
            
                const message = await bot.sendMessage(chatId, resultList, {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: createInlineKeyboard(count, 3, UserState.ChooseBot)
                    }
                });
                appendKeyboardMessage(userId, message.message_id);
            }
            break;
        }
        case UserState.ChooseBot: {
            const botInd = keyboardData.buttonIndex;
            messagePool.get(userId)!.botInd = botInd;

            const dbContext = await DatabaseContext.getInstance();
            const requiredBot = await dbContext.getBotByInd(userId, botInd);
            const newBot = new TelegramBot(requiredBot!.token);
            const text = `Newsletter will be sent via bot "<b>${(await newBot.getMe()).username}</b>".` +
                `\nMessage will receive <b>${requiredBot?.receivers_count}</b> users.`;

            const message = await bot.sendMessage(chatId, text, {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: createInlineKeyboard(1, 1, UserState.ConfirmNewsletter, ["Confirm"])
                }
            });
            appendKeyboardMessage(userId, message.message_id);
            userStates.set(userId, UserState.ConfirmNewsletter);

            break;
        }
        case UserState.ConfirmNewsletter: {
            const newsletter = await sendNewsletter(chatId, userId);

            const log = newsletter.getBriefLog();
            bot.sendMessage(chatId, 
                `<b>Newsletter sent!</b>\n
                Total messages: ${log.total}
                Sent successfully: ${log.success}
                Failed to send: ${log.fail}`,
                {
                    parse_mode: "HTML"
                }
            );

            break;
        }
    }

    bot.answerCallbackQuery(ctx.id);
}


async function onStart(msg: TelegramBot.Message): Promise<void> {
    const currentUser = new User(
        msg.from!.id!,
        msg.from?.first_name,
        msg.from?.username
    );

    const dbContext = await DatabaseContext.getInstance();
    const res = await dbContext.validateUser(currentUser);
    bot.sendMessage(msg.chat.id, res.message, { parse_mode: "HTML"});
}


function onAddBot(msg: TelegramBot.Message) {
    userStates.set(msg.from!.id, UserState.EnterBotToken);
    bot.sendMessage(msg.chat.id, "Enter your bot token");
}

async function onTokenReceived(msg: TelegramBot.Message) {
    const botToken = msg.text;
    if (!botToken) {
        throw new Error("You must send bot token");
    }

    const userBot = new TelegramBot(botToken);
    try {
        await userBot.getMe();
    } catch (error) {
        throw new Error("Error. Unable to establish connection with specified bot." +
            "Check token validity and bot settings.");
    }

    const dbContext = await DatabaseContext.getInstance();
    const newBot = new Bot(msg.from!.id, botToken);
    dbContext.stagedObjects.set(msg.from!.id, newBot);
}

async function onFileReceived(msg: TelegramBot.Message) {
    if (!msg.document) {
        throw new Error("You must send csv file");
    }

    const file = await bot.getFile(msg.document.file_id);
    const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
    const fileContent = (await getResource(url)).toString("utf8");
    const userIds = fileContent.split(",");

    let receiversCount = 0;
    for (const id of userIds) {
        if (Number.isNaN(parseInt(id))) {
            throw new Error("File has invalid values");
        }
        ++receiversCount;
    }

    const dbContext = await DatabaseContext.getInstance();
    const newBot = dbContext.stagedObjects.get(msg.from!.id);

    if (!newBot || !(newBot instanceof Bot)) {
        throw new InternalError("Something went wrong, try whole operation again");
    }

    newBot.csv_file_id = msg.document.file_id;
    newBot.receivers_count = receiversCount;
}


async function onShowBots(msg: TelegramBot.Message) {
    const dbContext = await DatabaseContext.getInstance();
    let resultList = "Your saved bots\n";
    resultList += await dbContext.getBotList(msg.from!.id);

    bot.sendMessage(msg.chat.id, resultList, {
        parse_mode: "HTML"
    });
}

async function onUpdateBotReceivers(msg: TelegramBot.Message) {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    userStates.set(userId, UserState.ChooseBotToUpdate);
    

    let resultList = "Choose bot to update\n";
    const dbContext = await DatabaseContext.getInstance();
    const count = await dbContext.bots.countDocuments({ user_id: userId});
    resultList += await dbContext.getBotList(userId);

    const message = await bot.sendMessage(chatId, resultList, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: createInlineKeyboard(count, 3, UserState.ChooseBotToUpdate)
        },
    });

    appendKeyboardMessage(userId, message.message_id);
}


function onCreateNewsletter(msg: TelegramBot.Message) {
    userStates.set(msg.from!.id, UserState.EnterMessage);
    bot.sendMessage(msg.chat.id, "Enter new message");
}

function onNewsletterMessageReceived(msg: TelegramBot.Message) {
    const userId = msg.from!.id;

    if (msg.media_group_id) {
        let partialMessage = messagePool.get(userId);
        if (!partialMessage) {
            partialMessage = new MessageContent(userId);
            messagePool.set(userId, partialMessage);
        }

        partialMessage.append(msg);
        clearTimeout(partialMessage.mediaGroupEndTimer);
        partialMessage.mediaGroupEndTimer = setTimeout(() => {
            onNewsletterMessageReady(msg);
        }, messageAwaitTime);
    } else {
        let fullMessage = new MessageContent(userId);
        fullMessage.append(msg);
        messagePool.set(userId, fullMessage);
        onNewsletterMessageReady(msg);
    }
}

async function onNewsletterMessageReady(msg:TelegramBot.Message) {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;

    const newsletterMsg = messagePool.get(userId)!;
    userStates.set(userId, UserState.MessagePreview);
    const previewKeyboard =  createInlineKeyboard(2, 2, UserState.MessagePreview, ["Continue", "Recreate"]);
    
    if (newsletterMsg.isMediaGroup()) {
        const media: InputMedia[] = [];
        newsletterMsg.imgIds!.forEach((id) => {
            media.push({ type: 'photo', media: id });
        })
        media[0].caption = newsletterMsg.body;
        media[0].caption_entities = newsletterMsg.entities; 

        const messages = await bot.sendMediaGroup(chatId, media);
        messages.forEach((message) => appendKeyboardMessage(userId, message.message_id));

        const message = await bot.sendMessage(chatId, "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", {
            reply_markup: {
                inline_keyboard: previewKeyboard
            }
        })
        appendKeyboardMessage(userId, message.message_id);

    } else {
        const message = await bot.sendMessage(chatId, newsletterMsg.body!, {
            entities: newsletterMsg.entities,
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: previewKeyboard
            }
        });
        appendKeyboardMessage(userId, message.message_id);
    }
}

async function sendNewsletter(chatId: number, userId: number): Promise<Newsletter> {
    const newsletter = new Newsletter(userId);

    const messagePromises: Promise<void>[] = [];
    const dbContext = await DatabaseContext.getInstance();
    const message = messagePool.get(userId);
    const botDoc = await dbContext.getBotByInd(userId, message!.botInd!);
    const helperBot = new TelegramBot(botDoc!["token"]);

    const file = await bot.getFile(botDoc!["csv_file_id"]!);
    const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
    const userIds = (await getResource(url)).toString("utf8").split(",");

    newsletter.initLog(userIds.length);

    let userInd = 0;
    for (const userId of userIds) {
        let media: InputMedia[];

        if (message!.imgIds) {
            const imgFiles = await Promise.all(message!.imgIds.map(async (id) => await bot.getFile(id)));
            const responses = await Promise.all(imgFiles.map(async (file) => {
                const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`; 
                return await getResource(url);
            }));
            
            media = [];
            responses.forEach(response => {
                media.push({ type: 'photo', media: response as any});
            });

            media[0].caption = message!.body;
            media[0].caption_entities = message!.entities;
        }

        let receiverInd = userInd;
        const messagePromise = new Promise<void> ((resolve, reject) => {
            let sendPromise;
            if (media) {
                sendPromise = helperBot.sendMediaGroup(userId, media);
            } else {
                sendPromise = helperBot.sendMessage(userId, message!.body!);
            }

            sendPromise
                .then(() => {
                    newsletter.setLogResult(receiverInd, NewsletterResult.Succeeded);
                    removeFromArray(messagePromises, messagePromise);
                    resolve();
                })
                .catch((error) => {
                    newsletter.setLogResult(receiverInd, NewsletterResult.Failed);
                    removeFromArray(messagePromises, messagePromise);
                    reject(error);
                });
                
        });
        messagePromises.push(messagePromise);

        userInd++;
    }

    await Promise.allSettled(messagePromises)
    await endOperation(chatId, userId);

    return newsletter;
}

async function onCancel(msg: TelegramBot.Message){
    await endOperation(msg.chat.id, msg.from!.id);
    bot.sendMessage(msg.chat.id, "Operation canceled");
}

async function endOperation(chatId: number, userId: number) {
    userStates.delete(userId);
    const dbContext = await DatabaseContext.getInstance();
    dbContext.stagedObjects.delete(userId);
    messagePool.delete(userId);
    await deleteKeyboardMessages(bot, chatId, userId);
}