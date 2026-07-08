const express = require('express');
const router = express.Router();
const shortcutController = require('../controllers/shortcutController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', shortcutController.getShortcuts);
router.put('/', shortcutController.updateShortcuts);

module.exports = router;
