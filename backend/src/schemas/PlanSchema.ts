import { z } from 'zod';

export const CreatePlanSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(200),
        description: z.string().optional(),
        type: z.string(),
        departmentId: z.string().uuid().optional().nullable(),
        isMajor: z.boolean().optional(),
        pastorIds: z.array(z.string().uuid()).length(2, 'Exactly 2 pastors required')
    }).strict()
});

export const UpdatePlanSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(200).optional(),
        description: z.string().optional(),
        type: z.string().optional(),
        departmentId: z.string().uuid().optional().nullable(),
        isMajor: z.boolean().optional(),
        approvalStatus: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional()
    }).strict()
});
