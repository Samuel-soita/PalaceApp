import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

export const getAssets = async (req: Request, res: Response) => {
    try {
        const assets = await prisma.asset.findMany({
            include: { department: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(assets);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch assets' });
    }
};

export const getAssetsByDepartment = async (req: Request, res: Response) => {
    try {
        const assets = await prisma.asset.findMany({
            where: { departmentId: req.params.departmentId },
            include: { department: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(assets);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch assets' });
    }
};

export const createAsset = async (req: Request, res: Response) => {
    const { name, condition, assignedTo, maintenanceSchedule, departmentId } = req.body;
    try {
        const asset = await prisma.asset.create({
            data: { name, condition, assignedTo, maintenanceSchedule, departmentId },
        });
        res.status(201).json(asset);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create asset' });
    }
};

export const updateAsset = async (req: Request, res: Response) => {
    try {
        const asset = await prisma.asset.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(asset);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update asset' });
    }
};

export const deleteAsset = async (req: Request, res: Response) => {
    try {
        await prisma.asset.delete({ where: { id: req.params.id } });
        res.json({ message: 'Asset deleted successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to delete asset' });
    }
};
