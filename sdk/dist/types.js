"use strict";
// sdk/src/types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationMode = exports.JobStatus = void 0;
var JobStatus;
(function (JobStatus) {
    JobStatus[JobStatus["Pending"] = 0] = "Pending";
    JobStatus[JobStatus["Assigned"] = 1] = "Assigned";
    JobStatus[JobStatus["Completed"] = 2] = "Completed";
    JobStatus[JobStatus["Disputed"] = 3] = "Disputed";
    JobStatus[JobStatus["Finalized"] = 4] = "Finalized";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var VerificationMode;
(function (VerificationMode) {
    VerificationMode[VerificationMode["Redundant"] = 0] = "Redundant";
    VerificationMode[VerificationMode["ReferenceCheck"] = 1] = "ReferenceCheck";
    VerificationMode[VerificationMode["Attestation"] = 2] = "Attestation";
    VerificationMode[VerificationMode["ZkML"] = 3] = "ZkML";
})(VerificationMode || (exports.VerificationMode = VerificationMode = {}));
