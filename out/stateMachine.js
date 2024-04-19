"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserState = exports.userStates = void 0;
exports.userStates = new Map();
var UserState;
(function (UserState) {
    UserState[UserState["Idle"] = 0] = "Idle";
    UserState[UserState["EnterBotToken"] = 1] = "EnterBotToken";
    UserState[UserState["SendReceiversFile"] = 2] = "SendReceiversFile";
    UserState[UserState["EnterMessage"] = 3] = "EnterMessage";
    UserState[UserState["ChooseBot"] = 4] = "ChooseBot";
})(UserState || (exports.UserState = UserState = {}));
//# sourceMappingURL=stateMachine.js.map