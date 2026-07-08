const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

// Endpoint AI dilindungi token
router.use(authMiddleware);

// Route untuk Smart Task Creation
router.post('/smart-task', aiController.smartTaskCreation);
// Route untuk memecah Task menjadi Subtask (Ollama)
router.post('/task-breakdown', aiController.taskBreakdown);

module.exports = router;