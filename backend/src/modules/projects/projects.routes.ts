import { Router } from 'express';
import { 
    getProjects, 
    getProjectsByDepartment,
    getProjectById, 
    createProject, 
    updateProject, 
    deleteProject, 
    addProjectUpdate
} from './projects.controller.js';
import { authenticate, authorize, departmentGuard } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { CreateProjectSchema, UpdateProjectSchema, ProjectUpdateCommentSchema } from '../../schemas/ProjectSchema.js';

const router = Router();

router.use(authenticate);

// 🔍 READ ACCESS
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.get('/department/:departmentId', departmentGuard, getProjectsByDepartment);

// 🛠️ MANAGEMENT ACCESS
router.post('/', 
    authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'DEPARTMENT_LEADER', 'PASTOR']),
    validate(CreateProjectSchema),
    createProject 
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

// 🗑️ DESTRUCTIVE ACTIONS
router.delete('/:id', 
    authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA']), 
    deleteProject
);

export default router;
