import { Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

export const createAppointment = async (req: any, res: Response) => {
    const { id: memberId } = req.user;
    const { targetRole, type, reason, preferredDate, preferredTime, targetId } = req.body;

    if (!targetRole || !type || !reason || !preferredDate || !preferredTime) {
        return res.status(400).json({ error: 'Missing required appointment fields (include date and time).' });
    }

    const apptDate = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (apptDate < today) {
        return res.status(400).json({ error: 'Appointments cannot be requested for past dates.' });
    }

    try {
        const appointment = await (prisma as any).appointment.create({
            data: {
                memberId,
                targetId,
                targetRole,
                type,
                reason,
                preferredDate: new Date(preferredDate),
                preferredTime,
                status: 'PENDING'
            }
        });

        await logAudit(memberId, 'CREATE_APPOINTMENT', 'APPOINTMENT', appointment.id, { targetRole, type });

        res.json({ message: 'Appointment request submitted successfully.', appointment });
    } catch (error) {
        console.error('Create Appointment Error:', error);
        res.status(500).json({ error: 'Failed to submit appointment request.' });
    }
};

export const getMyAppointments = async (req: any, res: Response) => {
    const { id: memberId } = req.user;

    try {
        const appointments = await (prisma as any).appointment.findMany({
            where: { memberId },
            include: {
                target: {
                    select: { name: true, role: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(appointments);
    } catch (error) {
        console.error('Get My Appointments Error:', error);
        res.status(500).json({ error: 'Failed to fetch your appointments.' });
    }
};

export const getAllAppointments = async (req: any, res: Response) => {
    const { role, id: userId } = req.user;

    try {
        let where: any = {};
        
        // Admins and Pastors see all, but filtered by role if not WATUA/SYSTEM_ADMIN
        if (['PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN'].includes(role)) {
            where = {
                OR: [
                    { targetId: userId },
                    { targetRole: role }
                ]
            };
        } else if (role !== 'WATUA' && role !== 'SYSTEM_ADMIN' && role !== 'SECRETARY') {
            return res.status(403).json({ error: 'Unauthorized to view all appointments.' });
        }

        const appointments = await (prisma as any).appointment.findMany({
            where,
            include: {
                member: {
                    select: { name: true, membershipNumber: true }
                },
                target: {
                    select: { name: true, role: true }
                }
            },
            orderBy: { preferredDate: 'asc' }
        });

        res.json(appointments);
    } catch (error) {
        console.error('Get All Appointments Error:', error);
        res.status(500).json({ error: 'Failed to fetch appointments.' });
    }
};

export const updateAppointmentStatus = async (req: any, res: Response) => {
    const { id } = req.params;
    const { status, approvedDate, approvedTime, adminNotes } = req.body;

    if (!['APPROVED', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid appointment status.' });
    }

    try {
        const updateData: any = { status };
        if (status === 'APPROVED') {
            if (!approvedDate || !approvedTime) {
                return res.status(400).json({ error: 'Approved appointment must include date and time.' });
            }
            const apptDate = new Date(approvedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (apptDate < today) {
                return res.status(400).json({ error: 'Appointments cannot be approved for past dates.' });
            }
            updateData.approvedDate = new Date(approvedDate);
            updateData.approvedTime = approvedTime;
            updateData.adminNotes = adminNotes;
        }

        const appointment = await (prisma as any).appointment.update({
            where: { id },
            data: updateData
        });

        await logAudit(req.user.id, 'UPDATE_APPOINTMENT_STATUS', 'APPOINTMENT', id, { status, approvedTime });

        res.json({ message: `Appointment ${status.toLowerCase()} successfully.`, appointment });
    } catch (error) {
        console.error('Update Appointment Status Error:', error);
        res.status(500).json({ error: 'Failed to update appointment status.' });
    }
};
