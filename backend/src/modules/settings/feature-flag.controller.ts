import { Request, Response } from 'express';
import { FeatureFlagService } from '../../utils/feature-flag.service.js';

export const getFlags = async (req: Request, res: Response) => {
    try {
        const flags = await FeatureFlagService.isEnabled('all', {}); // Dummy call to trigger cache load or just use prisma
        // Let's just query prisma for full list
        const allFlags = await (await import('../../utils/prisma.js')).default.featureFlag.findMany();
        res.json(allFlags);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to retrieve flags' });
    }
};

export const updateFlag = async (req: Request, res: Response) => {
    const { name, enabled, scope } = req.body;
    try {
        const flag = await FeatureFlagService.updateFlag(name, enabled, scope);
        res.json(flag);
    } catch (error: any) {
        res.status(400).json({ error: 'Failed to update flag' });
    }
};

export const checkFlag = async (req: any, res: Response) => {
    const { name } = req.params;
    try {
        const enabled = await FeatureFlagService.isEnabled(name, {
            role: req.user.role,
            departmentId: req.user.departmentId
        });
        res.json({ enabled });
    } catch (error: any) {
        res.status(500).json({ error: 'Flag check failed' });
    }
};
