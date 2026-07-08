const express = require('express');
const http = require('http'); // Tambahan baru
const { Server } = require('socket.io'); // Tambahan baru
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

app.set('io', io);

// Logika ketika ada user yang terkoneksi ke web
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Fitur "Room": User masuk ke "Kamar Project" tertentu
    socket.on('join_project', (projectId) => {
        socket.join(`project_${projectId}`);
        console.log(`User joined project room: ${projectId}`);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});


app.use(cors());
app.use(express.json());

// Import Routes
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes'); // Baru
const taskRoutes = require('./routes/taskRoutes');       // Baru
const aiRoutes = require('./routes/aiRoutes'); // <--- BARU
const subtaskRoutes = require('./routes/subtaskRoutes'); // <--- BARU
const dashboardRoutes = require('./routes/dashboardRoutes'); // <-- BARU
const shortcutRoutes = require('./routes/shortcutRoutes');
const calendarRoutes = require('./routes/calendarRoutes'); // <-- BARU
const settingsRoutes = require('./routes/settingsRoutes'); // <--- Tambah ini
const reminderService = require('./services/reminderService');


// Gunakan Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes); // Baru
app.use('/api/tasks', taskRoutes);       // Baru
app.use('/api/ai', aiRoutes);            // Baru
app.use('/api/subtasks', subtaskRoutes); // <--- BARU
app.use('/api/dashboard', dashboardRoutes); // <-- BARU
app.use('/api/shortcuts', shortcutRoutes);
app.use('/api/calendar', calendarRoutes); // <-- BARU
app.use('/api/settings', settingsRoutes); // <--- Tambah ini

app.get('/', (req, res) => {
    res.send('API TaskFlow berjalan dengan baik!');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server TaskFlow berjalan di port ${PORT}`);
});