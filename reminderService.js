const cron = require('node-cron');
const nodemailer = require('nodemailer');
const db = require('../config/db');

// Setup Transporter Email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Fungsi untuk mengirim WhatsApp menggunakan Fonnte API
const sendWhatsApp = async (target, message) => {
    try {
        const response = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': process.env.FONNTE_TOKEN,
            },
            body: new URLSearchParams({
                target: target,
                message: message,
                countryCode: '62', // Kode negara Indonesia
            })
        });
        const result = await response.json();
        console.log("Status WA Fonnte:", result.detail || result.reason);
    } catch (error) {
        console.error("Gagal mengirim WA:", error);
    }
};

// Fungsi Utama Robot Pengecek
const checkAndSendReminders = async () => {
    console.log("⏰ [Cron Job] Mengecek tugas yang besok deadline...");

    try {
        // Query SQL: Cari task yang besok deadline, belum selesai, dan belum di-remind
        // Sekaligus JOIN dengan tabel users untuk mengambil pengaturan notifikasi
        const query = `
            SELECT t.id, t.title, t.due_date, u.name, u.email, u.whatsapp_number, u.notif_email, u.notif_whatsapp
            FROM tasks t
            JOIN users u ON t.user_id = u.id
            WHERE t.status != 'completed' 
            AND t.is_reminded = FALSE
            AND DATE(t.due_date) = CURDATE() + INTERVAL 1 DAY
        `;

        const [tasksToRemind] = await db.query(query);

        if (tasksToRemind.length === 0) {
            console.log("✅ Tidak ada reminder untuk dikirim saat ini.");
            return;
        }

        for (const task of tasksToRemind) {
            const formattedDate = new Date(task.due_date).toLocaleString('id-ID');
            const messageText = `Halo ${task.name}!\n\nIni adalah pengingat otomatis dari TaskFlow AI.\nTugas kamu yang berjudul *"${task.title}"* akan jatuh tempo besok pada ${formattedDate}.\n\nJangan lupa dikerjakan ya! Semangat! 🚀`;

            // 1. Kirim Email jika user mengaktifkan toggle Email
            if (task.notif_email && task.email) {
                const mailOptions = {
                    from: `"TaskFlow AI" <${process.env.EMAIL_USER}>`,
                    to: task.email,
                    subject: `⚠️ Reminder: ${task.title} Deadline Besok!`,
                    text: messageText
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) console.log("Gagal kirim email:", error);
                    else console.log(`📧 Email terkirim ke ${task.email}`);
                });
            }

            // 2. Kirim WA jika user mengaktifkan toggle WA dan punya nomor
            if (task.notif_whatsapp && task.whatsapp_number) {
                await sendWhatsApp(task.whatsapp_number, messageText);
                console.log(`📱 WA diproses ke ${task.whatsapp_number}`);
            }

            // 3. Tandai task sudah di-remind agar tidak dikirim ulang
            await db.query('UPDATE tasks SET is_reminded = TRUE WHERE id = ?', [task.id]);
        }

    } catch (error) {
        console.error("Terjadi kesalahan pada Robot Reminder:", error);
    }
};

// Menjalankan Cron Job
// Bintang 5 kali (* * * * *) artinya jalan SETIAP MENIT (Cocok untuk testing)
// Kalau nanti webnya sudah mau rilis, ganti jadi ('0 8 * * *') artinya jalan tiap jam 8 pagi.
const startCronJob = () => {
    cron.schedule('* * * * *', checkAndSendReminders);
    console.log("🤖 Mesin Reminder (Cron Job) berhasil dijalankan!");
};

module.exports = { startCronJob };