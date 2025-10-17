// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Score Schema
const scoreSchema = new mongoose.Schema({
    userId: String,
    username: String,
    photoUrl: String,
    score: Number,
    timestamp: { type: Date, default: Date.now }
});

const Score = mongoose.model('Score', scoreSchema);

// Archive Score Schema (keeps archived scores)
const archiveScoreSchema = new mongoose.Schema({
    userId: String,
    username: String,
    photoUrl: String,
    score: Number,
    timestamp: Date,
    archivedAt: { type: Date, default: Date.now }
});

const ArchiveScore = mongoose.model('ArchiveScore', archiveScoreSchema);

// Routes
app.post('/scores', async (req, res) => {
    try {
        // Basic validation
        const { userId, username, score: pts } = req.body;
        if (!userId || !username || typeof pts !== 'number') {
            return res.status(400).json({ error: 'Invalid payload. Required: userId, username, score (number)' });
        }

        const score = new Score(req.body);
        await score.save();
        res.json({ success: true, rank: await getRank(score.userId) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/scores/top/:limit', async (req, res) => {
    const limit = parseInt(req.params.limit);
    const scores = await Score.find().sort({ score: -1 }).limit(limit);
    res.json(scores);
});

app.get('/scores/user/:userId', async (req, res) => {
    const userScore = await Score.findOne({ userId: req.params.userId }).sort({ score: -1 });
    const rank = await getRank(req.params.userId);
    res.json({ score: userScore, rank });
});

async function getRank(userId) {
    const userScore = await Score.findOne({ userId }).sort({ score: -1 });
    if (!userScore) return null;
    
    const higherScores = await Score.countDocuments({ 
        score: { $gt: userScore.score } 
    });
    
    return higherScores + 1;
}

// Archive job (run daily)
const archiveScores = async () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
        const oldScores = await Score.find({ timestamp: { $lt: oneWeekAgo } });
        if (!oldScores || oldScores.length === 0) return;

        // Prepare archived docs (ensure archivedAt present)
        const toInsert = oldScores.map(doc => {
            const obj = doc.toObject();
            obj.archivedAt = new Date();
            return obj;
        });

        await ArchiveScore.insertMany(toInsert);
        await Score.deleteMany({ timestamp: { $lt: oneWeekAgo } });
        console.log(`Archived ${toInsert.length} scores`);
    } catch (err) {
        console.error('Archive job failed:', err.message);
    }
};

// Schedule archive job daily at midnight (server local time)
const scheduleArchive = () => {
    // Try to use node-cron if available, otherwise fallback to setInterval (24h)
    try {
        const cron = require('node-cron');
        // run at 00:05 every day to allow day-end inserts
        cron.schedule('5 0 * * *', archiveScores);
        console.log('Archive job scheduled with node-cron (05:00)');
    } catch (e) {
        // fallback: run every 24 hours
        setInterval(archiveScores, 24 * 60 * 60 * 1000);
        console.log('Archive job scheduled with setInterval (24h) fallback');
    }
};

// Fail fast if MONGODB_URI is missing to avoid confusing connection attempts
if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI environment variable. Set it before starting the server.');
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        const port = process.env.PORT || 3000;
        const server = app.listen(port, () => console.log(`Server running on port ${port}`));

        // schedule archive after DB connection
        scheduleArchive();

        // Graceful shutdown
        const shutdown = () => {
            console.log('Shutting down...');
            server.close(() => {
                mongoose.disconnect().then(() => process.exit(0));
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    });