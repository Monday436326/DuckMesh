"use strict";
// provider-node/src/attestation/AttestationService.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttestationService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class AttestationService {
    constructor() {
        // In production, this would be the TEE private key
        this.privateKey = crypto_1.default.randomBytes(32);
    }
    async generateAttestation(result, spec) {
        try {
            // Create attestation payload
            const payload = {
                result_hash: this.hashResult(result),
                spec_hash: this.hashJobSpec(spec),
                timestamp: Date.now(),
                model_version: result.metadata.modelVersion,
                execution_time: result.metadata.executionTime
            };
            // Sign the payload
            const payloadString = JSON.stringify(payload);
            const signature = crypto_1.default.sign('sha256', Buffer.from(payloadString), this.privateKey);
            return signature.toString('base64');
        }
        catch (error) {
            console.error('Attestation generation failed:', error);
            return '';
        }
    }
    hashResult(result) {
        const data = {
            output: result.output,
            tokensUsed: result.metadata.tokensUsed
        };
        return crypto_1.default.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }
    hashJobSpec(spec) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(spec)).digest('hex');
    }
}
exports.AttestationService = AttestationService;
//# sourceMappingURL=AttestationService.js.map