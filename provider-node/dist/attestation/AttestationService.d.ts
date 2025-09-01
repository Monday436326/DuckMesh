import { InferenceResult, JobSpec } from '../types';
export declare class AttestationService {
    private privateKey;
    constructor();
    generateAttestation(result: InferenceResult, spec: JobSpec): Promise<string>;
    private hashResult;
    private hashJobSpec;
}
//# sourceMappingURL=AttestationService.d.ts.map