import { z } from 'zod';

export const CreateEventSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(150),
        description: z.string().optional(),
        date: z.string().datetime(),
        time: z.string(),
        location: z.string(),
        eventType: z.string(),
        budgetNeeded: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        volunteersNeeded: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        departmentId: z.string().uuid().optional().nullable(),
        pastorIds: z.array(z.string().uuid()).length(2, 'You must select exactly 2 Pastors to approve this event.'),
        attachmentUrl: z.string().url().optional().nullable(),
        isMajor: z.boolean().optional(),
        status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).optional()
    }).strict()
});

export const UpdateEventSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(150).optional(),
        description: z.string().optional(),
        date: z.string().datetime().optional(),
        time: z.string().optional(),
        location: z.string().optional(),
        eventType: z.string().optional(),
        budgetNeeded: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        volunteersNeeded: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        departmentId: z.string().uuid().optional().nullable(),
        attachmentUrl: z.string().url().optional().nullable(),
        isMajor: z.boolean().optional(),
        approvalStatus: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional()
    }).strict()
});
