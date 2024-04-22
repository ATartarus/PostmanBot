"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserState = void 0;
var UserState;
(function (UserState) {
    UserState[UserState["Idle"] = 0] = "Idle";
    UserState[UserState["EnterBotToken"] = 1] = "EnterBotToken";
    UserState[UserState["SendReceiversFile"] = 2] = "SendReceiversFile";
    UserState[UserState["ChooseBotToUpdate"] = 3] = "ChooseBotToUpdate";
    UserState[UserState["EnterMessage"] = 4] = "EnterMessage";
    UserState[UserState["MessagePreview"] = 5] = "MessagePreview";
    UserState[UserState["ChooseBot"] = 6] = "ChooseBot";
    UserState[UserState["ConfirmNewsletter"] = 7] = "ConfirmNewsletter";
})(UserState || (exports.UserState = UserState = {}));
//# sourceMappingURL=userState.js.map