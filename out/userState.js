"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserState = exports.userStates = void 0;
exports.userStates = new Map();
var UserState;
(function (UserState) {
    UserState[UserState["Idle"] = 0] = "Idle";
    UserState[UserState["EnterBotToken"] = 1] = "EnterBotToken";
    UserState[UserState["SendReceiversFile"] = 2] = "SendReceiversFile";
    UserState[UserState["ChooseBotToUpdate"] = 3] = "ChooseBotToUpdate";
    UserState[UserState["EnterMessage"] = 4] = "EnterMessage";
    UserState[UserState["ChooseBot"] = 5] = "ChooseBot";
})(UserState || (exports.UserState = UserState = {}));
//# sourceMappingURL=userState.js.map