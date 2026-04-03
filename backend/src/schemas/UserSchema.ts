import { z } from 'zod';

/**
 * 👤 User & Identity Schemas - v2.4.0
 */
export const UserRegistrationSchema = z.object({
    body: z.object({
        name: z.string().min(3).max(100),
        idNumber: z.string().min(5).max(20),
        phoneNumber: z.string().min(10).max(15),
        dob: z.string().datetime(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
        password: z.string().min(8),
        departmentId: z.string().uuid().optional()
    })
});

export const UserUpdateSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: z.object({
        name: z.string().min(3).max(100).optional(),
        phoneNumber: z.string().min(10).max(15).optional(),
        status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
        role: z.enum(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'DEPARTMENT_LEADER', 'MEMBER', 'PASTOR', 'ASSOCIATE_PASTOR', 'WATUA']).optional(),
        departmentId: z.string().uuid().optional()
    }).strict()
});

export const ChangePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8)
    })
});

export const UserLoginSchema = z.object({
    body: z.object({
        membershipNumber: z.string(),
        password: z.string()
    })
});
