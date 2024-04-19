import dotenv from "dotenv";
import TelegramBot, { InputMedia , SendMediaGroupOptions} from "node-telegram-bot-api";
import DatabaseContext from "./services/databaseContext";
import Bot from "./models/bot";
import User from "./models/user";
import Newsletter, { NewsletterProperty, NewsletterResult, newsletterPool } from "./entity/newsletter";
import commands, { textIsCommand } from "./misc/commands";
import { getResource, createInlineKeyboard, parseKeyboardCallback, removeFromArray } from "./misc/utils";
import { userStates, UserState } from "./misc/userState";
import { InternalError } from "./misc/errors";
import { MessageContent, messageAwaitTime, messagePool } from "./entity/messageContent";


dotenv.config();

const baseBotUrl = "https://api.telegram.org/file/bot";

const bot = new TelegramBot(
    process.env.API_TOKEN!,
    { webHook: { port: +process.env.PORT! } }
    // { polling: {
    //     interval: 300,
    //     autoStart: true
    //   }}
);


//bot.on("polling_error", err => console.log(err.message));
bot.setWebHook(`${process.env.APP_URL}/bot${process.env.API_TOKEN}`);

bot.setMyCommands(commands);


bot.onText(/\/start/, onStart);
bot.onText(/\/add_bot/, onAddBot);
bot.onText(/\/show_bots/, onShowBots);
bot.onText(/\/update_bot_receivers/, onUpdateBotReceivers);
bot.onText(/\/create_newsletter/, onCreateNewsletter);
bot.onText(/\/cancel/, onCancel);

bot.on("callback_query", onInlineKeyboardClick);
bot.on("message", onMessageReceived);


async function onStart(msg: TelegramBot.Message): Promise<void> {
    const currentUser = new User(
        msg.from!.id!,
        msg.from?.first_name,
        msg.from?.username
    );

    const dbContext = await DatabaseContext.getInstance();
    const res = await dbContext.validateUser(currentUser);
    await bot.sendMessage(msg.chat.id, res.message, { parse_mode: "HTML"});
}



async function onCancel(msg: TelegramBot.Message){
    endOperation(msg.from!.id);
    await bot.sendMessage(msg.chat.id, "Operation canceled");
}

async function endOperation(userId: number) {
    userStates.delete(userId);
    const dbContext = await DatabaseContext.getInstance();
    dbContext.stagedObjects.delete(userId);
    messagePool.delete(userId);
}



async function onMessageReceived(msg: TelegramBot.Message) {
    console.log(`userStates: ${userStates.size}; stagedObjects: ${(await DatabaseContext.getInstance()).stagedObjects.size}`);
    if (textIsCommand(msg.text)) return;

    const userState = userStates.get(msg.from!.id) || UserState.Idle;

    switch (userState) {
        case UserState.EnterBotToken: 
            try {
                await onTokenReceived(msg);
                await bot.sendMessage(msg.chat.id, "Send csv file with users telegram id");
                userStates.set(msg.from!.id, UserState.SendReceiversFile);
            } catch (error) {
                bot.sendMessage(msg.chat.id, (error as Error).message);
            }

            break;
        case UserState.ChooseBotToUpdate:
            await bot.sendMessage(msg.chat.id, "Choose one of the bots");
            break;
        case UserState.SendReceiversFile: 
            try {
                await onFileReceived(msg);
                const dbContext = await DatabaseContext.getInstance();

                if (await dbContext.updateOrInsertStagedBot(msg.from!.id)) {
                    bot.sendMessage(msg.chat.id, "Bot list updated");
                } else {
                    bot.sendMessage(msg.chat.id, "Error occured");
                }
                await endOperation(msg.from!.id);
            } catch (error) {
                bot.sendMessage(msg.chat.id, (error as Error).message);

                if (error instanceof InternalError) {
                    await endOperation(msg.from!.id);
                }
            }

            break;
        case UserState.EnterMessage:
            onNewsletterMessageReceived(msg);
            break;
        case UserState.MessagePreview:
        case UserState.ChooseBot:
            await bot.sendMessage(msg.chat.id, "Choose one of the options");
            break;
        case UserState.ConfirmNewsletter:
            await bot.sendMessage(msg.chat.id, "Confirm newsletter or reject by typing /cancel");
            break;
        case UserState.Idle:
        default:
            bot.sendMessage(msg.chat.id, "Look up for a list of valid commands");
    }
}


async function onInlineKeyboardClick(ctx: TelegramBot.CallbackQuery) {
    if (!ctx.data) return;

    const sourceMsg = ctx.message;
    if (!sourceMsg) {
        console.log("Callback message is undefined");
        return;
    }

    const keyboardData = parseKeyboardCallback(ctx.data);
    const chatId = sourceMsg.chat.id;
    bot.deleteMessage(chatId, sourceMsg.message_id);
    
    switch (keyboardData.state) {
        case UserState.ChooseBotToUpdate: {
            await bot.sendMessage(chatId, "Send csv file with users telegram id");
            userStates.set(ctx.from!.id, UserState.SendReceiversFile);
            
            const dbContext = await DatabaseContext.getInstance();
            const requiredBot = await dbContext.getBotByInd(ctx.from!.id, keyboardData.buttonIndex);
            
            if (!requiredBot) {
                await bot.sendMessage(chatId, "Selected bot is not found");
                endOperation(ctx.from.id);
            }
            console.log(requiredBot);
            dbContext.stagedObjects.set(ctx.from!.id, requiredBot);
            break;
        }
        case UserState.MessagePreview: {
            if (keyboardData.buttonIndex) {
                endOperation(ctx.from.id);
                userStates.set(ctx.from.id, UserState.EnterMessage);
                await bot.sendMessage(chatId, "Enter new message");
            } else {
                userStates.set(ctx.from.id, UserState.ChooseBot);
                
                const dbContext = await DatabaseContext.getInstance();
                const count = await dbContext.bots.countDocuments({ user_id: ctx.from!.id});
                let resultList = "Your saved bots\n";
                resultList += await dbContext.getBotList(ctx.from!.id);
            
                bot.sendMessage(chatId, resultList, {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: createInlineKeyboard(count, 3, UserState.ChooseBot)
                    }
                });
            }
            break;
        }
        case UserState.ChooseBot: {
            const botInd = keyboardData.buttonIndex;
            messagePool.get(ctx.from.id)!.botInd = botInd;

            const dbContext = await DatabaseContext.getInstance();
            const requiredBot = await dbContext.getBotByInd(ctx.from.id, botInd);
            const newBot = new TelegramBot(requiredBot!.token);
            const text = `Newsletter will be sent via bot "${(await newBot.getMe()).username}".
            Message will receive ${requiredBot?.receivers_count} users.`;

            userStates.set(ctx.from.id, UserState.ConfirmNewsletter);
            await bot.sendMessage(chatId, text, {
                reply_markup: {
                    inline_keyboard: createInlineKeyboard(1, 1, UserState.ConfirmNewsletter, ["Confirm"])
                }
            });
            break;
        }
        case UserState.ConfirmNewsletter: {
            const messagePromises: Promise<void>[] = [];
            const dbContext = await DatabaseContext.getInstance();
            const message = messagePool.get(ctx.from.id);
            const botDoc = await dbContext.getBotByInd(ctx.from.id, message!.botInd!);
            const botToken = botDoc!["token"];
            const helperBot = new TelegramBot(botToken);


            const fileId = botDoc!["csv_file_id"]!;
            const file = await bot.getFile(fileId);
            const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
            const fileContent = (await getResource(url)).toString("utf8");
            const userIds = fileContent.split(",");

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
                    media[0].parse_mode = "HTML"
                }

                let receiverInd = userInd;
                const messagePromise = new Promise<void> ((resolve, reject) => {
                    let sendPromise;
                    if (media) {
                        sendPromise = helperBot.sendMediaGroup(userId, media);
                    } else {
                        sendPromise = helperBot.sendMessage(userId, message!.body!, {
                            parse_mode: "HTML"
                        });
                    }

                    sendPromise
                        .then(() => {
                            //newsletter.setLogResult(botInd, messageInd, receiversListInd, receiverInd, NewsletterResult.Succeeded);
                            removeFromArray(messagePromises, messagePromise);
                            resolve();
                        })
                        .catch((error) => {
                            //newsletter.setLogResult(botInd, messageInd, receiversListInd, receiverInd, NewsletterResult.Failed);
                            removeFromArray(messagePromises, messagePromise);
                            reject(error);
                        });
                        
                });
                messagePromises.push(messagePromise);

                userInd++;
            }

            await Promise.allSettled(messagePromises)

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
}


async function onAddBot(msg: TelegramBot.Message) {
    userStates.set(msg.from!.id, UserState.EnterBotToken);
    await bot.sendMessage(msg.chat.id, "Enter your bot token");
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
        throw new Error(`Error. Unable to establish connection with specified bot.
        Check token validity and bot settings.`);
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

    console.log(newBot instanceof Bot);
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
    userStates.set(msg.from!.id, UserState.ChooseBotToUpdate);

    let resultList = "Choose bot to update\n";
    const dbContext = await DatabaseContext.getInstance();
    const count = await dbContext.bots.countDocuments({ user_id: msg.from!.id});
    resultList += await dbContext.getBotList(msg.from!.id);

    await bot.sendMessage(msg.chat.id, resultList, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: createInlineKeyboard(count, 3, UserState.ChooseBotToUpdate)
        },
    });
}


async function onCreateNewsletter(msg: TelegramBot.Message) {
    userStates.set(msg.from!.id, UserState.EnterMessage);
    await bot.sendMessage(msg.chat.id, "Enter new message");
}

function onNewsletterMessageReceived(msg: TelegramBot.Message) {
    if (msg.media_group_id) {
        let partialMessage = messagePool.get(msg.from!.id);
        if (!partialMessage) {
            partialMessage = new MessageContent(msg.from!.id);
            messagePool.set(msg.from!.id, partialMessage);
        }

        partialMessage.append(msg);
        clearTimeout(partialMessage.mediaGroupEndTimer);
        partialMessage.mediaGroupEndTimer = setTimeout(() => {
            onNewsletterMessageReady(msg);
        }, messageAwaitTime);
    } else {
        let fullMessage = new MessageContent(msg.from!.id);
        fullMessage.append(msg);
        messagePool.set(msg.from!.id, fullMessage);
        onNewsletterMessageReady(msg);
    }
}

async function onNewsletterMessageReady(msg:TelegramBot.Message) {
    const newsletterMsg = messagePool.get(msg.from!.id)!;
    userStates.set(msg.from!.id, UserState.MessagePreview);
    const previewKeyboard =  createInlineKeyboard(2, 2, UserState.MessagePreview, ["Continue", "Recreate"]);
    
    if (newsletterMsg.isMediaGroup()) {
        const media: InputMedia[] = [];
        newsletterMsg.imgIds!.forEach((id) => {
            media.push({ type: 'photo', media: id });
        })
        media[0].caption = newsletterMsg.body;
        media[0].caption_entities = newsletterMsg.entities; 

        await bot.sendMediaGroup(msg.chat.id, media);
        await bot.sendMessage(msg.chat.id, "###########################", {
            reply_markup: {
                inline_keyboard: previewKeyboard
            }
        })
    } else {
        await bot.sendMessage(msg.chat.id, newsletterMsg.body!, {
            entities: newsletterMsg.entities,
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: previewKeyboard
            }
        });
    }
}