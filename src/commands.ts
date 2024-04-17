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
        command: "add_receivers",
        description: "Add new list of message receivers"
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
        command: "list_receivers",
        description: "List all saved receivers"
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

export default commands;

export function textIsCommand(text: string | undefined) {
    if (!text) return false;
    
    let textIsCommand = false;
    commands.forEach((command) => {
        if (`/${command.command}` == text) {
            textIsCommand = true;
            return;
        }
    });

    return textIsCommand;
}