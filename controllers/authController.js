const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Fungsi Register
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Cek apakah email sudah terdaftar
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Email sudah terdaftar!' });
        }

        // 2. Enkripsi password (Hashing)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Simpan ke database
        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        res.status(201).json({ message: 'Register berhasil!', userId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Fungsi Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Cari user berdasarkan email
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan!' });
        }

        const user = users[0];

        // 2. Cek kecocokan password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Password salah!' });
        }

        // 3. Buat Token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Token berlaku 1 hari
        );

        res.json({
            message: 'Login berhasil!',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Fungsi ambil profil saat ini
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await db.query('SELECT id, name, email FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan!' });
        }
        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

// Fungsi update data profil
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, password } = req.body;

        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan!' });
        }
        const currentUser = users[0];

        const updates = [];
        const values = [];

        if (name && name.trim() !== '') {
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (email && email.trim() !== '' && email.trim() !== currentUser.email) {
            const [existing] = await db.query('SELECT * FROM users WHERE email = ? AND id <> ?', [email.trim(), userId]);
            if (existing.length > 0) {
                return res.status(400).json({ message: 'Email sudah digunakan pengguna lain.' });
            }
            updates.push('email = ?');
            values.push(email.trim());
        }

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updates.push('password_hash = ?');
            values.push(hashedPassword);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Tidak ada data yang diubah.' });
        }

        values.push(userId);
        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

        const [updatedUsers] = await db.query('SELECT id, name, email FROM users WHERE id = ?', [userId]);

        res.json({
            message: 'Profil berhasil diperbarui.',
            user: updatedUsers[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};