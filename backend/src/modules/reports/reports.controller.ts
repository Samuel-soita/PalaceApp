import { Request, Response } from 'express';
import prisma from '../../utils/prisma.js';
import path from 'path';
import fs from 'fs';
import { catchAsync, AppError } from '../../utils/errors.js';
import { logAudit } from '../../utils/audit.js';

// Helper to physically purge files and auto-delete > 10 days downloaded reports
const purgeStaleReports = async () => {
    try {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        const staleReports = await prisma.departmentReport.findMany({
            where: {
                downloadedAt: { lt: tenDaysAgo }
            }
        });

        if (staleReports.length > 0) {
            for (const report of staleReports) {
                if (report.fileUrl) {
                    const filePath = path.join(process.cwd(), report.fileUrl.replace(/^\//, ''));
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            }

            await prisma.departmentReport.deleteMany({
                where: {
                    id: { in: staleReports.map(r => r.id) }
                }
            });
            console.log(`[Reports] Purged ${staleReports.length} stale reports.`);
        }
    } catch (err) {
        console.error('[Reports] Auto-purge failed:', err);
    }
};

export const createReport = catchAsync(async (req: Request, res: Response) => {
    const { type, content, departmentId } = req.body;
    const user = (req as any).user;
    const file = (req as any).file;

    const targetDeptId = departmentId || user.departmentId;

    if (!targetDeptId) {
        throw new AppError('Department context is missing. Cannot submit report.', 400);
    }

    if (user.role === 'DEPARTMENT_LEADER') {
        const isManaging = user.managedDepartments?.some((d: any) => d.id === targetDeptId) || user.departmentId === targetDeptId;
        if (!isManaging) {
            throw new AppError('Leaders can only submit reports for their own department.', 403);
        }
    }

    const report = await prisma.departmentReport.create({
        data: {
            type,
            content: content || null,
            departmentId: targetDeptId,
            submittedById: user.id,
            fileUrl: file ? `/uploads/${file.filename}` : null,
            fileName: file ? file.originalname : null
        },
        include: {
            department: { select: { name: true } },
            submittedBy: { select: { name: true } }
        }
    });

    await logAudit(user.id, 'CREATE', 'DEPARTMENT_REPORT', report.id, { type, departmentId: targetDeptId });

    res.status(201).json(report);
});

export const getReports = catchAsync(async (req: Request, res: Response) => {
    // Fire and forget purge
    purgeStaleReports();

    const { departmentId, type } = req.query;
    const user = (req as any).user;

    const where: any = {};
    if (type) where.type = String(type);

    // Visibility Scoping 
    if (user.role === 'SUPER_ADMIN' || user.role === 'SYSTEM_ADMIN' || user.role === 'WATUA') {
        // Bishop and Admins see all
        if (departmentId) where.departmentId = String(departmentId);
    } else {
        // Leaders only see their own department's reports (History)
        const managedDeptIds = user.managedDepartments?.map((d: any) => d.id) || [];
        if (user.departmentId) managedDeptIds.push(user.departmentId);

        if (departmentId && !managedDeptIds.includes(String(departmentId))) {
            throw new AppError('Access denied. You can only view reports for your own department.', 403);
        }

        where.departmentId = departmentId ? String(departmentId) : { in: managedDeptIds };
    }

    const reports = await prisma.departmentReport.findMany({
        where,
        include: {
            department: { select: { name: true } },
            submittedBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.json(reports);
});

export const downloadReport = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;
    
    const report = await prisma.departmentReport.findUnique({
        where: { id },
    });

    if (!report || !report.fileUrl) {
        throw new AppError('Report not found or has no file attachment.', 404);
    }

    // Security check for downloading
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SYSTEM_ADMIN' && user.role !== 'WATUA') {
        const managedDeptIds = user.managedDepartments?.map((d: any) => d.id) || [];
        if (user.departmentId) managedDeptIds.push(user.departmentId);

        if (!managedDeptIds.includes(report.departmentId)) {
            throw new AppError('Access denied to download external department report.', 403);
        }
    }

    // 🚀 Mark as downloaded if it's the Bishop/Admin downloading it for the first time
    if (!report.downloadedAt && ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA'].includes(user.role)) {
        await prisma.departmentReport.update({
            where: { id },
            data: { downloadedAt: new Date() }
        });
        console.log(`[Reports] Timer started for report ${id}. Deletion expected in 10 days.`);
        await logAudit(user.id, 'READ', 'DEPARTMENT_REPORT', id, { action: 'DOWNLOADED_BY_BISHOP' });
    }

    const filePath = path.join(process.cwd(), report.fileUrl.replace(/^\//, ''));
    
    if (!fs.existsSync(filePath)) {
        throw new AppError('File physical record missing. It may have been purged.', 404);
    }

    res.download(filePath, report.fileName || 'report.pdf');
});

export const deleteReport = catchAsync(async (req: Request, res: Response) => {
    // Only available to WATUA/SUPER_ADMIN for immediate removal if required
    const { id } = req.params;
    const report = await prisma.departmentReport.findUnique({ where: { id } });
    if (!report) throw new AppError('Report not found', 404);

    if (report.fileUrl) {
        const filePath = path.join(process.cwd(), report.fileUrl.replace(/^\//, ''));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.departmentReport.delete({ where: { id } });
    await logAudit((req as any).user.id, 'DELETE', 'DEPARTMENT_REPORT', id, { type: report.type });

    res.json({ message: 'Report hard deleted successfully' });
});
