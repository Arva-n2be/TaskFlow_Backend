const db = require('../config/db');

// Mengambil semua project milik user yang sedang login atau yang diikutinya
exports.getProjects = async (req, res) => {
    try {
        const userId = req.user.id; // Didapat dari authMiddleware
        const query = `
            SELECT p.*, 
                   (
                       SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name, 'email', u.email, 'role', pm_role))
                       FROM (
                           SELECT user_id, 'member' AS pm_role FROM project_members WHERE project_id = p.id
                           UNION
                           SELECT p.user_id AS user_id, 'owner' AS pm_role
                       ) AS pm_users
                       JOIN users u ON pm_users.user_id = u.id
                   ) AS members,
                   (
                       SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pl.id, 'title', pl.title, 'url', pl.url))
                       FROM project_links pl
                       WHERE pl.project_id = p.id
                   ) AS links
            FROM projects p
            WHERE p.user_id = ?
            UNION
            SELECT p.*,
                   (
                       SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'name', u.name, 'email', u.email, 'role', pm_role))
                       FROM (
                           SELECT user_id, 'member' AS pm_role FROM project_members WHERE project_id = p.id
                           UNION
                           SELECT p.user_id AS user_id, 'owner' AS pm_role
                       ) AS pm_users
                       JOIN users u ON pm_users.user_id = u.id
                   ) AS members,
                   (
                       SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pl.id, 'title', pl.title, 'url', pl.url))
                       FROM project_links pl
                       WHERE pl.project_id = p.id
                   ) AS links
            FROM projects p
            JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = ?
            ORDER BY created_at DESC
        `;
        const [projects] = await db.query(query, [userId, userId]);
        res.json(projects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
};

// Membuat project baru
exports.createProject = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, deadline } = req.body;

        const [result] = await db.query(
            'INSERT INTO projects (user_id, name, description, deadline) VALUES (?, ?, ?, ?)',
            [userId, name, description, deadline || null]
        );

        res.status(201).json({ message: 'Project berhasil dibuat!', projectId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal membuat project' });
    }
};

// Menghapus project
exports.deleteProject = async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.id;

        // Cek dan hapus project (pastikan itu milik user tersebut)
        const [result] = await db.query('DELETE FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Project tidak ditemukan atau Anda tidak memiliki akses' });
        }

        res.json({ message: 'Project berhasil dihapus!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal menghapus project' });
    }
};

// Update project details
exports.updateProject = async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.id;
        const { name, description, deadline } = req.body;

        const [result] = await db.query(
            'UPDATE projects SET name = ?, description = ?, deadline = ? WHERE id = ? AND user_id = ?',
            [name, description, deadline || null, projectId, userId]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Project tidak ditemukan atau akses ditolak' });

        res.json({ message: 'Project berhasil diperbarui' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengupdate project' });
    }
};

// Mengambil semua anggota project (termasuk owner)
exports.getProjectMembers = async (req, res) => {
    try {
        const projectId = req.params.id;
        const query = `
            SELECT u.id, u.name, u.email, 'member' as role FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = ?
            UNION
            SELECT u.id, u.name, u.email, 'owner' as role FROM projects p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        `;
        const [members] = await db.query(query, [projectId, projectId]);
        res.json(members);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil data anggota project' });
    }
};

// Mengundang anggota ke project
exports.inviteMember = async (req, res) => {
    try {
        const projectId = req.params.id;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email wajib diisi' });
        }

        // Cek user berdasarkan email
        const [[user]] = await db.query('SELECT id, name FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(404).json({ message: 'User dengan email tersebut tidak ditemukan' });
        }

        // Cek apakah user adalah owner project
        const [[project]] = await db.query('SELECT user_id FROM projects WHERE id = ?', [projectId]);
        if (!project) {
            return res.status(404).json({ message: 'Project tidak ditemukan' });
        }

        // Cek apakah sudah jadi member
        const [[existingMember]] = await db.query(
            'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
            [projectId, user.id]
        );
        if (existingMember || project.user_id === user.id) {
            return res.status(400).json({ message: 'User sudah menjadi anggota atau pemilik project ini' });
        }

        // Masukkan ke project_members
        await db.query(
            "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
            [projectId, user.id]
        );

        res.json({ message: `Berhasil mengundang ${user.name} ke project!` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengundang anggota project' });
    }
};

// Menambahkan link ke project
exports.addProjectLink = async (req, res) => {
    try {
        const projectId = req.params.id;
        const { title, url } = req.body;

        if (!title || !url) {
            return res.status(400).json({ message: 'Judul dan URL wajib diisi' });
        }

        await db.query(
            'INSERT INTO project_links (project_id, title, url) VALUES (?, ?, ?)',
            [projectId, title, url]
        );

        res.status(201).json({ message: 'Link project berhasil ditambahkan!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal menambahkan link project' });
    }
};

// Menghapus link dari project
exports.deleteProjectLink = async (req, res) => {
    try {
        const { id, linkId } = req.params;

        await db.query(
            'DELETE FROM project_links WHERE id = ? AND project_id = ?',
            [linkId, id]
        );

        res.json({ message: 'Link project berhasil dihapus!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal menghapus link project' });
    }
};