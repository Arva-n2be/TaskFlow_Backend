const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', calendarController.getCalendarData);
router.post('/events', calendarController.createEvent);
router.put('/events/:id', calendarController.updateEvent);

module.exports = router;