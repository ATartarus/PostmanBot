"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendKeyboardMessage = exports.deleteKeyboardMessages = exports.userStates = exports.activeInlineKeyboards = exports.messagePool = void 0;
exports.messagePool = new Map();
exports.activeInlineKeyboards = new Map();
exports.userStates = new Map();
function deleteKeyboardMessages(bot, chatId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const messages = exports.activeInlineKeyboards.get(userId);
        if (!messages)
            return;
        for (const message of messages) {
            yield bot.deleteMessage(chatId, message);
        }
        exports.activeInlineKeyboards.delete(userId);
    });
}
exports.deleteKeyboardMessages = deleteKeyboardMessages;
function appendKeyboardMessage(userId, messageId) {
    const messages = exports.activeInlineKeyboards.get(userId);
    if (messages) {
        messages.push(messageId);
    }
    else {
        exports.activeInlineKeyboards.set(userId, [messageId]);
    }
}
exports.appendKeyboardMessage = appendKeyboardMessage;
//# sourceMappingURL=containers.js.map