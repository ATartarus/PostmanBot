"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textIsCommand = void 0;
const commands = [
    {
        command: "start",
        description: "Start work with bot"
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
function textIsCommand(text) {
    if (!text)
        return false;
    let textIsCommand = false;
    commands.forEach((command) => {
        if (`/${command.command}` == text) {
            textIsCommand = true;
            return;
        }
    });
    return textIsCommand;
}
exports.textIsCommand = textIsCommand;
//# sourceMappingURL=commands.js.map