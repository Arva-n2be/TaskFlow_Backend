-- Tambah kolom shortcut_ids untuk menyimpan preferensi shortcut user (JSON array of IDs)
ALTER TABLE users
ADD COLUMN shortcut_ids JSON DEFAULT NULL
AFTER password_hash;
