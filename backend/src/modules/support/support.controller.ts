import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

// GET all support requests (Role-scoped visibility engine)
export const getSupportRequests = async (req: any, res: Response) => {
    try {
        const userRole = req.user!.role;
        let whereClause = {};

        if (userRole === 'MEMBER') {
            // Members only see their own SYSTEM HELP requests natively isolated from church operations
            whereClause = { requesterId: req.user!.id, category: 'SYSTEM_HELP' };
        } else if (userRole === 'DEPARTMENT_LEADER') {
            // Leaders see their department's event funding plus their own requests
            whereClause = {
                OR: [
                    { requesterId: req.user!.id },
                    { category: 'EVENT_FUNDING', event: { departmentId: req.user!.departmentId } }
                ]
            };
        }
        // SUPER_ADMIN, WATUA, SYSTEM_ADMIN see EVERYTHING (empty whereClause)

        const requests = await prisma.supportRequest.findMany({
            where: whereClause,
            include: {
                event: { include: { department: true } },
                requester: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to construct support request intel' });
    }
};

// Create a support request (Dynamic context switching based on category)
export const createSupportRequest = async (req: any, res: Response) => {
    const { eventId, title, description, proofImageUrl, category } = req.body;
    const reqCategory = category || 'EVENT_FUNDING';

    try {
        if (reqCategory === 'SYSTEM_HELP') {
            // 2.4.0 Kernel: Member System/Nav Help Branch
            const helpReq = await prisma.supportRequest.create({
                data: {
                    requesterId: req.user!.id,
                    title,
                    description,
                    category: 'SYSTEM_HELP',
                    status: 'OPEN'
                },
                include: { requester: { select: { id: true, name: true } } }
            });
            return res.status(201).json(helpReq);
        }

        // 2.4.0 Kernel: Event Funding Operational Flow
        if (!proofImageUrl) {
            return res.status(400).json({ error: 'Proof of support (screenshot/receipt) is strictly mandatory for Event funding.' });
        }

        // Enforce the 1,500 KSH rule specifically for Department Leaders
        if (req.user!.role === 'DEPARTMENT_LEADER' && req.user!.departmentId) {
            const deptAccount = await prisma.account.findUnique({
                where: { departmentId: req.user!.departmentId }
            });

            if (!deptAccount || deptAccount.balance < 1500) {
                return res.status(403).json({ 
                    error: 'System Override Denied: Your Sector operational balance is below 1,500 KSH. Minimum reserve required to request external Event Support.' 
                });
            }
        }

        const supportRequest = await prisma.supportRequest.create({
            data: {
                eventId,
                requesterId: req.user!.id,
                title,
                description,
                amountRequired: 1500,
                proofImageUrl,
                status: 'OPEN',
                category: 'EVENT_FUNDING'
            },
            include: { event: true, requester: { select: { id: true, name: true } } }
        });

        // Broadcast to relevant high-clearance peers
        const leaders = await prisma.user.findMany({ where: { role: 'DEPARTMENT_LEADER' } });
        await prisma.notification.createMany({
            data: leaders.map(leader => ({
                userId: leader.id,
                title: '🤝 Critical Event Support Request',
                message: `[DEPT FUNDING] ${req.user!.name} is requesting 1,500/- for event: ${title}`
            }))
        });

        res.status(201).json(supportRequest);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to dispatch generic support request.' });
    }
};

// Admin action on support request (Fund Event or Reply to System Help)
export const fundSupportRequest = async (req: any, res: Response) => {
    const { adminReply, status } = req.body;
    
    try {
        const updateData: any = { status: status || 'FUNDED' };
        if (adminReply && req.user!.role === 'WATUA') {
            updateData.adminReply = adminReply;
            updateData.status = 'RESOLVED';
        }

        const updated = await prisma.supportRequest.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update final support condition' });
    }
};
