const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');

// Terapkan authMiddleware ke semua endpoint project
router.use(authMiddleware);

router.get('/', projectController.getProjects);
router.get('/notifications', projectController.getProjectNotifications);
router.patch('/notifications/:notificationId/read', projectController.markNotificationRead);
router.post('/invitations/:invitationId/respond', projectController.respondInvitation);
router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);
router.get('/:id/members', projectController.getProjectMembers);
router.post('/:id/members', projectController.inviteMember);
router.delete('/:id/members/:memberId', projectController.kickMember);
router.post('/:id/leave', projectController.leaveProject);
router.post('/:id/links', projectController.addProjectLink);
router.delete('/:id/links/:linkId', projectController.deleteProjectLink);

module.exports = router;
