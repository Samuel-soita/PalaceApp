import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import { catchAsync } from '../../utils/errors.js';

/**
 * 📢 Global Public Updates Engine
 * Fetches recent high-priority activity for unauthenticated visibility.
 */
export const getPublicUpdates = catchAsync(async (req: Request, res: Response) => {
    // 1. Fetch Latest Approved Events (Major/Global)
    const events = await prisma.event.findMany({
        where: { approvalStatus: 'APPROVED', deletedAt: null },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    // 2. Fetch Latest Approved Projects
    const projects = await prisma.project.findMany({
        where: { approvalStatus: 'APPROVED', deletedAt: null },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    // 3. Fetch Latest Published Devotions
    const devotions = await prisma.devotion.findMany({
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    // 4. Fetch Latest Open Support Requests (High-level only)
    const requests = await prisma.supportRequest.findMany({
        where: { status: 'OPEN' },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    // ⚡ Aggregate & Type-Tag for the Frontend Feed
    const updates = [
        ...events.map(e => ({ ...e, type: 'EVENT' })),
        ...projects.map(p => ({ ...p, type: 'PROJECT' })),
        ...devotions.map(d => ({ ...d, type: 'DEVOTION' })),
        ...requests.map(r => ({ ...r, type: 'REQUEST' }))
    ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(updates);
});
