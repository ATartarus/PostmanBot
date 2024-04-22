"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToCommand = void 0;
const commands = [
    {
        command: "start",
        description: "Start work with bot",
    },
    {
        command: "add_bot",
        description: "Add new bot for newsletter via token"
    },
    {
        command: "update_bot_receivers",
        description: "Change bot receiver list"
    },
    {
        command: "show_bots",
        description: "Show all saved bots"
    },
    {
        command: "create_newsletter",
        description: "Create newsletter"
    },
    {
        command: "cancel",
        description: "Cancel operation"
    }
];
exports.default = commands;
function textToCommand(text) {
    if (!text)
        return undefined;
    let res = undefined;
    commands.forEach((command) => {
        if (`/${command.command}` == text) {
            res = command.command;
            return;
        }
    });
    return res;
    ;
}
exports.textToCommand = textToCommand;
//# sourceMappingURL=commands.js.map