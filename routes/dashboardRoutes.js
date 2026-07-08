const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware); // Wajib login

router.get('/', dashboardController.getStatistics);
router.get('/priority', dashboardController.getPriorityTasks);

module.exports = router;