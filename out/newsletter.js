"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Newsletter {
    constructor() {
        this.messages = [];
        this.bots = [];
        this.recievers = [];
    }
    isValid() {
        return this.messages.length > 0 && this.bots.length > 0 && this.recievers.length > 0;
    }
}
exports.default = Newsletter;
