const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes');

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', healthRoutes);

// Root Route fallback
app.get('/', (req, res) => {
    res.json({ message: "Welcome to Bloom API Services" });
});

// 404 Route Handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Resource not found" });
});

module.exports = app;
