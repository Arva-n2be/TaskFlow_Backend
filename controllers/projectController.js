const db = require('../config/db');

const getProjectForUser = async (projectId, userId) => {
    const [[project]] = await db.query(
        `SELECT p.*, 
                CASE 
                    WHEN p.user_id = ? THEN 'owner'
                    WHEN pm.user_id IS NOT NULL THEN 'member'
                    ELSE NULL
                END AS current_user_role
         FROM projects p
         LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
         WHERE p.id = ?`,
        [userId, userId, projectId]
    );
    return project;
};

const createProjectNotification = async (userId, projectId, type, message) => {
    await db.query(
        'INSERT INTO project_notifications (user_id, project_id, type, message) VALUES (?, ?, ?, ?)',
        [userId, projectId, type, message]
    );
};

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

exports.getProjectNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const [invitations] = await db.query(
            `SELECT pi.id, pi.project_id, pi.inviter_id, pi.status, pi.created_at,
                    p.name AS project_name, u.name AS inviter_name, u.email AS inviter_email
             FROM project_invitations pi
             JOIN projects p ON pi.project_id = p.id
             JOIN users u ON pi.inviter_id = u.id
             WHERE pi.invitee_id = ? AND pi.status = 'pending'
             ORDER BY pi.created_at DESC`,
            [userId]
        );
        const [notifications] = await db.query(
            `SELECT pn.id, pn.project_id, pn.type, pn.message, pn.is_read, pn.created_at,
                    p.name AS project_name
             FROM project_notifications pn
             JOIN projects p ON pn.project_id = p.id
             WHERE pn.user_id = ? AND pn.is_read = false
             ORDER BY pn.created_at DESC`,
            [userId]
        );

        res.json({ invitations, notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil notifikasi project' });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.notificationId;
        await db.query('UPDATE project_notifications SET is_read = true WHERE id = ? AND user_id = ?', [notificationId, userId]);
        res.json({ message: 'Notifikasi ditandai sudah dibaca' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal memperbarui notifikasi' });
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
        const userId = req.user.id;
        const projectId = req.params.id;
        const project = await getProjectForUser(projectId, userId);
        if (!project || !project.current_user_role) {
            return res.status(403).json({ message: 'Anda tidak memiliki akses ke project ini' });
        }
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
        const inviterId = req.user.id;
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
        const [[project]] = await db.query('SELECT id, name, user_id FROM projects WHERE id = ?', [projectId]);
        if (!project) {
            return res.status(404).json({ message: 'Project tidak ditemukan' });
        }
        if (project.user_id !== inviterId) {
            return res.status(403).json({ message: 'Hanya owner yang bisa mengundang anggota' });
        }
        if (user.id === inviterId) {
            return res.status(400).json({ message: 'Anda sudah menjadi owner project ini' });
        }

        // Cek apakah sudah jadi member
        const [[existingMember]] = await db.query(
            'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
            [projectId, user.id]
        );
        if (existingMember || project.user_id === user.id) {
            return res.status(400).json({ message: 'User sudah menjadi anggota atau pemilik project ini' });
        }

        const [[existingInvite]] = await db.query(
            "SELECT id FROM project_invitations WHERE project_id = ? AND invitee_id = ? AND status = 'pending'",
            [projectId, user.id]
        );
        if (existingInvite) {
            return res.status(400).json({ message: 'User ini sudah memiliki undangan pending' });
        }

        await db.query(
            "INSERT INTO project_invitations (project_id, inviter_id, invitee_id, status) VALUES (?, ?, ?, 'pending')",
            [projectId, inviterId, user.id]
        );

        res.json({ message: `Undangan untuk ${user.name} sudah dikirim dan menunggu konfirmasi.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengundang anggota project' });
    }
};

exports.respondInvitation = async (req, res) => {
    try {
        const userId = req.user.id;
        const invitationId = req.params.invitationId;
        const { action } = req.body;

        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Aksi undangan tidak valid' });
        }

        const [[invitation]] = await db.query(
            `SELECT pi.*, p.name AS project_name
             FROM project_invitations pi
             JOIN projects p ON pi.project_id = p.id
             WHERE pi.id = ? AND pi.invitee_id = ? AND pi.status = 'pending'`,
            [invitationId, userId]
        );
        if (!invitation) {
            return res.status(404).json({ message: 'Undangan tidak ditemukan atau sudah diproses' });
        }

        if (action === 'accept') {
            const [[existingMember]] = await db.query(
                'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
                [invitation.project_id, userId]
            );
            if (!existingMember) {
                await db.query(
                    "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
                    [invitation.project_id, userId]
                );
            }
        }

        await db.query(
            'UPDATE project_invitations SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ? AND invitee_id = ?',
            [action === 'accept' ? 'accepted' : 'rejected', invitationId, userId]
        );

        res.json({ message: action === 'accept' ? `Anda bergabung ke project ${invitation.project_name}.` : 'Undangan project ditolak.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal memproses undangan project' });
    }
};

exports.kickMember = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: projectId, memberId } = req.params;
        const [[project]] = await db.query('SELECT id, name, user_id FROM projects WHERE id = ?', [projectId]);
        if (!project) return res.status(404).json({ message: 'Project tidak ditemukan' });
        if (project.user_id !== userId) return res.status(403).json({ message: 'Hanya owner yang bisa mengeluarkan anggota' });
        if (Number(memberId) === Number(userId)) return res.status(400).json({ message: 'Owner tidak bisa kick diri sendiri. Gunakan fitur keluar project.' });

        const [result] = await db.query('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, memberId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Anggota tidak ditemukan di project ini' });

        await createProjectNotification(memberId, projectId, 'kicked', `Anda dikeluarkan dari project ${project.name}.`);
        res.json({ message: 'Anggota berhasil dikeluarkan dari project' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengeluarkan anggota project' });
    }
};

exports.leaveProject = async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.id;
        const { ownerAction } = req.body;
        const [[project]] = await db.query('SELECT id, name, user_id FROM projects WHERE id = ?', [projectId]);
        if (!project) return res.status(404).json({ message: 'Project tidak ditemukan' });

        if (project.user_id !== userId) {
            const [result] = await db.query('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Anda bukan anggota project ini' });
            return res.json({ message: 'Anda berhasil keluar dari project' });
        }

        const [members] = await db.query(
            `SELECT pm.user_id, u.name
             FROM project_members pm
             JOIN users u ON pm.user_id = u.id
             WHERE pm.project_id = ?
             ORDER BY pm.joined_at ASC, pm.id ASC`,
            [projectId]
        );

        if (members.length === 0) {
            return res.status(400).json({ message: 'Owner terakhir tidak bisa keluar tanpa menghapus project atau menambahkan anggota baru' });
        }

        if (ownerAction === 'kick_all') {
            await db.query('DELETE FROM project_members WHERE project_id = ?', [projectId]);
            return res.json({ message: 'Semua anggota dikeluarkan. Anda tetap menjadi owner project.' });
        }

        if (ownerAction === 'transfer_first') {
            const newOwner = members[0];
            await db.query('UPDATE projects SET user_id = ? WHERE id = ? AND user_id = ?', [newOwner.user_id, projectId, userId]);
            await db.query('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, newOwner.user_id]);
            await createProjectNotification(newOwner.user_id, projectId, 'owner_transfer', `Anda sekarang menjadi owner project ${project.name}.`);
            return res.json({ message: `${newOwner.name} sekarang menjadi owner. Anda sudah keluar dari project.` });
        }

        res.status(400).json({ message: 'Pilih aksi owner: kick_all atau transfer_first' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal keluar dari project' });
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
