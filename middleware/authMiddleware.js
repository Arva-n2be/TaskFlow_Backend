const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Ambil token dari header
    const token = req.header('Authorization');

    // Jika tidak ada token
    if (!token) {
        return res.status(401).json({ message: 'Akses ditolak! Token tidak ada.' });
    }

    try {
        // Format token biasanya "Bearer <token_string>", kita ambil token string-nya saja
        const tokenString = token.split(' ')[1] || token;

        // Verifikasi token
        const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);

        // Simpan data user ke request untuk dipakai di fungsi selanjutnya
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token tidak valid!' });
    }
};