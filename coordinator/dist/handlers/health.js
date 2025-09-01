"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = void 0;
const check = async () => {
    return {
        statusCode: 200,
        body: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'duckmesh-coordinator'
        })
    };
};
exports.check = check;
