import TelegramBot from "node-telegram-bot-api";
import { NewsletterProperty } from "./newsletter";
import User from "./models/user";
import DatabaseContext from "./services/databaseContext";
import https from "https";

/**
 * Retrieves newsletter property associated with keyboard and index of pressed button from string.
 * @param data string in format "NewsletterProperty:ButtonIndex".
 */
export function parseKeyboardCallback(data: string) {
    const pivot = data.indexOf(':');
    return {
        property: data.substring(0, pivot) as NewsletterProperty,
        buttonIndex: Number.parseInt(data.substring(pivot + 1))
    };
}

export function createInlineKeyboard(buttons: number, cols: number, property: NewsletterProperty) {
    let keyboard = [];
    let row: any[] = [];

    for (let i = 0; i < buttons; i++) {
        if (i % cols == 0) {
            keyboard.push(row);
            row = [];
        }
        row.push({text: (i + 1).toString(), callback_data: property + ":" + i})
    }
    if (row.length > 0) {
        keyboard.push(row);
    }

    return keyboard;
}

//axios подключал, когда пробовал отправлять изображения, но решил что хватит и https. Забыл почистить зависимости.
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

export function removeFromArray(arr: any[], elem: any) {
    let ind = arr.indexOf(elem);
    while (ind != -1) {
        arr.splice(ind, 1);
        ind = arr.indexOf(elem);
    }
}