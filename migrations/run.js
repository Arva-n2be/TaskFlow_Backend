const db = require('../config/db');

async function migrate() {
    try {
        const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'shortcut_ids'");
        if (columns.length > 0) {
            console.log('Kolom shortcut_ids sudah ada.');
            process.exit(0);
        }

        await db.query(
            'ALTER TABLE users ADD COLUMN shortcut_ids JSON DEFAULT NULL AFTER password_hash'
        );
        console.log('Migration berhasil: kolom shortcut_ids ditambahkan.');
        process.exit(0);
    } catch (error) {
        console.error('Migration gagal:', error.message);
        process.exit(1);
    }
}

migrate();
