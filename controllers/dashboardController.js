const db = require('../config/db');

exports.getStatistics = async (req, res) => {
    try {
        const userId = req.user.id; // Hanya ambil data milik user yang sedang login

        // 1. Hitung Statistik Tasks
        const [[{ total_tasks }]] = await db.query(
            'SELECT COUNT(*) as total_tasks FROM tasks WHERE user_id = ?',
            [userId]
        );
        const [[{ active_tasks }]] = await db.query(
            "SELECT COUNT(*) as active_tasks FROM tasks WHERE user_id = ? AND status != 'completed'",
            [userId]
        );
        const [[{ completed_tasks }]] = await db.query(
            "SELECT COUNT(*) as completed_tasks FROM tasks WHERE user_id = ? AND status = 'completed'",
            [userId]
        );
        const [[{ overdue_tasks }]] = await db.query(
            "SELECT COUNT(*) as overdue_tasks FROM tasks WHERE user_id = ? AND due_date < NOW() AND status != 'completed'",
            [userId]
        );

        // 2. Hitung Statistik Projects
        const [[{ total_projects }]] = await db.query(
            `SELECT COUNT(DISTINCT p.id) as total_projects FROM projects p
             LEFT JOIN project_members pm ON p.id = pm.project_id
             WHERE p.user_id = ? OR pm.user_id = ?`,
            [userId, userId]
        );

        // 3. Overview Progress Project (Ambil 5 project terakhir beserta progress-nya dan deskripsi, milik sendiri maupun yang diikuti)
        const query = `
            SELECT DISTINCT p.id, p.name, p.progress, p.description, p.created_at FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.user_id = ? OR pm.user_id = ?
            ORDER BY p.created_at DESC
            LIMIT 5
        `;
        const [project_overview] = await db.query(query, [userId, userId]);

        // Kirim semua data sebagai JSON
        res.json({
            task_stats: {
                total: total_tasks,
                active: active_tasks,
                completed: completed_tasks,
                overdue: overdue_tasks
            },
            project_stats: {
                total: total_projects,
                overview: project_overview
            }
        });

    } catch (error) {
        console.error("Error Dashboard Stats:", error);
        res.status(500).json({ message: 'Gagal mengambil data dashboard' });
    }
};
// Fitur Algoritma Pembobotan Prioritas
exports.getPriorityTasks = async (req, res) => {
    try {
        const userId = req.user.id;

        // Ambil semua tugas yang belum selesai
        const [tasks] = await db.query(
            "SELECT id, title, due_date, status FROM tasks WHERE user_id = ? AND status != 'completed'", 
            [userId]
        );

        if (tasks.length === 0) {
            return res.json([]);
        }

        const now = new Date();

        // Proses perhitungan skor (Algoritma Pembobotan)
        const scoredTasks = tasks.map(task => {
            let score = 0;
            let urgencyLabel = "Low";
            let color = "bg-green-100 text-green-700";

            // 1. Hitung Jarak Deadline
            if (task.due_date) {
                const dueDate = new Date(task.due_date);
                const diffTime = dueDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Selisih hari untuk deadline yang akan datang
                const daysLeft = diffTime < 0
                    ? Math.floor(diffTime / (1000 * 60 * 60 * 24))
                    : diffDays;

                if (diffTime < 0) {
                    score += 100; // Terlambat (Sangat Kritis)
                    urgencyLabel = "Overdue";
                    color = "bg-red-100 text-red-700";
                } else if (diffDays === 0 || diffDays === 1) {
                    score += 80; // Besok / Hari ini (High)
                    urgencyLabel = "High Priority";
                    color = "bg-orange-100 text-orange-700";
                } else if (diffDays <= 3) {
                    score += 50; // H-3 (Medium)
                    urgencyLabel = "Medium Priority";
                    color = "bg-yellow-100 text-yellow-700";
                } else {
                    score += 20; // Masih lama (Low)
                }

                return {
                    ...task,
                    score,
                    urgencyLabel,
                    color,
                    days_left: daysLeft
                };
            }

            score += 10; // Tidak ada deadline (Paling santai)

            // 2. Tambahan status (Kalau lagi dikerjain, prioritas naik sedikit)
            if (task.status === 'in_progress') {
                score += 15;
            }

            return {
                ...task,
                score,
                urgencyLabel,
                color,
                days_left: null
            };
        });

        // Urutkan dari skor tertinggi (Descending)
        scoredTasks.sort((a, b) => b.score - a.score);

        // Ambil Top 3 tugas teratas untuk dipajang di Dashboard
        const top3Tasks = scoredTasks.slice(0, 3);

        res.json(top3Tasks);

    } catch (error) {
        console.error("Error Priority Tasks:", error);
        res.status(500).json({ message: 'Gagal mengambil prioritas tugas' });
    }
};