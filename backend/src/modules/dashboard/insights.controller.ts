import { Request, Response } from 'express';
import { InsightsService } from '../../utils/insights.service.js';

export const getGovernanceDashboard = async (req: Request, res: Response) => {
    try {
        const metrics = await InsightsService.getGovernanceMetrics();
        res.json(metrics);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to retrieve governance insights' });
    }
};

export const exportLedger = async (req: Request, res: Response) => {
    try {
        const csv = await InsightsService.exportLedgerCSV();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=partnership-ledger.csv');
        res.send(csv);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate export' });
    }
};
