const db = require('../config/db');

// Tambah Subtask manual
exports.createSubtask = async (req, res) => {
    try {
        const { task_id, title } = req.body;
        const [result] = await db.query(
            'INSERT INTO subtasks (task_id, title) VALUES (?, ?)',
            [task_id, title]
        );
        res.status(201).json({ message: 'Subtask berhasil dibuat!', subtaskId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal membuat subtask' });
    }
};

// Ambil subtask berdasarkan task_id
exports.getSubtasksByTask = async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const [subtasks] = await db.query('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC', [taskId]);
        res.json(subtasks);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data subtask' });
    }
};

// Update status subtask (Selesai / Belum)
exports.updateSubtaskStatus = async (req, res) => {
    try {
        const subtaskId = req.params.id;
        const { is_completed } = req.body; // boolean: true atau false
        await db.query('UPDATE subtasks SET is_completed = ? WHERE id = ?', [is_completed, subtaskId]);
        res.json({ message: 'Status subtask diupdate!' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal update subtask' });
    }
};

// Update detail subtask (title)
exports.updateSubtask = async (req, res) => {
    try {
        const subtaskId = req.params.id;
        const { title } = req.body;
        await db.query('UPDATE subtasks SET title = ? WHERE id = ?', [title, subtaskId]);
        res.json({ message: 'Subtask berhasil diperbarui!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal memperbarui subtask' });
    }
};

// Hapus subtask
exports.deleteSubtask = async (req, res) => {
    try {
        const subtaskId = req.params.id;
        await db.query('DELETE FROM subtasks WHERE id = ?', [subtaskId]);
        res.json({ message: 'Subtask dihapus!' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus subtask' });
    }
};