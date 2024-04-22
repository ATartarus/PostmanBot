import { UserState } from "./userState";
import MessageContent from "../entity/messageContent";
import TelegramBot from "node-telegram-bot-api";


export const messagePool: Map<number, MessageContent> = new Map<number, MessageContent>();
export const activeInlineKeyboards: Map<number, number[]> = new Map<number, number[]>();
export const userStates: Map<number, UserState> = new Map<number, UserState>();


export async function deleteKeyboardMessages(bot: TelegramBot, chatId: number, userId: number) {
    const messages = activeInlineKeyboards.get(userId);
    if (!messages) return;
    for (const message of messages) {
        await bot.deleteMessage(chatId, message);
    }
    activeInlineKeyboards.delete(userId);
}

export function appendKeyboardMessage(userId: number, messageId: number) {
    const messages = activeInlineKeyboards.get(userId);
    if (messages) {
        messages.push(messageId);
    } else {
        activeInlineKeyboards.set(userId, [messageId]);
    }
}