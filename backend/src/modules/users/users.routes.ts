import { Router } from 'express';
import { 
    getUsers, 
    getPendingUsers, 
    activateUser, 
    markCardAsPaid,
    getUsersTechnical,
    getSystemStats,
    getSystemDiagnostics,
    getAuditLogsTechnical,
    getTrashHub,
    restoreEntity,
    getFeatureFlags,
    updateFeatureFlag,
    executeIntervention,
    updateUserBioTechnical,
    enrollPartnership,
    requestCardRenewal,
    approveCardRenewal,
    searchUsers,
    purgeUser
} from './users.controller.js';
import { authenticate, authorize, moduleGuard } from '../../middleware/auth.middleware.js';
import { mutationLimiter } from '../../middleware/rate-limiting.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { UserUpdateSchema, UserRegistrationSchema } from '../../schemas/UserSchema.js';

const router = Router();

router.use(authenticate);

// 👤 CORE USER MANAGEMENT
router.get('/', moduleGuard('MemberRegistration'), getUsers);
router.get('/pending', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'WATUA']), moduleGuard('MemberRegistration'), getPendingUsers);
router.patch('/:id/status', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PASTOR', 'WATUA', 'SECRETARY']), mutationLimiter, moduleGuard('MemberRegistration'), activateUser);
router.patch('/:id/mark-paid', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY', 'WATUA']), markCardAsPaid);
router.get('/search-members', searchUsers);

// 🎁 PARTNERSHIP & CARD SERVICES
router.post('/partnership/enroll', mutationLimiter, enrollPartnership);
router.post('/card-renewal/request', mutationLimiter, requestCardRenewal);
router.post('/:id/card-renewal/approve', authorize(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'SECRETARY']), approveCardRenewal);

// 🛠️ WATUA TECHNICAL KERNEL (SYSTEM ENGINEER ONLY)
const watuaOnly = authorize(['WATUA']);
const highPrivilege = authorize(['WATUA', 'SUPER_ADMIN']);

router.get('/technical/all', watuaOnly, getUsersTechnical);
router.get('/technical/stats', watuaOnly, getSystemStats);
router.get('/technical/diagnostics', watuaOnly, getSystemDiagnostics);
router.get('/technical/audit/all', watuaOnly, getAuditLogsTechnical);
router.get('/technical/trash', watuaOnly, getTrashHub);
router.post('/technical/restore/:id', highPrivilege, mutationLimiter, restoreEntity);
router.get('/technical/flags', watuaOnly, getFeatureFlags);
router.patch('/technical/flags', watuaOnly, mutationLimiter, updateFeatureFlag);
router.post('/technical/intervention/:id', authorize(['WATUA', 'SUPER_ADMIN', 'SECRETARY']), mutationLimiter, executeIntervention);
router.patch('/technical/bio/:id', watuaOnly, mutationLimiter, validate(UserUpdateSchema), updateUserBioTechnical);
router.delete('/technical/purge/:id', watuaOnly, mutationLimiter, purgeUser);

// 👨‍🏫 PASTORAL CORE & WATUA DUAL-AUTH
import * as watuaController from './watua.controller.js';
import * as pastorController from './pastor.controller.js';

router.get('/pastor/assigned-modules', authorize(['PASTOR', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'WATUA']), pastorController.getPastorModules);
router.post('/pastor/modules/assign', highPrivilege, mutationLimiter, pastorController.assignModuleToPastor);
router.delete('/pastor/modules/revoke/:id', highPrivilege, mutationLimiter, pastorController.revokeModuleFromPastor);

router.post('/technical/action', watuaOnly, mutationLimiter, watuaController.initiateCriticalAction);
router.post('/technical/action/:id/approve', highPrivilege, mutationLimiter, watuaController.approveCriticalAction);
router.delete('/technical/action/:id', highPrivilege, mutationLimiter, watuaController.cancelCriticalAction);

export default router;
