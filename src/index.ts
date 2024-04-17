import dotenv from "dotenv";
import TelegramBot, { InputMedia } from "node-telegram-bot-api";
import DatabaseContext from "./services/databaseContext";
import Token from "./models/bot";
import User from "./models/user";
import ReceiversList from "./models/receiversList";
import Newsletter, { NewsletterProperty, newsletterPool } from "./newsletter";
import MessageBuilder, { messageBuilderPool, messageAwaitTime, fillMessageBuilder } from "./services/messageBuilder";
import commands, { textIsCommand } from "./commands";
import { getResource, createInlineKeyboard, parseKeyboardCallback, removeFromArray } from "./utils";

dotenv.config();

const baseBotUrl = "https://api.telegram.org/file/bot";
//List of the users that should send token, csv file or message so bot is waiting for their input.
const awaitingList: number[] = [];


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

/**
 * Initializes message building by pushing new MessageBuilder with sender id into messageBuilderPool.
 * Or creates message directly if not media group.
 */
async function onAddMessage(msg: TelegramBot.Message) {    
    bot.sendMessage(msg.chat.id, "Enter new message");

    awaitingList.push(msg.from!.id);

    bot.once("message", async (msg) => {
        if (textIsCommand(msg.text)) return;
        
        const builder = new MessageBuilder(msg.from!.id);
        if (msg.media_group_id) {
            messageBuilderPool.push(builder);
            return;
        } else {
            fillMessageBuilder(builder, msg);
            onMessageBuildEnded(builder);
        }
    });
}

async function onMessageReceived(msg: TelegramBot.Message) {
    const awaiting = awaitingList.find((userId) => userId == msg.from?.id);

    if (!textIsCommand(msg.text) && !awaiting) {
        bot.sendMessage(msg.chat.id, "Look up for the list of valid commands");
    }

    removeFromArray(awaitingList, msg.from!.id);
}

async function onPhotoRecieved(msg: TelegramBot.Message) {
    const builder = messageBuilderPool.find((builder) => builder.getUserId() == msg.from!.id);

    if (builder) {
        fillMessageBuilder(builder, msg);
        awaitingList.push(builder.getUserId());
        
        if (builder.timeout) clearTimeout(builder.timeout);
        /*
        Единственный таймаут в проекте, мне и самому не хотелось его сюда пихать, но он тут просто необходим
        т.к. при отправке MediaGroup (нескольких изображений в одном сообшений) тг отсылает каждую пикчу отдельным сообщением,
        и если принадлежность сообщения к группе можно определить через msg.media_group_id, то конец этой группы никак не помечается.
        Остается только просить пользователя подтверждать отправку, либо юзать таймаут.
        */
        builder.timeout = setTimeout(async () => {
            await onMessageBuildEnded(builder);
        }, messageAwaitTime);
    }
}

/**
 * Called upon end of message building. Retrieves message from MessageBuilder,
 * removes builder from messageBuilderPool and adds message to database.
 * @param builder - MessageBuilder that ended building
 */
async function onMessageBuildEnded(builder: MessageBuilder) {
    const message = builder.getMessage();

    removeFromArray(messageBuilderPool, builder);
    removeFromArray(awaitingList, builder.getUserId());

    if (message.isEmpty()) {
        bot.sendMessage(builder.getUserId(), "Error. Message was not added");
        return;
    }

    const dbContext = await DatabaseContext.getInstance();

    try {
        await dbContext.messages.insertOne(message);
        dbContext.validateCollectionSize(dbContext.messages, builder.getUserId());
        bot.sendMessage(builder.getUserId(), "Message added successfully!");
    } catch (error) {
        bot.sendMessage(builder.getUserId(), "Error. Message was not added!");
    }
}

async function onListMessages(msg: TelegramBot.Message) {
    const dbContext = await DatabaseContext.getInstance();
    const resultList = await dbContext.getMessageList(msg.from!.id);

    bot.sendMessage(msg.chat.id, resultList);
}

/**
 * Recieves token from user, checks its validity and adds to the database.
 */
async function onAddBot(msg: TelegramBot.Message) {
    bot.sendMessage(msg.chat.id, "Enter your bot token:")
    awaitingList.push(msg.from!.id);

    bot.once("message", async (msg) => {
        if (textIsCommand(msg.text)) return;

        const botToken = msg.text;
        if (!botToken) {
            await bot.sendMessage(msg.chat.id, "You must send bot token");
            return;
        }

        const userBot = new TelegramBot(botToken);
        try {
            await userBot.getMe();

            try {
                const dbContext = await DatabaseContext.getInstance();
                const token = new Token(msg.from!.id, botToken);

                await dbContext.bots.insertOne(token);
                dbContext.validateCollectionSize(dbContext.bots, msg.from!.id);
                await bot.sendMessage(msg.chat.id, "Bot added successfully!");
            } catch (error) {
                await bot.sendMessage(msg.chat.id, "Error. Bot was not added!");
            }

        } catch (error) {
            await bot.sendMessage(msg.chat.id, `Error. Unable to establish connection with specified bot.
            Check token validity and bot settings.`);
        }
    });
}

async function onListBots(msg: TelegramBot.Message) {
    const dbContext = await DatabaseContext.getInstance();
    const resultList = await dbContext.getBotList(msg.from!.id);

    bot.sendMessage(msg.chat.id, resultList);
}

/**
 * Recieves csv file from user and adds its id to the database.
 */
async function onAddRecievers(msg: TelegramBot.Message) {
    bot.sendMessage(msg.chat.id, "Send csv file with users id");
    awaitingList.push(msg.from!.id);
    
    bot.once("message", async (msg) => {
        if (textIsCommand(msg.text)) return;

        if (!msg.document){
            await bot.sendMessage(msg.chat.id, "You must send csv file");
            return;
        }

        const recievers = new ReceiversList(msg.from!.id, msg.document.file_id, msg.caption);
        const dbContext = await DatabaseContext.getInstance();

        try {
            await dbContext.receivers.insertOne(recievers);
            dbContext.validateCollectionSize(dbContext.receivers,(msg.from!.id));
            bot.sendMessage(msg.chat.id, "File added successfully!");
        }
        catch (error) {
            bot.sendMessage(msg.chat.id, "Error. File was not added!");
        }
    });
}

async function onListReceivers(msg: TelegramBot.Message) {
    const dbContext = await DatabaseContext.getInstance();
    const resultList = await dbContext.getReceiverList(msg.from!.id);

    bot.sendMessage(msg.chat.id, resultList);
}

/**
 * Lists user messages, bots and receivers. Adds keyboard under each list for selection.
 * Creates new Newsletter with user id and pushes it to the newsletter pool. 
 */
async function onCreateNewsletter(msg: TelegramBot.Message) {
    newsletterPool.push(new Newsletter(msg.from!.id));
    const dbContext = await DatabaseContext.getInstance();

    //Строковый енам не поддерживает реверс маппинг(
    for (const property of [NewsletterProperty.Messages, NewsletterProperty.Bots, NewsletterProperty.Receivers]) {
        let list = "Not found";
        let count = 0;
        
        switch (property) {
            case NewsletterProperty.Messages:
                list = await dbContext.getMessageList(msg.from!.id);
                //можно было бы обращаться к dbContext.messages/bots/receivers через NewsletterProperty как в обработчике callback_query ниже,
                //но тогда NewsletterProperty было бы уже и DatabaseContextProperty. Сокращается две строчки но вносится лишняя зависимость.
                count = await dbContext.messages.countDocuments({ user_id: msg.from!.id });
                break;
            case NewsletterProperty.Bots:
                list = await dbContext.getBotList(msg.from!.id);
                count = await dbContext.bots.countDocuments({ user_id: msg.from!.id });
                break;
            case NewsletterProperty.Receivers:
                list = await dbContext.getReceiverList(msg.from!.id);
                count = await dbContext.receivers.countDocuments({ user_id: msg.from!.id });
                break;
        }

        await bot.sendMessage(msg.chat.id, list, {
            reply_markup: {
                inline_keyboard: createInlineKeyboard(count, 3, property as NewsletterProperty)
            }
        });
    }
}


bot.on('callback_query', async (ctx) => {
    if (ctx.data == undefined) return;

    const keyboardData = parseKeyboardCallback(ctx.data);
    const newsletter = newsletterPool.find((obj) => obj.getUserId() == ctx.from!.id);

    if (!newsletter) {
        console.log("Could not find newsletter in the pool with userid = ", ctx.from!.id);
    }
    else {
        newsletter[keyboardData.property].push(keyboardData.buttonIndex);
    }
})


/**
 * Sends newsletter with corresponding user id from newsletterPool.
 * Each message is sent by each bot to the each of users.
 */
async function onSendNewsletter(msg: TelegramBot.Message) {
    const newsletter = newsletterPool.find((obj) => obj.getUserId() == msg.from!.id);
    if (!newsletter) {
        bot.sendMessage(msg.chat.id, "You must create newsletter with create_newsletter command");
        return;
    }
    if (!newsletter.isValid()) {
        bot.sendMessage(msg.chat.id, "Newsletter must contain at least one message, bot and reciever");
        return;
    }

    const dbContext = await DatabaseContext.getInstance();
    const messages = await dbContext.messages.find({ user_id: msg.from!.id }).toArray();
    const bots = await dbContext.bots.find({ user_id: msg.from!.id }).toArray();
    const recievers = await dbContext.receivers.find({ user_id: msg.from!.id }).toArray();

    newsletter.messages.forEach(async (messageInd) => {
        const messageDoc = messages[messageInd];
        const imgIds: string[] = messageDoc["img_id"];

        let message = "";
        if (messageDoc["subject"]) {
            message += `<b>${messageDoc["subject"]}</b>\n\n`;
        }
        if (messageDoc["body"]) {
            message += messageDoc["body"];
        }

        newsletter.bots.forEach(async (botInd) => {
            const botToken = bots[botInd]["token"];
            const helperBot = new TelegramBot(botToken);

            newsletter.receivers.forEach(async (recieverInd) => {
                const fileId = recievers[recieverInd]["csv_file_id"];
                const file = await bot.getFile(fileId);
                const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`;
                const fileContent = (await getResource(url)).toString("utf8");
                const userIds = fileContent.split(",");

                userIds.forEach(async (userId) => {
                    if (imgIds != null) {
                        const imgFiles = await Promise.all(imgIds.map(async (id) => await bot.getFile(id)));                        
                        const responses = await Promise.all(imgFiles.map(async (file) => {
                            const url = `${baseBotUrl}${process.env.API_TOKEN}/${file.file_path}`; 
                            return await getResource(url);
                        }));
                        
                        const media: InputMedia[] = [];
                        responses.forEach(response => {
                            media.push({ type: 'photo', media: response as any});
                        });

                        media[0].caption = message;
                        media[0].parse_mode = "HTML"
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
                        });;
                    }
                });
            })
        })
    });

    bot.sendMessage(msg.chat.id, "Newsletter sended!");
    removeFromArray(newsletterPool, newsletter);
}