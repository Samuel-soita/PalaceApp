import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';
import { catchAsync, AppError } from '../../utils/errors.js';
import { logAudit } from '../../utils/audit.js';
import { broadcastSync } from '../../utils/socket.js';

export const createMeeting = catchAsync(async (req: any, res: Response) => {
    const user = req.user;
    
    // Zod already guarantees `date` is a valid ISO string.
    const data = req.body;
    
    // Validate Meeting Organizer rules
    if (user.role === 'DEPARTMENT_LEADER' && user.departmentId !== data.departmentId) {
         throw new AppError('Department Leaders can only convene meetings for their own department', 403);
    }

    const meeting = await prisma.$transaction(async (tx) => {
        const newMeeting = await tx.meeting.create({
            data: {
                title: data.title,
                departmentId: data.departmentId,
                date: new Date(data.date),
                time: data.time,
                venue: data.venue,
                meetingType: data.meetingType,
                agenda: data.agenda,
                organizerId: user.id,
                followUpPersonId: data.followUpPersonId,
                followUpDeadline: data.followUpDeadline ? new Date(data.followUpDeadline) : null,
                isPartnerOnly: data.isPartnerOnly || false,
                meetingStatus: 'SCHEDULED'
            },
        });

        // Approval chain removed

        return newMeeting;
    });
    
    await logAudit(user.id, 'MEETING_CREATED', 'MEETING', meeting.id, { title: meeting.title });

    // Invalidate Cache
    const keys = await redis.keys('meetings:*');
    if (keys.length > 0) await redis.del(...keys);
    broadcastSync('meetings');

    res.status(201).json(meeting);
});

export const getMeetings = catchAsync(async (req: Request, res: Response) => {
    const { departmentId, page = '1', limit = '10' } = req.query;
    const user = (req as any).user;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};
    
    if (user.role === 'WATUA') {
        // WATUA (System Engineer) has global oversight, no filters needed
    } else if (['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role)) {
        if (departmentId) where.departmentId = String(departmentId);
    } else if (user.role === 'DEPARTMENT_LEADER') {
        if (departmentId) {
            where.departmentId = String(departmentId);
        } else {
            where.OR = [
                { departmentId: user.departmentId },
                { meetingStatus: 'SCHEDULED' }
            ];
        }
    } else if (user.role === 'MEMBER') {
        where.meetingStatus = 'SCHEDULED';
        if (user.departmentId) {
            where.departmentId = user.departmentId;
        } else {
            return res.json({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
        }
    }

    const cacheKey = `meetings:${user.role}:${user.departmentId || 'none'}:${departmentId || 'all'}:${page}:${limit}`;

    const result = await getOrSetCache(cacheKey, async () => {
        const [data, total] = await Promise.all([
            prisma.meeting.findMany({
                where,
                include: {
                    organizer: { select: { name: true } },
                    followUpPerson: { select: { name: true } },
                    department: { select: { name: true } }
                },
                orderBy: { date: 'asc' },
                skip,
                take,
            }),
            prisma.meeting.count({ where })
        ]);
        return { data, total };
    }, 120);

    res.json({
        data: result.data,
        meta: {
            total: result.total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(result.total / Number(limit))
        }
    });
});

export const getMeetingById = catchAsync(async (req: Request, res: Response) => {
    const meeting = await prisma.meeting.findUnique({
        where: { id: req.params.id },
        include: {
            organizer: { select: { name: true } },
            followUpPerson: { select: { name: true } },
            department: { select: { name: true } }
        }
    });
    if (!meeting) throw new AppError('Meeting not found', 404);
    res.json(meeting);
});

export const updateMeeting = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;

    const user = (req as any).user;
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    
    if (!meeting) throw new AppError('Meeting not found', 404);

    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
    const isManaging = user.managedDepartments?.some((d: any) => d.id === meeting.departmentId) || user.departmentId === meeting.departmentId;
    
    if (!isExecutive && !isManaging) {
        throw new AppError('Access denied: Executive or Sector permission required', 403);
    }

    // Operational lock removed

    const updateData: any = { ...data };
    if (updateData.date) updateData.date = new Date(updateData.date);
    if (updateData.followUpDeadline) updateData.followUpDeadline = new Date(updateData.followUpDeadline);

    const updatedMeeting = await prisma.meeting.update({
        where: { id },
        data: updateData,
    });
    
    await logAudit(user.id, 'MEETING_UPDATED', 'MEETING', id, { fields: Object.keys(updateData) });

    // Invalidate Cache
    const keys = await redis.keys('meetings:*');
    if (keys.length > 0) await redis.del(...keys);
    broadcastSync('meetings');

    res.json(updatedMeeting);
});


export const deleteMeeting = catchAsync(async (req: Request, res: Response) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!meeting) throw new AppError('Meeting not found', 404);

    const user = (req as any).user;
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
    const isManaging = user.managedDepartments?.some((d: any) => d.id === meeting.departmentId) || user.departmentId === meeting.departmentId;

    if (!isExecutive && !isManaging) {
        throw new AppError('Access denied: Executive or Sector priority required', 403);
    }

    // Deletion restrictions removed

    await prisma.$transaction(async (tx) => {
        // Soft delete the meeting is handled globally, but we still trigger standard update
        await tx.meeting.update({ 
            where: { id: req.params.id },
            data: { deletedAt: new Date() }
        });
        
        // Hard-delete relational approval joins as they do not possess deletedAt
        await tx.meetingApproval.deleteMany({ where: { meetingId: req.params.id } });
    });
    
    await logAudit(user.id, 'MEETING_DELETED', 'MEETING', req.params.id);

    // Invalidate Cache
    const keys = await redis.keys('meetings:*');
    if (keys.length > 0) await redis.del(...keys);
    broadcastSync('meetings');

    res.json({ message: 'Meeting deleted successfully' });
});
