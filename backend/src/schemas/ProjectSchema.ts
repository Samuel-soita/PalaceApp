import { z } from 'zod';

/**
 * 🧱 Project Management Schemas - v2.4.0
 */
const ProjectStatus = z.enum(['PLANNED', 'PROPOSAL', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']);
const ProjectCategory = z.enum(['INFRASTRUCTURE', 'OUTREACH', 'TECH', 'YOUTH', 'GENERAL', 'NEW_PROJECT']);

export const CreateProjectSchema = z.object({
    body: z.object({
        title: z.string({ required_error: 'Mission title is mandatory.' }).min(3).max(100),
        description: z.string().min(10).max(1000),
        departmentId: z.string().uuid(),
        budget: z.number().nonnegative(),
        budgetSource: z.enum(['DEPARTMENT', 'CHURCH']).optional(),
        deadline: z.string().datetime().optional().nullable(),
        category: ProjectCategory.optional(),
        pastorIds: z.array(z.string().uuid()).max(2).optional(),
        status: ProjectStatus.optional(),
        progress: z.number().int().min(0).max(100).optional(),
        isMajor: z.boolean().optional()
    }).strict()
});

export const UpdateProjectSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: z.object({
        title: z.string().min(3).max(100).optional(),
        description: z.string().min(10).max(1000).optional(),
        budget: z.number().nonnegative().optional(),
        budgetSource: z.enum(['DEPARTMENT', 'CHURCH']).optional(),
        status: ProjectStatus.optional(),
        progress: z.number().int().min(0).max(100).optional(),
        deadline: z.string().datetime().optional().nullable(),
        category: ProjectCategory.optional(),
        departmentId: z.string().uuid().optional(),
        pastorIds: z.array(z.string().uuid()).optional(),
        isMajor: z.boolean().optional()
    }).strict()
});

export const ProjectUpdateCommentSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: z.object({
        content: z.string().min(1).max(500),
        status: z.enum(['PROPOSAL', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional()
    })
});
