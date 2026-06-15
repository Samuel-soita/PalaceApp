import { Router } from 'express';
import { 
    getProjects, 
    getProjectsByDepartment,
    getProjectById, 
    createProject, 
    updateProject, 
    deleteProject, 
    addProjectUpdate,
    approveProject,
    updateProjectStatus
} from './projects.controller.js';
import { authenticate, authorize, departmentGuard } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { CreateProjectSchema, UpdateProjectSchema, ProjectUpdateCommentSchema } from '../../schemas/ProjectSchema.js';

const router = Router();

router.use(authenticate);

// 🔍 READ ACCESS
router.get('/', getProjects);
router.get('/department/:departmentId', departmentGuard, getProjectsByDepartment);
router.get('/:id', getProjectById);

// 🛠️ MANAGEMENT ACCESS
router.post('/', 
    authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'DEPARTMENT_LEADER', 'PASTOR']),
    validate(CreateProjectSchema),
    createProject // Internal check in controller will still check departmentId consistency if needed
);

router.patch('/:id', 
    authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'DEPARTMENT_LEADER', 'PASTOR']),
    validate(UpdateProjectSchema),
    updateProject
);

router.post('/:id/updates', 
    authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'DEPARTMENT_LEADER', 'PASTOR']),
    validate(ProjectUpdateCommentSchema),
    addProjectUpdate
);

router.post('/:id/approve',
    authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'PASTOR']),
    approveProject
);

router.patch('/:id/status',
    authorize(['WATUA', 'SUPER_ADMIN', 'PASTOR', 'ASSOCIATE_PASTOR']), 
    updateProjectStatus
);

// 🗑️ DESTRUCTIVE ACTIONS
router.delete('/:id', 
    authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA']), 
    deleteProject
);

export default router;
