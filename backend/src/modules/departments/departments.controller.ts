import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';

export const createDepartment = async (req: Request, res: Response) => {
    const { name, description, leaderId } = req.body;

    try {
        const department = await prisma.department.create({
            data: { name, description, leaderId },
        });
        res.status(201).json(department);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create department' });
    }
};

export const getDepartments = async (req: Request, res: Response) => {
    try {
        const departments = await prisma.department.findMany({
            include: { leaders: { select: { id: true, name: true, email: true } } }
        });
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

export const getDepartmentById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const department = await prisma.department.findUnique({
            where: { id },
            include: {
                leaders: { select: { id: true, name: true, email: true } },
                meetings: true,
                budgets: true,
                volunteers: true
            }
        });
        if (!department) return res.status(404).json({ error: 'Department not found' });
        res.json(department);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch department' });
    }
};
