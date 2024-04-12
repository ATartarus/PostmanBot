import dotenv from "dotenv";
import https from "https";
import TelegramBot, { InputMedia } from "node-telegram-bot-api";
import User from "./models/user";
import DatabaseContext from "./services/databaseContext";
import Token from "./models/bot";
import RecieversList from "./models/recieversList";
import Newsletter from "./newsletter";
import MessageBuilder from "./services/messageBuilder";
import commands from "./commands";


dotenv.config();

let currentUser: User;
let newsletter = new Newsletter();
let waitingInput = false;


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
        builder.timeout = setTimeout(async () => {
            await onMessageAddCallback();
        }, 1000);
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
    await dbContext.messages.insertOne(message)
        .then((doc) => {
            dbContext.validateCollectionSize(dbContext.messages, currentUser.id);
            bot.sendMessage(currentUser.id, "Message added successfully!");
        })
        .catch((error) => {
            bot.sendMessage(currentUser.id, "Error. Message was not added!");
        });
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
        await userBot.getMe()
            .then(async (userBot) => {
                const token = new Token(currentUser.id, botToken);
                const dbContext = await DatabaseContext.getInstance();

                await dbContext.bots.insertOne(token)
                    .then((doc) => {
                        dbContext.validateCollectionSize(dbContext.bots, currentUser.id);
                        bot.sendMessage(msg.chat.id, "Bot added successfully!");
                    })
                    .catch((error) => {
                        bot.sendMessage(msg.chat.id, "Error. Bot was not added!");
                    });
            })
            .catch((error) => {
                bot.sendMessage(msg.chat.id, `Error. Unable to establish connection with specified bot.
                    Check token validity and bot settings.`);
            })
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

        const recievers = new RecieversList(currentUser.id, msg.document.file_id, msg.caption);
        const dbContext = await DatabaseContext.getInstance();

        await dbContext.recievers.insertOne(recievers)
            .then((doc) => {
                dbContext.validateCollectionSize(dbContext.recievers, currentUser.id);
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
    let list = await dbContext.getMessageList(currentUser.id);
    let count = await dbContext.messages.countDocuments({ user_id: currentUser.id });

    let keyboard = [];
    let row: any[] = [];

    for (let i = 0; i < count; i++) {
        if (i % 3 == 0) {
            keyboard.push(row);
            row = [];
        }
        row.push({text: (i + 1).toString(), callback_data: 'm' + i})
    }
    if (row.length > 0) {
        keyboard.push(row);
    }

    await bot.sendMessage(currentUser.id, list, {
        reply_markup: {
            inline_keyboard: keyboard
        }
    });

    list = await dbContext.getBotList(currentUser.id);
    count = await dbContext.bots.countDocuments({ user_id: currentUser.id });
    
    keyboard = [];
    row = [];

    for (let i = 0; i < count; i++) {
        if (i % 3 == 0) {
            keyboard.push(row);
            row = [];
        }
        row.push({text: (i + 1).toString(), callback_data: 'b' + i})
    }
    if (row.length > 0) {
        keyboard.push(row);
    }

    await bot.sendMessage(currentUser.id, list, {
        reply_markup: {
            inline_keyboard: keyboard
        }
    });

    list = await dbContext.getRecieverList(currentUser.id);
    count = await dbContext.recievers.countDocuments({ user_id: currentUser.id });
    keyboard = [];
    row = [];

    for (let i = 0; i < count; i++) {
        if (i % 3 == 0) {
            keyboard.push(row);
            row = [];
        }
        row.push({text: (i + 1).toString(), callback_data: 'r' + i})
    }
    if (row.length > 0) {
        keyboard.push(row);
    }

    await bot.sendMessage(currentUser.id, list, {
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
}

bot.on('callback_query', async (ctx) => {
    const data = ctx.data;
    if (data == undefined) return;

    if (data.charAt(0) == 'm') {
        newsletter.messages.push(Number.parseInt(data.substring(1)));
    }
    else if (data.charAt(0) == 'b') {
        newsletter.bots.push(Number.parseInt(data.substring(1)));
    }
    else if (data.charAt(0) == 'r') {
        newsletter.recievers.push(Number.parseInt(data.substring(1)));
    }
})


async function onSendNewsletter() {
    if (!newsletter.isValid()) {
        bot.sendMessage(currentUser.id, "Newsletter must contain at least one message/bot/reciever");
        return;
    }

    const dbContext = await DatabaseContext.getInstance();
    const messages = await dbContext.messages.find({ user_id: currentUser.id }).toArray();
    const bots = await dbContext.bots.find({ user_id: currentUser.id }).toArray();
    const recievers = await dbContext.recievers.find({ user_id: currentUser.id }).toArray();

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

            newsletter.recievers.forEach(async (recieverInd) => {
                const fileId = recievers[recieverInd]["csv_file_id"];
                const file = await bot.getFile(fileId);
                const url = `https://api.telegram.org/file/bot${process.env.API_TOKEN}/${file.file_path}`;
                const fileContent = (await getResource(url)).toString("utf8");
                const userIds = fileContent.split(",");

                userIds.forEach(async (userId) => {
                    if (imgIds != null) {
                        const imgFiles = await Promise.all(imgIds.map(async (id) => await bot.getFile(id)));                        
                        const responses = await Promise.all(imgFiles.map(async (file) => {
                            const url = `https://api.telegram.org/file/bot${process.env.API_TOKEN}/${file.file_path}`;    
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

async function getResource(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const chunks: Uint8Array[] = [];
            response.on("data", (chunk) => {
                chunks.push(chunk);
            })
            response.on("end", () => {
                resolve(Buffer.concat(chunks));
            });
        }).on("error", (error) =>{
            reject(error);
        })
    });
}