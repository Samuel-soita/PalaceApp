import { Router } from 'express';
import { createReport, getReports, downloadReport, deleteReport } from './reports.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { CreateReportSchema } from '../../schemas/ReportSchema.js';
import { upload } from '../../utils/upload.js';

const router = Router();

router.use(authenticate);

// Leaders (Submit Reports)
router.post('/',
    authorize(['DEPARTMENT_LEADER', 'PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN']),
    upload.single('report'),
    validate(CreateReportSchema),
    createReport
);

// Fetch Reports (Leader gets history, Bishop gets everything)
router.get('/', 
    authorize(['DEPARTMENT_LEADER', 'PASTOR', 'ASSOCIATE_PASTOR', 'SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN']), 
    getReports
);

// Bishop downloading reports
router.get('/:id/download', 
    authorize(['SUPER_ADMIN', 'WATUA', 'SYSTEM_ADMIN', 'DEPARTMENT_LEADER', 'PASTOR']), 
    downloadReport
);

export default router;
