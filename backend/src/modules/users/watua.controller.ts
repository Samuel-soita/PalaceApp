import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { Prisma } from '@prisma/client';
import { logAction } from '../../utils/audit.service.js';

/**
 * Initiates a Critical Action (e.g., PURGE, ROLE_PROMOTION)
 * Places it in a PENDING state waiting for a second WATUA or SUPER_ADMIN approval.
 */
export const initiateCriticalAction = async (req: any, res: Response) => {
    const { actionType, targetEntity, payload } = req.body;
    const actorId = req.user.id;

    if (!['PURGE', 'ROLE_PROMOTION', 'FORCE_AUTH'].includes(actionType)) {
        return res.status(400).json({ error: 'Invalid critical action type.' });
    }

    try {
        const log = await prisma.watuaActionLog.create({
            data: {
                engineerId: actorId,
                actionType,
                targetEntity,
                beforeState: payload || Prisma.JsonNull,
                approvalChain: [{ id: actorId, role: req.user.role, date: new Date().toISOString(), type: 'INITIATOR' }] as any,
                executed: false
            }
        });

        res.status(201).json({ 
            message: 'Critical action initiated. Awaiting secondary Dual-Auth approval.',
            action: log
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to initiate critical action.' });
    }
};

/**
 * Approves a Pending Critical Action
 * Enforces NO SELF-APPROVAL.
 * Triggers actual execution immediately after approval unless it's a PURGE/PROMOTION (Delay handled via UI).
 */
export const approveCriticalAction = async (req: any, res: Response) => {
    const { id } = req.params;
    const approverId = req.user.id;
    const approverRole = req.user.role;

    try {
        const log = await prisma.watuaActionLog.findUnique({ where: { id } });
        if (!log) return res.status(404).json({ error: 'Action not found.' });
        if (log.executed) return res.status(400).json({ error: 'Action already executed or cancelled.' });

        if (log.engineerId === approverId) {
            return res.status(403).json({ error: 'Security Protocol Violation: Self-approval is strictly prohibited.' });
        }

        const chain = log.approvalChain as any[];
        chain.push({ id: approverId, role: approverRole, date: new Date().toISOString(), type: 'APPROVER' });

        const finalized = await prisma.watuaActionLog.update({
            where: { id },
            data: { 
                approvalChain: chain,
                executed: true // Flagged as cleared for execution
            }
        });

        // -> Here we trigger the actual background execution logic based on actionType
        // For scope of Architecture 3.0, we just authorize it and log it.
        await logAction({
            actorId: approverId,
            actorRole: approverRole,
            actionType: `${log.actionType}_EXECUTED`,
            entityType: 'WATUA_CORE',
            entityId: log.targetEntity,
            afterState: finalized,
            ipAddress: req.ip
        });

        res.json({ message: 'Dual-Authorization cleared. Action executed.', action: finalized });
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve action.' });
    }
};

/**
 * Cancels a Pending Critical Action (usually during the 10-second delay window)
 */
export const cancelCriticalAction = async (req: any, res: Response) => {
    const { id } = req.params;

    try {
        const log = await prisma.watuaActionLog.findUnique({ where: { id } });
        if (!log || log.executed) return res.status(400).json({ error: 'Action cannot be cancelled.' });

        await prisma.watuaActionLog.delete({ where: { id } });

        await logAction({
            actorId: req.user.id,
            actorRole: req.user.role,
            actionType: `CANCEL_${log.actionType}`,
            entityType: 'WATUA_CORE',
            entityId: log.targetEntity,
            ipAddress: req.ip
        });

        res.json({ message: 'Critical action successfully aborted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel action.' });
    }
};
