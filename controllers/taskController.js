const db = require('../config/db');

// Mengambil semua task milik user
exports.getTasks = async (req, res) => {
    try {
        const userId = req.user.id;
        // Menggunakan JOIN untuk mengambil nama project dan nama assignee
        const query = `
            SELECT t.*, p.name AS project_name, u.name AS assignee_name
            FROM tasks t 
            LEFT JOIN projects p ON t.project_id = p.id 
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.user_id = ?
               OR t.assignee_id = ?
               OR t.project_id IN (
                   SELECT project_id FROM project_members WHERE user_id = ?
               )
            ORDER BY t.position ASC, t.created_at DESC
        `;
        const [tasks] = await db.query(query, [userId, userId, userId]);
        res.json(tasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
};

// Membuat task baru
exports.createTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const { project_id, title, description, due_date, assignee_id } = req.body;

        const [result] = await db.query(
            'INSERT INTO tasks (project_id, user_id, assignee_id, title, description, due_date) VALUES (?, ?, ?, ?, ?, ?)',
            [project_id || null, userId, assignee_id || null, title, description, due_date || null]
        );

        res.status(201).json({ message: 'Task berhasil dibuat!', taskId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal membuat task' });
    }
};

const recalculateProjectProgress = async (projectId) => {
    if (!projectId) return; // Jika task tidak punya project, lewati

    // Hitung total task di project tersebut
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM tasks WHERE project_id = ?', [projectId]);

    // Hitung total task yang berstatus 'completed' di project tersebut
    const [[{ completed }]] = await db.query("SELECT COUNT(*) as completed FROM tasks WHERE project_id = ? AND status = 'completed'", [projectId]);

    // Hitung persentase
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update ke tabel projects
    await db.query('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
};

// Update status task (pending, in_progress, completed)
exports.updateTaskStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.id;
        const { status } = req.body;

        // 1. Update status task-nya
        const [result] = await db.query(
            'UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?',
            [status, taskId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Task tidak ditemukan atau Anda tidak memiliki akses' });
        }

        // 2. Cari tahu task ini masuk ke project mana
        const [[task]] = await db.query('SELECT project_id, title FROM tasks WHERE id = ?', [taskId]);

        // 3. Kalkulasi ulang progress project-nya!
        await recalculateProjectProgress(task.project_id);

        // Panggil Socket.io yang tadi kita simpan di server.js
        const io = req.app.get('io');
        
        // Teriak (Emit) HANYA ke user yang ada di "Kamar Project" yang sama
        if (task && task.project_id) {
            io.to(`project_${task.project_id}`).emit('task_status_changed', {
                taskId: taskId,
                taskTitle: task.title,
                newStatus: status,
                updatedBy: req.user.name // Biar tahu siapa yang ngerjain
            });
        }

        res.json({ message: 'Status task berhasil diupdate!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal update task' });
    }
};

// Menghapus task
exports.deleteTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.id;

        const [[task]] = await db.query('SELECT project_id FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
        if (!task) return res.status(404).json({ message: 'Task tidak ditemukan' });

        await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);

        // Kalkulasi ulang setelah dihapus
        await recalculateProjectProgress(task.project_id);

        res.json({ message: 'Task berhasil dihapus!' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus task' });
    }
};

// Update task details (title, description, due_date, project_id, assignee_id)
exports.updateTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const taskId = req.params.id;
        const { title, description, due_date, project_id, assignee_id } = req.body;

        // Ambil project_id sebelum update untuk kalkulasi ulang progress jika berubah
        const [[existing]] = await db.query('SELECT project_id FROM tasks WHERE id = ?', [taskId]);
        if (!existing) return res.status(404).json({ message: 'Task tidak ditemukan' });

        await db.query(
            'UPDATE tasks SET title = ?, description = ?, due_date = ?, project_id = ?, assignee_id = ? WHERE id = ?',
            [title, description, due_date || null, project_id || null, assignee_id || null, taskId]
        );

        // Recalculate progress for previous and new project if changed
        const oldProjectId = existing.project_id;
        const newProjectId = project_id || null;
        await recalculateProjectProgress(oldProjectId);
        if (newProjectId && newProjectId !== oldProjectId) await recalculateProjectProgress(newProjectId);

        res.json({ message: 'Task berhasil diperbarui' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengupdate task' });
    }
};

// Mengupdate urutan (posisi) task secara massal
exports.reorderTasks = async (req, res) => {
    try {
        const { taskIds } = req.body;
        if (!Array.isArray(taskIds)) {
            return res.status(400).json({ message: 'Format data tidak valid' });
        }

        // Update posisi masing-masing task di database
        const queries = taskIds.map((id, index) =>
            db.query('UPDATE tasks SET position = ? WHERE id = ?', [index, id])
        );
        await Promise.all(queries);

        res.json({ message: 'Urutan task berhasil diperbarui' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal memperbarui urutan task' });
    }
};