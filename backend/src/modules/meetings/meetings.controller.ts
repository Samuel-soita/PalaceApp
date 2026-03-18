import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { getOrSetCache } from '../../utils/redis.js';
import redis from '../../utils/redis.js';

export const createMeeting = async (req: any, res: Response) => {
    const user = (req as any).user;
    const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR', 'SECRETARY'].includes(user.role);
    
    if (!isExecutive && user.role !== 'DEPARTMENT_LEADER') {
        return res.status(403).json({ error: 'Members cannot convene tactical meetings' });
    }

    const {
        title, departmentId, date, time, venue, meetingType,
        agenda, followUpPersonId, followUpDeadline, isPartnerOnly
    } = req.body;

    try {
        const meeting = await prisma.meeting.create({
            data: {
                title,
                departmentId,
                date: new Date(date),
                time,
                venue,
                meetingType,
                agenda,
                organizerId: user.id,
                followUpPersonId,
                followUpDeadline: followUpDeadline ? new Date(followUpDeadline) : null,
                isPartnerOnly: isPartnerOnly || false,
            },
        });

        // Fetch all Executives
        const executives = await prisma.user.findMany({
            where: {
                role: { in: ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'] }
            }
        });
        
        const notifications = executives.map((exec) => {
            return {
                userId: exec.id,
                title: '📅 Meeting Awaiting Approval',
                message: `A new meeting "${title}" was proposed by ${(req.user as any).name} and is awaiting approval.`
            };
        });

        if (notifications.length > 0) {
            await prisma.notification.createMany({ data: notifications });
        }

        // Invalidate Cache
        const keys = await redis.keys('meetings:*');
        if (keys.length > 0) await redis.del(...keys);

        res.status(201).json(meeting);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create meeting' });
    }
};

export const getMeetings = async (req: Request, res: Response) => {
    try {
        const { departmentId, page = '1', limit = '10' } = req.query;
        const user = (req as any).user;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = {};
        
        if (user.role === 'WATUA') {
        } else if (user.role === 'SUPER_ADMIN' || user.role === 'SYSTEM_ADMIN' || user.role === 'SECRETARY' || user.role === 'PASTOR') {
            if (departmentId) where.departmentId = String(departmentId);
        } else if (user.role === 'DEPARTMENT_LEADER') {
            if (departmentId) {
                where.departmentId = String(departmentId);
            } else {
                where.OR = [
                    { departmentId: user.departmentId },
                    { meetingStatus: 'APPROVED' }
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
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch meetings' });
    }
};

export const updateMeeting = async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;

    if (data.date) data.date = new Date(data.date);
    if (data.followUpDeadline) data.followUpDeadline = new Date(data.followUpDeadline);
    try {
        const user = (req as any).user;
        const meeting = await prisma.meeting.findUnique({ where: { id } });
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

        const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
        const isManaging = user.managedDepartments?.some((d: any) => d.id === meeting.departmentId) || user.departmentId === meeting.departmentId;
        
        if (!isExecutive && !isManaging) {
            return res.status(403).json({ error: 'Access denied: Executive or Sector permission required' });
        }

        // Filter data to only include valid fields
        const updateData: any = {};
        const validFields = ['title', 'date', 'time', 'venue', 'meetingType', 'agenda', 'followUpPersonId', 'followUpDeadline', 'minutes', 'attendance', 'meetingStatus', 'isPartnerOnly'];
        
        validFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (updateData.date) updateData.date = new Date(updateData.date);
        if (updateData.followUpDeadline) updateData.followUpDeadline = new Date(updateData.followUpDeadline);

        const updatedMeeting = await prisma.meeting.update({
            where: { id },
            data: updateData,
        });

        // Invalidate Cache
        const keys = await redis.keys('meetings:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json(updatedMeeting);
    } catch (error) {
        res.status(400).json({ error: 'Failed to update meeting' });
    }
};

export const approveMeeting = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const meeting = await prisma.meeting.findUnique({
            where: { id },
            // @ts-ignore
            include: { approvals: true }
        });

        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

        // Record the approval
        // @ts-ignore
        await prisma.meetingApproval.upsert({
            where: { meetingId_userId: { meetingId: id, userId } },
            update: { approved: true },
            create: {
                meetingId: id,
                userId,
                role: userRole === 'SUPER_ADMIN' ? 'BISHOP' : 'PASTOR',
                approved: true
            }
        });

        const currentApprovals = await prisma.meetingApproval.findMany({
            where: { meetingId: id, approved: true }
        });

        const hasBishop = currentApprovals.some((a: any) => a.role === 'BISHOP');
        const pastorCount = currentApprovals.filter((a: any) => a.role === 'PASTOR').length;

        if (userRole === 'WATUA' || (hasBishop && pastorCount >= 2)) {
            await prisma.meeting.update({
                where: { id },
                data: { meetingStatus: 'SCHEDULED' }
            });

            // Invalidate Cache
            const keys = await redis.keys('meetings:*');
            if (keys.length > 0) await redis.del(...keys);
        }

        res.json({ message: 'Meeting approved successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to approve meeting' });
    }
};

export const deleteMeeting = async (req: Request, res: Response) => {
    try {
        const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

        const user = (req as any).user;
        const isExecutive = ['WATUA', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role);
        const isManaging = user.managedDepartments?.some((d: any) => d.id === meeting.departmentId) || user.departmentId === meeting.departmentId;

        if (!isExecutive && !isManaging) {
            return res.status(403).json({ error: 'Access denied: Executive or Sector priority required' });
        }

        // @ts-ignore
        await prisma.meetingApproval.deleteMany({ where: { meetingId: req.params.id } });
        await prisma.meeting.delete({ where: { id: req.params.id } });

        // Invalidate Cache
        const keys = await redis.keys('meetings:*');
        if (keys.length > 0) await redis.del(...keys);

        res.json({ message: 'Meeting deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete meeting' });
    }
};
