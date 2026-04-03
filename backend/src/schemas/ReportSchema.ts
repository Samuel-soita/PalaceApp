import { z } from 'zod';

export const CreateReportSchema = z.object({
    body: z.object({
        type: z.enum(['MONTHLY', 'QUARTERLY', 'BIANNUAL', 'YEARLY']),
        content: z.string().max(2000).optional(),
        departmentId: z.string().uuid().optional(),
    }).strict()
});
