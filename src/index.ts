import dotenv from "dotenv";
import TelegramBot, { InputMedia } from "node-telegram-bot-api";
import User from "./models/user";
import DatabaseContext from "./services/databaseContext";
import Token from "./models/bot";
import ReceiversList from "./models/receiversList";
import Newsletter, { NewsletterProperty } from "./newsletter";
import MessageBuilder from "./services/messageBuilder";
import commands from "./commands";
import { getResource, createInlineKeyboard, parseKeyboardCallback } from "./utils";

dotenv.config();

const baseBotUrl = "https://api.telegram.org/file/bot";

let currentUser: User;
let newsletter = new Newsletter();

let waitingInput = false;
//Таймер отправки последнего сообщения в группе
const messageAwaitTime = 1000;


const bot = new TelegramBot(
    process.env.API_TOKEN!,
    //{ webHook: { port: +process.env.PORT! } }
    { polling: {
        interval: 300,
        autoStart: true
      }}
);

bot.on("polling_error", err => console.log(err.message));
//bot.setWebHook(`${process.env.APP_URL}/bot${process.env.API_TOKEN}`);

bot.setMyCommands(commands);

bot.onText(/\/start/, onStart);
bot.onText(/\/add_message/, onAddMessage);
bot.onText(/\/add_bot/, onAddBot);
bot.onText(/\/add_recievers/, onAddRecievers);
bot.onText(/\/list_messages/, onListMessages);
bot.onText(/\/list_bots/, onListBots);
bot.onText(/\/list_recievers/, onListRecievers);
bot.onText(/\/create_newsletter/, onCreateNewsletter);
bot.onText(/\/send_newsletter/, onSendNewsletter);


bot.on("message", async (msg) => {
    const builder = MessageBuilder.getInstance();
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
                while(messageBody.charAt(++end) == '\n');
                messageBody = messageBody.substring(end);
            }
        }
        if (messageBody) {
            builder.appendBody(messageBody);
        }

        
        if (builder.timeout) clearTimeout(builder.timeout);
        /*
        Единственный таймаут в проекте, мне и самому не хотелось его сюда пихать, но он тут просто необходим
        т.к. при отправке MediaGroup (нескольких изображений в одном сообшений) тг отсылает каждую пикчу отдельным сообщением,
        и если принадлежность сообщения к группе можно определить через msg.media_group_id, то конец этой группы никак не помечается.
        Остается только просить пользователя подтверждать отправку, либо юзать таймаут.
        */
        builder.timeout = setTimeout(async () => {
            await onMessageAddCallback();
        }, messageAwaitTime);
    }
    else if (msg.text) {
        let textIsCommand = false;
        commands.forEach((command) => {
            if (`/${command.command}` == msg.text) {
                textIsCommand = true;
                return;
            }
        });

        if (!textIsCommand && !waitingInput) {
            bot.sendMessage(msg.chat.id, "Look up for a list of valid commands");
        }
    }
});


async function onStart(msg: TelegramBot.Message): Promise<void> {
    if (currentUser) {
        bot.sendMessage(msg.chat.id, "<i>Bot is ready!</i>", { parse_mode: "HTML"});
        return;
    };
    bot.sendMessage(msg.chat.id, "<i>Initializing...</i>", { parse_mode: "HTML"});

    currentUser = new User(
        msg.from?.id!,
        msg.from?.first_name,
        msg.from?.username
    );

    const dbContext = await DatabaseContext.getInstance();

    try {
        const exists = await dbContext.users.findOne({ id: currentUser.id });

        if (exists) {
            await bot.sendMessage(msg.chat.id, "<i>User already exists, bot is ready!</i>", { parse_mode: "HTML"});
            return;
        }
        else {
            const res = await dbContext.users.insertOne(currentUser);
            if (!res.acknowledged) console.log("insert error");
        }
    } catch(error) {
        console.error(error);
    }

    const message = "<i>User " + (currentUser.username == undefined
    ? `with id ${currentUser.id}`
    : `${currentUser.username}`)
    + " has been recorded. Bot is ready!</i>";

    await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML"});
}


async function onAddMessage() {    
    bot.sendMessage(currentUser.id, "Enter new message");
    MessageBuilder.getInstance().init(currentUser.id);
}

async function onMessageAddCallback() {
    const builder = MessageBuilder.getInstance();
    const message = builder.getMessage();
    builder.close();
    if (!message) {
        bot.sendMessage(currentUser.id, "Error. Message was not added");
        return;
    }

    const dbContext = await DatabaseContext.getInstance();

    try {
        await dbContext.messages.insertOne(message);
        dbContext.validateCollectionSize(dbContext.messages, currentUser.id);
        bot.sendMessage(currentUser.id, "Message added successfully!");
    } catch (error) {
        bot.sendMessage(currentUser.id, "Error. Message was not added!");
    }
}

async function onListMessages() {
    const dbContext = await DatabaseContext.getInstance();
    const resultList = await dbContext.getMessageList(currentUser.id);

    bot.sendMessage(currentUser.id, resultList);
}


async function onAddBot() {
    bot.sendMessage(currentUser.id, "Enter your bot token:")
    waitingInput = true;

    bot.once("text", async (msg) => {
        waitingInput = false;

        const botToken = msg.text!;
        const userBot = new TelegramBot(botToken);

        try {
            await userBot.getMe();

            try {
                const dbContext = await DatabaseContext.getInstance();
                const token = new Token(currentUser.id, botToken);

                await dbContext.bots.insertOne(token);
                dbContext.validateCollectionSize(dbContext.bots, currentUser.id);
                bot.sendMessage(msg.chat.id, "Bot added successfully!");
            } catch (error) {
                bot.sendMessage(msg.chat.id, "Error. Bot was not added!");
            }

        } catch (error) {
            bot.sendMessage(msg.chat.id, `Error. Unable to establish connection with specified bot.
            Check token validity and bot settings.`);
        }
    });
}

async function onListBots() {
    const dbContext = await DatabaseContext.getInstance();
    const resultList = await dbContext.getBotList(currentUser!.id);

    bot.sendMessage(currentUser.id, resultList);
}


async function onAddRecievers() {
    bot.sendMessage(currentUser.id, "Send csv file with users id");
    
    bot.once("message", async (msg) => {
        if (!msg.document){
            bot.sendMessage(msg.chat.id, "You must send csv file");
            return;
        }

        const recievers = new ReceiversList(currentUser.id, msg.document.file_id, msg.caption);
        const dbContext = await DatabaseContext.getInstance();

        await dbContext.receivers.insertOne(recievers)
            .then((doc) => {
                dbContext.validateCollectionSize(dbContext.receivers, currentUser.id);
                bot.sendMessage(msg.chat.id, "File added successfully!");
            })
            .catch((error) => {
                bot.sendMessage(msg.chat.id, "Error. File was not added!");
            });
    });
}

async function onListRecievers() {
    const dbContext = await DatabaseContext.getInstance();
    const resultList = await dbContext.getRecieverList(currentUser.id);

    bot.sendMessage(currentUser.id, resultList);
}


async function onCreateNewsletter() {
    newsletter = new Newsletter();
    const dbContext = await DatabaseContext.getInstance();

    //Строковый енам не поддерживает реверс маппинг(
    for (const property of [NewsletterProperty.Messages, NewsletterProperty.Bots, NewsletterProperty.Receivers]) {
        let list = "Not found";
        let count = 0;
        
        switch (property) {
            case NewsletterProperty.Messages:
                list = await dbContext.getMessageList(currentUser.id);
                //можно было бы обращаться к dbContext.messages/bots/receivers через NewsletterProperty как в обработчике callback_query ниже,
                //но тогда NewsletterProperty было бы уже и DatabaseContextProperty. Сокращается две строчки но вносится лишняя зависимость.
                count = await dbContext.messages.countDocuments({ user_id: currentUser.id });
                break;
            case NewsletterProperty.Bots:
                list = await dbContext.getBotList(currentUser.id);
                count = await dbContext.bots.countDocuments({ user_id: currentUser.id });
                break;
            case NewsletterProperty.Receivers:
                list = await dbContext.getRecieverList(currentUser.id);
                count = await dbContext.receivers.countDocuments({ user_id: currentUser.id });
                break;
        }

        await bot.sendMessage(currentUser.id, list, {
            reply_markup: {
                inline_keyboard: createInlineKeyboard(count, 3, property as NewsletterProperty)
            }
        });
    }
}

bot.on('callback_query', async (ctx) => {
    if (ctx.data == undefined) return;

    const keyboardData = parseKeyboardCallback(ctx.data);
    newsletter[keyboardData.property].push(keyboardData.buttonIndex);
})


async function onSendNewsletter() {
    if (!newsletter.isValid()) {
        bot.sendMessage(currentUser.id, "Newsletter must contain at least one message/bot/reciever");
        return;
    }

    const dbContext = await DatabaseContext.getInstance();
    const messages = await dbContext.messages.find({ user_id: currentUser.id }).toArray();
    const bots = await dbContext.bots.find({ user_id: currentUser.id }).toArray();
    const recievers = await dbContext.receivers.find({ user_id: currentUser.id }).toArray();

    newsletter.messages.forEach(async (messageInd) => {
        const messageDoc = messages[messageInd];
        const imgIds: string[] = messageDoc["img_id"];

        let message = "";
        if (messageDoc["subject"] != null) {
            message += `<b>${messageDoc["subject"]}</b>\n\n`;
        }
        message += messageDoc["body"];

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

    bot.sendMessage(currentUser.id, "Newsletter sended!");
}