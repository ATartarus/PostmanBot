export const userStates: Map<number, UserState> = new Map<number, UserState>();

export enum UserState {
    Idle,
    EnterBotToken,
    SendReceiversFile,
    ChooseBotToUpdate,
    EnterMessage,
    MessagePreview,
    ChooseBot,
    ConfirmNewsletter
}