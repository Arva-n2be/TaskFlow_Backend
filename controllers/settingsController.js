const db = require('../config/db');

// Ambil pengaturan user saat ini
exports.getSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const [[user]] = await db.query(
            'SELECT email, whatsapp_number, notif_email, notif_whatsapp FROM users WHERE id = ?',
            [userId]
        );
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil pengaturan' });
    }
};

// Simpan pengaturan baru
exports.updateSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const { whatsapp_number, notif_email, notif_whatsapp } = req.body;

        await db.query(
            'UPDATE users SET whatsapp_number = ?, notif_email = ?, notif_whatsapp = ? WHERE id = ?',
            [whatsapp_number, notif_email, notif_whatsapp, userId]
        );

        res.json({ message: 'Pengaturan notifikasi berhasil disimpan!' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menyimpan pengaturan' });
    }
};