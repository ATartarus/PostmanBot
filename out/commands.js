"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands = [
    {
        command: "start",
        description: "Start work with bot"
    },
    {
        command: "add_message",
        description: "Add new message to newsletter"
    },
    {
        command: "add_bot",
        description: "Add new bot for newsletter via token"
    },
    {
        command: "add_recievers",
        description: "Add new list of message recievers"
    },
    {
        command: "list_messages",
        description: "List all saved messages"
    },
    {
        command: "list_bots",
        description: "List all saved bots"
    },
    {
        command: "list_recievers",
        description: "List all saved recievers"
    },
    {
        command: "create_newsletter",
        description: "Create newsletter"
    },
    {
        command: "send_newsletter",
        description: "Send created newsletter"
    }
];
exports.default = commands;
