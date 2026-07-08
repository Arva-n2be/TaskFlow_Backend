const db = require('../config/db');
const { SHORTCUT_CATALOG, DEFAULT_SHORTCUT_IDS, VALID_IDS } = require('../data/shortcutsCatalog');

function parseShortcutIds(raw) {
    if (raw == null) return DEFAULT_SHORTCUT_IDS;
    if (Array.isArray(raw)) return raw.filter((id) => VALID_IDS.has(id));
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((id) => VALID_IDS.has(id)) : DEFAULT_SHORTCUT_IDS;
    } catch {
        return DEFAULT_SHORTCUT_IDS;
    }
}

exports.getShortcuts = async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await db.query('SELECT shortcut_ids FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan!' });
        }

        const selectedIds = parseShortcutIds(users[0].shortcut_ids);

        res.json({ selectedIds, catalog: SHORTCUT_CATALOG });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

exports.updateShortcuts = async (req, res) => {
    try {
        const userId = req.user.id;
        const { selectedIds } = req.body;

        if (!Array.isArray(selectedIds)) {
            return res.status(400).json({ message: 'selectedIds harus berupa array.' });
        }

        const invalidIds = selectedIds.filter((id) => !VALID_IDS.has(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({ message: 'Shortcut tidak valid.', invalidIds });
        }

        const uniqueIds = [...new Set(selectedIds)];

        await db.query('UPDATE users SET shortcut_ids = ? WHERE id = ?', [JSON.stringify(uniqueIds), userId]);

        res.json({
            message: 'Shortcut berhasil disimpan.',
            selectedIds: uniqueIds,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};
