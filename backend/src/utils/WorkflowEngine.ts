export type WorkflowType = 'BAPTISM' | 'DEDICATION';

export const PIPELINES: Record<WorkflowType, string[]> = {
    BAPTISM: [
        'PENDING_PASTOR_APPROVAL',
        'ADMIN_PAYMENT_VERIFICATION',
        'BISHOP_APPROVED',
        'COMPLETED'
    ],
    DEDICATION: [
        'PENDING_DEDICATION',
        'ADMIN_PAYMENT_VERIFICATION',
        'BISHOP_RITE_PENDING',
        'DEDICATED'
    ]
};

export class WorkflowEngine {
    /**
     * Verifies if a transition is valid and does not skip mandatory steps.
     * Backwards transitions (demotions, re-dos) are generally allowed, but skipping forward is prohibited.
     */
    static isValidTransition(
        workflow: WorkflowType,
        currentStatus: string,
        newStatus: string
    ): boolean {
        // Special case: REJECTED or CANCELED can usually happen from anywhere
        if (newStatus === 'REJECTED' || newStatus === 'CANCELED') return true;

        const pipeline = PIPELINES[workflow];
        if (!pipeline) throw new Error(`Unknown workflow pipeline defined: ${workflow}`);

        const currentIndex = pipeline.indexOf(currentStatus);
        const newIndex = pipeline.indexOf(newStatus);

        // If either status is not mapped in the pipeline, fail closed (deny transition)
        // Unless it's an initial submission (from null/undefined)
        if (newIndex === -1) return false;
        
        // If current state is completely unknown but new state is the very first step, allow it.
        if (currentIndex === -1 && newIndex === 0) return true;

        // Allowing backward transitions (e.g. going back to PENDING)
        if (newIndex <= currentIndex) return true;

        // Block JUMPING states (newIndex should be exactly currentIndex + 1)
        if (newIndex > currentIndex + 1) return false;

        return true;
    }
}
