import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

export const globalSearch = async (req: Request, res: Response) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        const queryStr = { contains: q.toLowerCase() };

        // Run parallel queries across the different models
        const [projects, events, announcements] = await Promise.all([
            prisma.project.findMany({
                where: {
                    OR: [
                        { title: queryStr },
                        { description: queryStr },
                    ]
                },
                take: 5
            }),
            prisma.event.findMany({
                where: {
                    OR: [
                        { title: queryStr },
                        { description: queryStr },
                        { location: queryStr }
                    ]
                },
                take: 5
            }),
            prisma.announcement.findMany({
                where: {
                    OR: [
                        { title: queryStr },
                        { content: queryStr }
                    ]
                },
                take: 5
            })
        ]);

        res.json({
            projects,
            events,
            users: [], // Restrict: Users are now private
            announcements
        });
    } catch (error: any) {
        console.error('[globalSearch]', error);
        res.status(500).json({ error: 'Search failed' });
    }
};
