import { z } from 'zod';

export const CreateMeetingSchema = z.object({
    body: z.object({
        title: z.string().min(3, "Meeting title must be at least 3 characters").max(100),
        departmentId: z.string().uuid("Invalid department ID format").optional().nullable(),
        date: z.string().datetime({ message: "Invalid ISO date string" }),
        time: z.string(),
        venue: z.string(),
        meetingType: z.enum(['IN_PERSON', 'VIRTUAL', 'HYBRID']),
        agenda: z.string().optional(),
        followUpPersonId: z.string().uuid().optional().nullable(),
        followUpDeadline: z.string().datetime().optional().nullable(),
        isPartnerOnly: z.boolean().optional(),
        pastorIds: z.array(z.string().uuid()).optional()
    }).strict()
});

export const UpdateMeetingSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(100).optional(),
        date: z.string().datetime().optional(),
        time: z.string().optional(),
        venue: z.string().optional(),
        meetingType: z.enum(['IN_PERSON', 'VIRTUAL', 'HYBRID']).optional(),
        agenda: z.string().optional(),
        followUpPersonId: z.string().uuid().optional().nullable(),
        followUpDeadline: z.string().datetime().optional().nullable(),
        minutes: z.string().optional(),
        attendance: z.number().int().nonnegative().optional(),
        meetingStatus: z.enum(['PENDING_APPROVAL', 'SCHEDULED', 'CONCLUDED', 'CANCELLED']).optional(),
        isPartnerOnly: z.boolean().optional()
    }).strict()
});
