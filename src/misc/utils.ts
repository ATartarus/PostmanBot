import https from "https";
import { UserState } from "./userState";
import TelegramBot from "node-telegram-bot-api";


export function initBot(polling: boolean): TelegramBot {
    let options: TelegramBot.ConstructorOptions;
    if (polling) {
        options = { polling: {
            interval: 300,
            autoStart: true
        }};
    } else {
        options = { webHook: { 
            port: +process.env.PORT! 
        }};
    }
    const bot = new TelegramBot(
        process.env.API_TOKEN!,
        options
    );
    
    if (polling) {
        bot.on("polling_error", err => console.log(err.message));
    } else {
        bot.setWebHook(`${process.env.APP_URL}/bot${process.env.API_TOKEN}`);
    }

    return bot;
}

/**
 * Retrieves newsletter property associated with keyboard and index of pressed button from string.
 * @param data string in format "UserState:ButtonIndex".
 */
export function parseKeyboardCallback(data: string) {
    const pivot = data.indexOf(':');
    return {
        state: parseInt(data.substring(0, pivot)) as UserState,
        buttonIndex: Number.parseInt(data.substring(pivot + 1))
    };
}

export function createInlineKeyboard(buttons: number, cols: number, state: UserState, labels?: string[]) {
    let keyboard = [];
    let row: any[] = [];

    for (let i = 0; i < buttons; i++) {
        if (i % cols == 0) {
            keyboard.push(row);
            row = [];
        }
        const text: string = labels ? labels[i] : (i + 1).toString();
        row.push({text: text ?? (i + 1).toString(), callback_data: `${state}:${i}`})
    }
    if (row.length > 0) {
        keyboard.push(row);
    }

    return keyboard;
}


export async function getResource(url: string): Promise<Buffer> {
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


type Predicate<T> = (value: T, index: number, obj: T[]) => unknown;
export function removeFromArray<T>(arr: T[], option: Predicate<T>): void;
export function removeFromArray<T>(arr: T[], option: T): void;
export function removeFromArray<T>(arr: T[], option: T | Predicate<T>): void {
    const isFunc = typeof option === "function";

    let ind = isFunc ? arr.findIndex(option as Predicate<T>) : arr.indexOf(option);
    while (ind != -1) {
        arr.splice(ind, 1);
        ind = isFunc ? arr.findIndex(option as Predicate<T>) : arr.indexOf(option);
    }
}