const db = require('../config/db');
const Groq = require('groq-sdk');

// Inisialisasi Groq dengan key yang berbeda
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); 
const groqSmart = new Groq({ apiKey: process.env.GROQ_API_KEY_SMART_TASK });

exports.smartTaskCreation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ message: 'Prompt tidak boleh kosong' });
        }

        // Dapatkan waktu saat ini untuk acuan AI
        const today = new Date();
        const formattedDate = today.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Jakarta'
        });
        const formattedTime = today.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta'
        });

        // 2. Prompt Engineering: Memaksa output berupa JSON murni (Object)
        const systemPrompt = `
        Anda adalah asisten produktivitas AI. Ekstrak tugas atau pekerjaan dari teks pengguna berikut.
        Pecah menjadi tugas-tugas yang terstruktur.

        WAKTU SEKARANG SEBAGAI ACUAN: ${formattedDate}, pukul ${formattedTime} WIB.
        Gunakan WAKTU SEKARANG SEBAGAI ACUAN untuk menghitung tanggal/waktu relatif (misal: "besok", "lusa", "senin depan") dan jika pengguna tidak menyebutkan tahun, gunakan tahun berjalan saat ini (${today.getFullYear()}).

        Kembalikan HANYA format JSON Object yang valid tanpa teks tambahan, tanpa backticks (\`\`\`), dan tanpa format markdown.
        Struktur JSON yang WAJIB digunakan:
        {
            "tasks": [
                {
                    "title": "Nama Tugas (singkat dan jelas)",
                    "description": "Detail tugas berdasarkan teks pengguna",
                    "due_date": "YYYY-MM-DD HH:MM:SS" (atau null jika tidak disebutkan)
                }
            ]
        }

        Teks pengguna: "${prompt}"
        `;

        // 3. Minta respon dari Groq
        const chatCompletion = await groqSmart.chat.completions.create({
            messages: [{ role: 'user', content: systemPrompt }],
            model: 'llama-3.1-8b-instant',
            response_format: { type: 'json_object' }
        });

        const aiResponseText = chatCompletion.choices[0].message.content;

        // Parsing teks ke format JSON Node.js
        let structuredTasks;
        try {
            const parsedData = JSON.parse(aiResponseText);
            structuredTasks = parsedData.tasks || [];
        } catch (parseError) {
            console.error("Gagal parsing JSON dari AI:", aiResponseText);
            return res.status(500).json({ message: 'AI mengembalikan format yang tidak valid', rawResponse: aiResponseText });
        }

        // 4. Simpan log ke tabel ai_logs (Sesuai requirement skripsi)
        await db.query(
            'INSERT INTO ai_logs (user_id, feature_name, prompt, response) VALUES (?, ?, ?, ?)',
            [userId, 'Smart Task Creation', prompt, JSON.stringify(structuredTasks)]
        );

        // 5. Kembalikan data ke frontend
        res.json({
            message: 'Tugas berhasil diekstrak oleh AI',
            tasks: structuredTasks
        });

    } catch (error) {
        console.error("Error AI Smart Task Creation:", error);
        res.status(500).json({ message: 'Gagal memproses permintaan AI' });
    }
};
exports.taskBreakdown = async (req, res) => {
    try {
        const userId = req.user.id;
        const { task_id } = req.body;

        if (!task_id) {
            return res.status(400).json({ message: 'ID Tugas (task_id) diperlukan' });
        }

        // 1. Ambil detail task dari database
        const [tasks] = await db.query('SELECT title, description FROM tasks WHERE id = ? AND user_id = ?', [task_id, userId]);
        if (tasks.length === 0) {
            return res.status(404).json({ message: 'Task tidak ditemukan' });
        }
        const task = tasks[0];

        // 2. Prompt Engineering untuk Groq (Meminta JSON Object)
        const prompt = `Anda adalah asisten produktivitas. Tugas pengguna adalah: "${task.title}". Deskripsi: "${task.description || 'Tidak ada deskripsi'}".
        Pecah tugas ini menjadi maksimal 5 sub-tugas kecil yang bisa ditindaklanjuti.
        Berikan jawaban HANYA dalam format JSON dengan struktur persis seperti ini:
        {
          "subtasks": [
            {"title": "Nama sub-tugas 1"},
            {"title": "Nama sub-tugas 2"}
          ]
        }`;

        // 3. Panggil API Groq (Sangat Cepat!)
        // Kita pakai model Llama 3 (8B) karena super cepat dan pintar
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
            response_format: { type: 'json_object' } // Memaksa Groq mengembalikan JSON murni
        });

        const aiResponseText = chatCompletion.choices[0].message.content;

        // 4. Parsing JSON
        let parsedData;
        try {
            parsedData = JSON.parse(aiResponseText);
        } catch (error) {
            console.error("Gagal parse JSON dari Groq:", aiResponseText);
            return res.status(500).json({ message: 'Format respons AI tidak valid', raw: aiResponseText });
        }

        const subtasksData = parsedData.subtasks;

        // 5. Simpan Subtasks ke Database secara otomatis
        for (const sub of subtasksData) {
            await db.query('INSERT INTO subtasks (task_id, title) VALUES (?, ?)', [task_id, sub.title]);
        }

        // 6. Simpan Log AI
        await db.query(
            'INSERT INTO ai_logs (user_id, feature_name, prompt, response) VALUES (?, ?, ?, ?)',
            [userId, 'Task Breakdown (Groq)', prompt, JSON.stringify(subtasksData)]
        );

        res.json({
            message: 'Tugas berhasil dipecah menjadi subtasks dengan sekejap!',
            subtasks: subtasksData
        });

    } catch (error) {
        console.error("Error Groq Task Breakdown:", error);
        res.status(500).json({ message: 'Gagal menghubungi server AI' });
    }
};