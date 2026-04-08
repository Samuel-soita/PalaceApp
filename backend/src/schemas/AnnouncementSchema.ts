import { z } from 'zod';

export const CreateAnnouncementSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(200),
        content: z.string().min(10),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
        expiry: z.string().datetime().optional().nullable(),
        departmentId: z.string().uuid().optional().nullable(),
        isGlobal: z.boolean().optional(),
        isMajor: z.boolean().optional(),
        pastorIds: z.array(z.string().uuid()).optional(),
        eventDate: z.string().datetime().optional().nullable(),
        eventTime: z.string().optional().nullable(),
        location: z.string().optional().nullable()
    }).strict()
});

export const UpdateAnnouncementSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(200).optional(),
        content: z.string().min(10).optional(),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
        expiry: z.string().datetime().optional().nullable(),
        departmentId: z.string().uuid().optional().nullable(),
        isGlobal: z.boolean().optional(),
        isMajor: z.boolean().optional(),
        status: z.enum(['PENDING', 'PUBLISHED', 'ARCHIVED', 'REJECTED']).optional(),
        eventDate: z.string().datetime().optional().nullable(),
        eventTime: z.string().optional().nullable(),
        location: z.string().optional().nullable()
    }).strict()
});
