const db = require('../config/db');

exports.getCalendarData = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Ambil Tasks yang ada due_date
        const [tasks] = await db.query(
            "SELECT id, title, due_date as start, 'task' as type FROM tasks WHERE user_id = ? AND due_date IS NOT NULL",
            [userId]
        );

        // 2. Ambil Projects yang ada deadline
        const [projects] = await db.query(
            "SELECT id, name as title, deadline as start, 'project' as type FROM projects WHERE user_id = ? AND deadline IS NOT NULL",
            [userId]
        );

        // 3. Ambil custom Events dari tabel events
        const [events] = await db.query(
            "SELECT id, title, description, event_date as start, 'event' as type, link FROM events WHERE user_id = ?",
            [userId]
        );

        // Gabungkan ketiganya
        const combinedData = [...tasks, ...projects, ...events].map(item => {
            // Tentukan warna berdasarkan tipe agar rapi di frontend
            let color = '#3b82f6'; // Blue untuk Task
            if (item.type === 'project') color = '#8b5cf6'; // Purple untuk Project
            if (item.type === 'event') color = '#10b981'; // Green untuk Event Custom

            return {
                id: `${item.type}-${item.id}`,
                title: item.title,
                start: item.start,
                backgroundColor: color,
                borderColor: color,
                extendedProps: { 
                    type: item.type, 
                    originalId: item.id, 
                    link: item.link || null,
                    description: item.description || null
                }
            };
        });

        res.json(combinedData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil data kalender' });
    }
};

// Tambah kegiatan manual (event)
exports.createEvent = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description, event_date, link } = req.body;

        await db.query(
            'INSERT INTO events (user_id, title, description, event_date, link) VALUES (?, ?, ?, ?, ?)',
            [userId, title, description, event_date, link || null]
        );

        res.status(201).json({ message: 'Kegiatan berhasil ditambahkan ke kalender!' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menambah kegiatan' });
    }
};

// Update an event
exports.updateEvent = async (req, res) => {
    try {
        const userId = req.user.id;
        const eventId = req.params.id;
        const { title, description, event_date, link } = req.body;

        const [result] = await db.query(
            'UPDATE events SET title = ?, description = ?, event_date = ?, link = ? WHERE id = ? AND user_id = ?',
            [title, description, event_date || null, link || null, eventId, userId]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Event tidak ditemukan atau akses ditolak' });

        res.json({ message: 'Event berhasil diperbarui' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengupdate event' });
    }
};