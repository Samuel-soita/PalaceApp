import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';

/**
 * BAPTISM WORKFLOW
 * PENDING_PASTOR_APPROVAL -> ADMIN_PROCESSING -> READY_FOR_PAYMENT -> BISHOP_APPROVED -> COMPLETED
 */

// Member requests baptism
export const requestBaptism = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        
        // Members can only have one active baptism request
        const existing = await prisma.baptism.findFirst({
            where: { userId, status: { not: 'COMPLETED' } }
        });

        if (existing) {
            return res.status(400).json({ error: 'You already have an active baptism request.' });
        }

        const baptism = await prisma.baptism.create({
            data: {
                userId,
                status: 'PENDING_PASTOR_APPROVAL',
            }
        });

        await logAudit(userId, 'BAPTISM_REQUESTED', 'BAPTISM', baptism.id, { ip: req.ip });
        
        return res.status(201).json({ message: 'Baptism request submitted to your Pastor.', baptism });
    } catch (error) {
        console.error('Baptism Request Error:', error);
        res.status(500).json({ error: 'Failed to request baptism.' });
    }
};

// Admin/Pastor/Bishop updates status
export const updateBaptismStatus = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes, recordedAt, plannedDate, plannedTime, baptismCardNumber } = req.body;
        const actorId = req.user.id;
        const actorRole = req.user.role;

        // Fetch current status to validate transition
        const current = await prisma.baptism.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Baptism request not found.' });

        // Authorization & Workflow Logic
        let canUpdate = false;
        if (actorRole === 'WATUA' || actorRole === 'SUPER_ADMIN') canUpdate = true;
        
        if (actorRole === 'PASTOR' || actorRole === 'ASSOCIATE_PASTOR') {
            if (current.status === 'PENDING_PASTOR_APPROVAL') canUpdate = true;
        }
        
        if (actorRole === 'SECRETARY' || actorRole === 'SYSTEM_ADMIN') {
            if (current.status === 'ADMIN_PAYMENT_VERIFICATION') canUpdate = true;
        }

        if (!canUpdate) {
            return res.status(403).json({ error: 'You are not authorized to advance this workflow phase.' });
        }

        if (plannedDate) {
            const dateObj = new Date(plannedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dateObj < today) {
                return res.status(400).json({ error: 'Baptism cannot be scheduled for past dates.' });
            }
        }

        const baptism = await prisma.baptism.update({
            where: { id },
            data: { 
                status, 
                ...(notes && { notes }),
                ...(recordedAt && { recordedAt: new Date(recordedAt) }),
                ...(plannedDate && { plannedDate: new Date(plannedDate) }),
                ...(plannedTime && { plannedTime }),
                ...(baptismCardNumber && { baptismCardNumber })
            }
        });

        await logAudit(actorId, `BAPTISM_STATUS_${status}`, 'BAPTISM', baptism.id, { ip: req.ip });
        res.json({ message: `Baptism status updated to ${status}.`, baptism });
    } catch (error) {
        console.error('Baptism Update Error:', error);
        res.status(500).json({ error: 'Failed to update baptism status.' });
    }
};

// View all baptisms (for admins/leaders) or own baptisms (for members)
export const getBaptisms = async (req: any, res: Response) => {
    try {
        const { role, id: userId } = req.user;
        const isMember = role === 'MEMBER';

        const whereClause = isMember ? { userId } : {};
        
        const baptisms = await prisma.baptism.findMany({
            where: whereClause,
            include: { user: { select: { name: true, gender: true, phoneNumber: true, department: { select: { name: true } } } } },
            orderBy: { createdAt: 'desc' }
        });
        
        res.json(baptisms);
    } catch (error) {
        console.error('Get Baptisms Error:', error);
        res.status(500).json({ error: 'Failed to fetch baptisms.' });
    }
};

/**
 * CHILD DEDICATION WORKFLOW
 * Handled via the existing Child model using `workflowStatus`.
 * New Statuses: PENDING_DEDICATION -> ADMIN_PAYMENT_VERIFICATION -> BISHOP_RITE_PENDING -> DEDICATED
 */

export const updateChildDedicationStatus = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const { workflowStatus, plannedDate, plannedTime, dedicationCardNumber } = req.body;
        const actorId = req.user.id;
        const actorRole = req.user.role;

        const current = await prisma.child.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Child record not found.' });

        let canUpdate = false;
        if (actorRole === 'WATUA' || actorRole === 'SUPER_ADMIN') canUpdate = true;
        
        if (actorRole === 'PASTOR' || actorRole === 'ASSOCIATE_PASTOR') {
            if (current.workflowStatus === 'PENDING_DEDICATION') canUpdate = true;
        }
        
        if (actorRole === 'SECRETARY' || actorRole === 'SYSTEM_ADMIN') {
            if (current.workflowStatus === 'ADMIN_PAYMENT_VERIFICATION') canUpdate = true;
        }

        if (!canUpdate) {
            return res.status(403).json({ error: 'Unauthorized to advance dedication phase.' });
        }

        if (plannedDate) {
            const dateObj = new Date(plannedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dateObj < today) {
                return res.status(400).json({ error: 'Child dedication cannot be scheduled for past dates.' });
            }
        }

        const child = await prisma.child.update({
            where: { id },
            data: { 
                workflowStatus,
                ...(plannedDate && { plannedDate: new Date(plannedDate) }),
                ...(plannedTime && { plannedTime }),
                ...(dedicationCardNumber && { dedicationCardNumber }),
                ...(workflowStatus === 'DEDICATED' && { isDedicated: true })
            }
        });

        await logAudit(actorId, `CHILD_DEDICATION_${workflowStatus}`, 'CHILD', child.id, { ip: req.ip });
        res.json({ message: `Child dedication status updated to ${workflowStatus}.`, child });
    } catch (error) {
        console.error('Child Dedication Update Error:', error);
        res.status(500).json({ error: 'Failed to update child dedication status.' });
    }
};
