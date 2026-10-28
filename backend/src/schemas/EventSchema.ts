import { z } from 'zod';

const EventDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid event date' });
const AttachmentUrl = z.string().refine((v) => /^https?:\/\//i.test(v) || v.startsWith('/uploads/'), { message: 'Invalid attachment URL' });
const EventStatus = z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']);

export const CreateEventSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(150),
        description: z.string().optional(),
        date: EventDate,
        time: z.string(),
        location: z.string(),
        eventType: z.string(),
        budgetNeeded: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        budgetSource: z.enum(['DEPARTMENT', 'CHURCH']).optional(),
        volunteersNeeded: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        departmentId: z.string().uuid().optional().nullable(),
        pastorIds: z.array(z.string().uuid()).max(2).optional(),
        attachmentUrl: AttachmentUrl.optional().nullable(),
        isMajor: z.boolean().optional(),
        status: EventStatus.optional()
    }).strict()
});

export const UpdateEventSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(150).optional(),
        description: z.string().optional(),
        date: EventDate.optional(),
        time: z.string().optional(),
        location: z.string().optional(),
        eventType: z.string().optional(),
        budgetNeeded: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        budgetSource: z.enum(['DEPARTMENT', 'CHURCH']).optional(),
        volunteersNeeded: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform(Number),
        departmentId: z.string().uuid().optional().nullable(),
        attachmentUrl: AttachmentUrl.optional().nullable(),
        isMajor: z.boolean().optional(),
        status: EventStatus.optional(),
        pastorIds: z.array(z.string().uuid()).optional(),
        approvalStatus: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional()
    }).strict()
});
