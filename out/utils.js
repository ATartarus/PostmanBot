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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResource = exports.createInlineKeyboard = exports.parseKeyboardCallback = void 0;
const https_1 = __importDefault(require("https"));
/**
 * Retrieves newsletter property associated with keyboard and index of pressed button from string.
 * @param data string in format "NewsletterProperty:ButtonIndex".
 */
function parseKeyboardCallback(data) {
    const pivot = data.indexOf(':');
    return {
        property: data.substring(0, pivot),
        buttonIndex: Number.parseInt(data.substring(pivot + 1))
    };
}
exports.parseKeyboardCallback = parseKeyboardCallback;
function createInlineKeyboard(buttons, cols, property) {
    let keyboard = [];
    let row = [];
    for (let i = 0; i < buttons; i++) {
        if (i % cols == 0) {
            keyboard.push(row);
            row = [];
        }
        row.push({ text: (i + 1).toString(), callback_data: property + ":" + i });
    }
    if (row.length > 0) {
        keyboard.push(row);
    }
    return keyboard;
}
exports.createInlineKeyboard = createInlineKeyboard;
//axios подключал, когда пробовал отправлять изображения, но решил что хватит и https. Забыл почистить зависимости.
function getResource(url) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            https_1.default.get(url, (response) => {
                const chunks = [];
                response.on("data", (chunk) => {
                    chunks.push(chunk);
                });
                response.on("end", () => {
                    resolve(Buffer.concat(chunks));
                });
            }).on("error", (error) => {
                reject(error);
            });
        });
    });
}
exports.getResource = getResource;
