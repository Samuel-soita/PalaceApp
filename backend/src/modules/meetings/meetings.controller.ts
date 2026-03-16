import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

export const createMeeting = async (req: any, res: Response) => {
    const {
        title, departmentId, date, time, venue, meetingType,
        agenda, followUpPersonId, followUpDeadline
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
                organizerId: req.user.id,
                followUpPersonId,
                followUpDeadline: followUpDeadline ? new Date(followUpDeadline) : null,
            },
        });
        res.status(201).json(meeting);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create meeting' });
    }
};

export const getMeetings = async (req: Request, res: Response) => {
    const { departmentId } = req.query;
    const user = (req as any).user;
    const where: any = {};
    
    try {
        if (user.role === 'WATUA') {
            // WATUA sees everything
        } else if (user.role === 'MEMBER') {
            where.meetingStatus = 'SCHEDULED';
            // MEMBER Privacy: Only their own department
            if (user.departmentId) {
                where.departmentId = user.departmentId;
            } else {
                return res.json([]);
            }
        } else if (user.role === 'DEPARTMENT_LEADER') {
            if (!departmentId) {
                where.departmentId = user.departmentId;
            } else {
                where.departmentId = String(departmentId);
            }
        }

        const meetings = await prisma.meeting.findMany({
            where,
            include: {
                organizer: { select: { name: true } },
                followUpPerson: { select: { name: true } },
                department: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(meetings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch meetings' });
    }
};

export const updateMeeting = async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;

    if (data.date) data.date = new Date(data.date);
    if (data.followUpDeadline) data.followUpDeadline = new Date(data.followUpDeadline);

    try {
        const meeting = await prisma.meeting.update({
            where: { id },
            data,
        });
        res.json(meeting);
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
                role: userRole === 'SUPER_ADMIN' ? 'BISHOP' : 'DEPARTMENT_LEADER',
                approved: true
            }
        });

        // Check if we have both BISHOP and DEPARTMENT_LEADER approval
        // @ts-ignore
        const currentApprovals = await prisma.meetingApproval.findMany({
            where: { meetingId: id, approved: true }
        });

        const hasBishop = currentApprovals.some((a: any) => a.role === 'BISHOP');
        const hasLeader = currentApprovals.some((a: any) => a.role === 'DEPARTMENT_LEADER');

        if (userRole === 'WATUA' || (hasBishop && hasLeader)) {
            await prisma.meeting.update({
                where: { id },
                data: { meetingStatus: 'SCHEDULED' }
            });
        }

        res.json({ message: 'Meeting approved successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to approve meeting' });
    }
};

export const deleteMeeting = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        await prisma.meetingApproval.deleteMany({ where: { meetingId: req.params.id } });
        await prisma.meeting.delete({ where: { id: req.params.id } });
        res.json({ message: 'Meeting deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete meeting' });
    }
};
