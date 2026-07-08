const express = require('express');
const router = express.Router();
const subtaskController = require('../controllers/subtaskController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware); // Semua route butuh login

router.post('/', subtaskController.createSubtask);
router.get('/task/:taskId', subtaskController.getSubtasksByTask);
router.put('/:id/status', subtaskController.updateSubtaskStatus);
router.put('/:id', subtaskController.updateSubtask);
router.delete('/:id', subtaskController.deleteSubtask);

module.exports = router;