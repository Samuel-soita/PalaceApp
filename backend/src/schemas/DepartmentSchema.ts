import { z } from 'zod';

export const CreateDepartmentSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'Department name must be at least 2 characters').max(50, 'Department name too long'),
        description: z.string().optional(),
        leaderId: z.string().uuid('Invalid Leader ID format').optional().nullable(),
    }).strict()
});
