import { z } from 'zod';

export const CreatePlanSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(200),
        content: z.string().min(10).max(5000),
        type: z.string(),
        budgetNeeded: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        budgetSource: z.enum(['DEPARTMENT', 'CHURCH']).optional(),
        status: z.string().optional(),
        departmentId: z.string().uuid().optional().nullable(),
        isMajor: z.boolean().optional(),
        pastorIds: z.array(z.string().uuid()).length(2, 'Exactly 2 pastors required')
    }).strict()
});

export const UpdatePlanSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(200).optional(),
        content: z.string().min(10).max(5000).optional(),
        type: z.string().optional(),
        budgetNeeded: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        budgetSource: z.enum(['DEPARTMENT', 'CHURCH']).optional(),
        status: z.string().optional(),
        departmentId: z.string().uuid().optional().nullable(),
        isMajor: z.boolean().optional(),
        approvalStatus: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional()
    }).strict()
});
