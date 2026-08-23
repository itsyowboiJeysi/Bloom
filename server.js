const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'bloom_secret_jwt_key_2026';

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.options('*', cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// --- DATA STORAGE & MYSQL INITIALIZATION ---
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let users = [];
if (fs.existsSync(USERS_FILE)) {
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        users = [];
    }
}

function saveUsers() {
    if (isDbConnected) {
        // All user data is persisted in MySQL database ('bloom_db')!
        // Skip writing to users.json on disk so live-server/file-watchers don't refresh the browser page.
        return;
    }
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error saving users to disk:', e);
    }
}

// MySQL Connection Setup
let isDbConnected = false;
let dbPool = null;

(async () => {
    try {
        const mysql = require('mysql2/promise');
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD || '';
        const dbName = process.env.DB_NAME || 'bloom_db';

        // Connect to MySQL server and ensure DB exists
        const rootConn = await mysql.createConnection({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
            multipleStatements: true
        });

        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        await rootConn.end();

        dbPool = mysql.createPool({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
            database: dbName,
            waitForConnections: true,
            connectionLimit: 10,
            multipleStatements: true
        });

        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            const conn = await dbPool.getConnection();
            await conn.query(schemaSql);
            // Ensure share_code column exists for private deck ID sharing
            try {
                await conn.query('ALTER TABLE flashcard_decks ADD COLUMN share_code VARCHAR(20) DEFAULT NULL UNIQUE;');
            } catch (e) {}
            conn.release();
        }

        isDbConnected = true;
        console.log(`✅ MySQL Database '${dbName}' connected & initialized successfully!`);
    } catch (err) {
        console.warn(`⚠️ MySQL Connection warning (using JSON file backup): ${err.message}`);
    }
})();

// Configure Nodemailer Transporter
let transporter;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        connectionTimeout: 3000,
        greetingTimeout: 3000,
        socketTimeout: 3000,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
} else {
    // Fallback Ethereal / Simulated Mailer for Dev
    nodemailer.createTestAccount().then(account => {
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: account.user,
                pass: account.pass
            }
        });
        console.log('🌱 Nodemailer dev test account configured:', account.user);
    }).catch(err => {
        console.warn('Nodemailer test account setup failed:', err.message);
    });
}

let pendingOtps = [];

// Send Welcome Email via Nodemailer
async function sendWelcomeEmail(toEmail, userName) {
    if (!transporter) return;
    try {
        const info = await transporter.sendMail({
            from: '"Bloom Study App 🌱" <noreply@bloom.app>',
            to: toEmail,
            subject: 'Welcome to Bloom! 🌱 Your Study Journey Begins',
            html: `
                <div style="font-family: Arial, sans-serif; background: #0E1310; color: #E8ECE9; padding: 32px; border-radius: 16px; max-width: 520px; margin: auto;">
                    <h2 style="color: #40916C; margin-bottom: 8px;">Welcome to Bloom, ${userName}! 🌱</h2>
                    <p style="color: #A3B18A; font-size: 15px; line-height: 1.5;">Thank you for registering. Your account is ready to track focus sessions, build study habits, earn XP, and join live study rooms!</p>
                    <div style="background: #18221C; border: 1px solid #2D6A4F; border-radius: 12px; padding: 16px; margin: 20px 0;">
                        <div style="font-weight: bold; color: #52B788;">Account Information:</div>
                        <div style="font-size: 14px; margin-top: 4px; color: #D8F3DC;">Email: <strong>${toEmail}</strong></div>
                    </div>
                    <p style="font-size: 13px; color: #748C7A;">Happy Studying!<br>The Bloom Team</p>
                </div>
            `
        });
        console.log(`✉️ Welcome email sent to ${toEmail}. MessageID: ${info.messageId}`);
    } catch (err) {
        console.error('Nodemailer send email error:', err.message);
    }
}

// Send OTP Verification Email
async function sendOtpEmail(toEmail, userName, otpCode) {
    if (!transporter) return;
    try {
        const info = await transporter.sendMail({
            from: '"Bloom Study App 🌱" <noreply@bloom.app>',
            to: toEmail,
            subject: `${otpCode} is your Bloom Sign-Up Verification Code 🌱`,
            html: `
                <div style="font-family: Arial, sans-serif; background: #0E1310; color: #E8ECE9; padding: 32px; border-radius: 16px; max-width: 520px; margin: auto; border: 1px solid #2D6A4F;">
                    <h2 style="color: #40916C; margin-bottom: 8px;">Verify Your Email 🌱</h2>
                    <p style="color: #A3B18A; font-size: 15px; line-height: 1.5;">Hi ${userName}, use the 6-digit OTP code below to verify your email address and complete your Bloom account registration:</p>
                    <div style="background: #18221C; border: 2px dashed #40916C; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #52B788;">${otpCode}</span>
                    </div>
                    <p style="font-size: 13px; color: #748C7A;">This code will expire in <strong>10 minutes</strong>. If you did not request this code, please ignore this email.</p>
                </div>
            `
        });
        console.log(`✉️ OTP email sent to ${toEmail}. MessageID: ${info.messageId}`);
    } catch (err) {
        console.error('Nodemailer send OTP email error:', err.message);
    }
}

// --- CONFIG ENDPOINT ---
app.get('/api/config/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// --- API ENDPOINTS ---

// 1. Google Auth Endpoint
app.post('/api/auth/google', async (req, res) => {
    try {
        const { email, name, avatar, photoUrl } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Google profile email is required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        let user = users.find(u => u.email === normalizedEmail);

        if (!user && isDbConnected && dbPool) {
            try {
                const [rows] = await dbPool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
                if (rows.length > 0) {
                    const row = rows[0];
                    user = {
                        id: `usr_${row.id}`,
                        dbId: row.id,
                        email: row.email,
                        name: row.username,
                        avatar: row.avatar_url || row.username.charAt(0).toUpperCase(),
                        authProvider: 'google',
                        xp: row.xp !== null ? row.xp : 0,
                        streak: row.current_streak !== null ? row.current_streak : 1,
                        todayStudyMinutes: 0,
                        createdAt: row.created_at
                    };
                    users.push(user);
                    saveUsers();
                }
            } catch (dbErr) {}
        }

        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            const displayName = name || normalizedEmail.split('@')[0];

            let dbUserId = null;
            if (isDbConnected && dbPool) {
                try {
                    const [result] = await dbPool.query(
                        'INSERT INTO users (username, email, password_hash, avatar_url, xp, current_streak) VALUES (?, ?, ?, ?, ?, ?)',
                        [displayName, normalizedEmail, 'oauth_google_user', photoUrl || avatar || displayName.charAt(0).toUpperCase(), 0, 1]
                    );
                    dbUserId = result.insertId;
                    console.log(`💾 Saved new Google user '${normalizedEmail}' to MySQL database (ID: ${dbUserId})`);
                } catch (dbErr) {
                    console.error('MySQL insert Google user error:', dbErr.message);
                }
            }

            user = {
                id: dbUserId ? `usr_${dbUserId}` : 'usr_g_' + Date.now(),
                dbId: dbUserId,
                email: normalizedEmail,
                name: displayName,
                avatar: avatar || displayName.charAt(0).toUpperCase(),
                photoUrl: photoUrl || null,
                authProvider: 'google',
                xp: 0,
                streak: 1,
                todayStudyMinutes: 0,
                createdAt: new Date().toISOString()
            };

            users.push(user);
            saveUsers();

            // Send Nodemailer Welcome Email for new Google user
            sendWelcomeEmail(normalizedEmail, displayName);
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        const userResponse = { ...user };
        delete userResponse.password;

        res.json({
            message: isNewUser ? 'Google account created' : 'Signed in with Google',
            token,
            user: userResponse
        });
    } catch (err) {
        res.status(500).json({ error: 'Google Auth failed: ' + err.message });
    }
});

// Helper to calculate XP based on study time:
// - 1 to 4 mins = 1 XP per minute
// - Every 5 mins = 5 XP
// - 30 mins milestone = 20 XP
// - 1 hour (60 mins) milestone = 50 XP
function calculateRoomTimeXP(minutes) {
    const mins = Math.max(0, parseInt(minutes || 0, 10));
    if (mins <= 0) return 0;

    const fullHours = Math.floor(mins / 60);
    const remMins = mins % 60;

    let xp = fullHours * 50;

    if (remMins >= 30) {
        xp += 20;
        const remAfter30 = remMins - 30;
        xp += Math.floor(remAfter30 / 5) * 5;
    } else {
        xp += Math.floor(remMins / 5) * 5;
    }

    const leftoverMins = remMins % 5;
    if (leftoverMins > 0 && remMins < 30) {
        xp += leftoverMins * 1;
    }

    return Math.max(1, xp);
}

function calculateUserLevel(totalXp) {
    const xp = Math.max(0, parseInt(totalXp || 0, 10));
    const levelNumber = Math.floor(xp / 100) + 1;
    let title = "Novice Scholar";

    if (levelNumber >= 10) title = "Grand Master";
    else if (levelNumber >= 7) title = "Focus Master";
    else if (levelNumber >= 5) title = "Expert Scholar";
    else if (levelNumber >= 3) title = "Dedicated Learner";
    else if (levelNumber >= 2) title = "Rising Scholar";

    return {
        level: levelNumber,
        title: title,
        xpForNextLevel: levelNumber * 100,
        currentLevelXp: xp % 100
    };
}

// 4. Record Completed Study Session (Updates XP & Streak in DB)
app.post('/api/user/complete-session', async (req, res) => {
    try {
        const { email, subject, durationMinutes, currentXp } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'User email is required.' });
        }

        const minutes = parseInt(durationMinutes || 25, 10);
        const xpEarned = calculateRoomTimeXP(minutes);
        const normalizedEmail = email.toLowerCase().trim();

        let user = users.find(u => u.email === normalizedEmail);
        let updatedXp = parseInt(currentXp || 0, 10);
        let updatedStreak = 1;

        if (isDbConnected && dbPool) {
            try {
                const [rows] = await dbPool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
                if (rows.length > 0) {
                    const uRow = rows[0];
                    const clientXp = parseInt(currentXp || 0, 10);
                    const newXp = Math.max((uRow.xp || 0) + xpEarned, clientXp);
                    const newStreak = Math.max(1, uRow.current_streak || 1);

                    await dbPool.query('UPDATE users SET xp = ?, current_streak = ? WHERE id = ?', [newXp, newStreak, uRow.id]);
                    await dbPool.query(
                        'INSERT INTO study_sessions (user_id, subject, duration_minutes, session_type) VALUES (?, ?, ?, ?)',
                        [uRow.id, subject || 'Pomodoro Focus', minutes, 'pomodoro']
                    );

                    updatedXp = newXp;
                    updatedStreak = newStreak;
                    console.log(`💾 Session logged in DB for ${normalizedEmail}: ${minutes}m -> +${xpEarned} XP (Total: ${newXp} XP)`);
                }
            } catch (dbErr) {
                console.error('MySQL complete session error:', dbErr.message);
            }
        }

        if (user) {
            user.xp = (user.xp || 0) + xpEarned;
            user.streak = Math.max(1, user.streak || 1);
            user.todayStudyMinutes = (user.todayStudyMinutes || 0) + minutes;
            saveUsers();
            updatedXp = user.xp;
            updatedStreak = user.streak;
        } else if (!isDbConnected) {
            updatedXp = Math.max(xpEarned, updatedXp);
        }

        const levelInfo = calculateUserLevel(updatedXp);

        res.json({
            message: `Session completed! +${xpEarned} XP Earned! 🎉`,
            xpEarned,
            totalXp: updatedXp,
            streak: updatedStreak,
            levelInfo
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to record session: ' + err.message });
    }
});

// 5. Rooms API (Fetch & Create Study Rooms in DB with Exact Unix Sync)
let inMemoryRooms = [];
const roomStartTimesMap = new Map();

app.get('/api/rooms', async (req, res) => {
    try {
        await cleanupEmptyRooms();
        let dbRooms = [];
        if (isDbConnected && dbPool) {
            try {
                const [rows] = await dbPool.query('SELECT * FROM study_rooms ORDER BY id DESC');
                dbRooms = rows.map(r => {
                    const roomCode = r.room_code;
                    let startTimeMs = roomStartTimesMap.get(roomCode);
                    if (!startTimeMs) {
                        startTimeMs = new Date(r.created_at).getTime();
                        roomStartTimesMap.set(roomCode, startTimeMs);
                    }

                    const elapsedSec = Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000));
                    const totalSec = (r.timer_minutes || 25) * 60;
                    const remainingSec = Math.max(0, totalSec - elapsedSec);

                    const participants = roomParticipantsMap.get(roomCode) || [];

                    return {
                        id: `room_${r.id}`,
                        code: r.room_code,
                        name: r.name,
                        type: r.room_type,
                        topic: r.topic,
                        timerMinutes: r.timer_minutes || 25,
                        secondsRemaining: remainingSec,
                        createdAt: r.created_at,
                        members: participants
                    };
                });
            } catch (dbErr) {
                console.error('MySQL rooms query error:', dbErr.message);
            }
        }

        const combined = [...dbRooms];
        inMemoryRooms.forEach(im => {
            if (!combined.some(c => c.code === im.code)) {
                const startTimeMs = roomStartTimesMap.get(im.code) || new Date(im.createdAt).getTime();
                const elapsedSec = Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000));
                const totalSec = (im.timerMinutes || 25) * 60;
                const remainingSec = Math.max(0, totalSec - elapsedSec);
                const participants = roomParticipantsMap.get(im.code) || [];

                combined.push({
                    ...im,
                    secondsRemaining: remainingSec,
                    members: participants
                });
            }
        });

        res.json({ rooms: combined });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch rooms: ' + err.message });
    }
});

app.post('/api/rooms/create', async (req, res) => {
    try {
        const { name, topic, type, timerMinutes } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Room name is required.' });
        }

        const roomType = type === 'private' ? 'private' : 'public';
        const minutes = parseInt(timerMinutes || 25, 10);
        const roomCode = roomType === 'private'
            ? `BLM-${Math.floor(1000 + Math.random() * 9000)}`
            : `PUB-${Math.floor(100 + Math.random() * 900)}`;
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();

        roomStartTimesMap.set(roomCode, nowMs);

        let dbRoomId = null;
        if (isDbConnected && dbPool) {
            try {
                const [result] = await dbPool.query(
                    'INSERT INTO study_rooms (room_code, name, room_type, topic, timer_minutes) VALUES (?, ?, ?, ?, ?)',
                    [roomCode, name, roomType, topic || 'General Focus', minutes]
                );
                dbRoomId = result.insertId;
                console.log(`💾 Created study room '${name}' (${minutes}m) in MySQL (Code: ${roomCode})`);
            } catch (dbErr) {
                console.error('MySQL create room error:', dbErr.message);
            }
        }

        const newRoom = {
            id: dbRoomId ? `room_${dbRoomId}` : `room_${Date.now()}`,
            code: roomCode,
            name: name,
            type: roomType,
            topic: topic || 'General Focus',
            timerMinutes: minutes,
            secondsRemaining: minutes * 60,
            createdAt: nowIso,
            members: []
        };

        inMemoryRooms.unshift(newRoom);

        res.json({ message: 'Study room created! 🎉', room: newRoom });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create room: ' + err.message });
    }
});

// 6. Room Members & Host Reassignment API
const roomParticipantsMap = new Map();

app.post('/api/rooms/join', (req, res) => {
    try {
        const { roomCode, userEmail, userName, userAvatar } = req.body;
        if (!roomCode || !userName) {
            return res.status(400).json({ error: 'Room code and user name are required.' });
        }

        let participants = roomParticipantsMap.get(roomCode) || [];
        const isHost = participants.length === 0;

        const existingIdx = participants.findIndex(p => (userEmail && p.email === userEmail) || p.name === userName);
        if (existingIdx >= 0) {
            participants[existingIdx].avatar = userAvatar || participants[existingIdx].avatar;
        } else {
            participants.push({
                name: userName,
                email: userEmail || userName,
                avatar: userAvatar || userName.charAt(0).toUpperCase(),
                isHost: isHost,
                status: isHost ? 'Host' : 'Focusing',
                joinedAt: Date.now()
            });
        }

        roomParticipantsMap.set(roomCode, participants);
        emptyRoomsSinceMap.delete(roomCode); // Room is active, cancel disband timer

        const hostParticipant = participants.find(p => p.isHost) || participants[0];
        res.json({ participants, currentHost: hostParticipant });
    } catch (err) {
        res.status(500).json({ error: 'Failed to join room: ' + err.message });
    }
});

app.post('/api/rooms/leave', (req, res) => {
    try {
        const { roomCode, userEmail, userName } = req.body;
        if (!roomCode) {
            return res.status(400).json({ error: 'Room code is required.' });
        }

        let participants = roomParticipantsMap.get(roomCode) || [];
        const leavingIdx = participants.findIndex(p => (userEmail && p.email === userEmail) || p.name === userName);

        if (leavingIdx >= 0) {
            const wasHost = participants[leavingIdx].isHost;
            participants.splice(leavingIdx, 1);

            // Host left! Reassign host to the first person who joined after the host
            if (wasHost && participants.length > 0) {
                participants[0].isHost = true;
                participants[0].status = 'Host';
                console.log(`👑 Host left! Reassigned host of room '${roomCode}' to '${participants[0].name}'`);
            }
        }

        roomParticipantsMap.set(roomCode, participants);

        if (participants.length === 0) {
            if (!emptyRoomsSinceMap.has(roomCode)) {
                emptyRoomsSinceMap.set(roomCode, Date.now());
                console.log(`⏳ Room '${roomCode}' is now empty. Starting 1-minute disband timer...`);
            }
        }

        const hostParticipant = participants.find(p => p.isHost) || (participants.length > 0 ? participants[0] : null);
        res.json({ message: 'Left room', participants, currentHost: hostParticipant });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process room departure: ' + err.message });
    }
});

app.get('/api/rooms/:code/members', (req, res) => {
    try {
        const roomCode = req.params.code;
        const participants = roomParticipantsMap.get(roomCode) || [];
        const hostParticipant = participants.find(p => p.isHost) || (participants.length > 0 ? participants[0] : null);
        res.json({ participants, currentHost: hostParticipant });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch members: ' + err.message });
    }
});

// 7. Automatic Empty Room Disband & Database Deletion (24 Hour Inactivity Cleanup)
const emptyRoomsSinceMap = new Map(); // roomCode -> timestampMs

async function cleanupEmptyRooms() {
    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000; // Keep rooms in DB for 24 hours

    for (const [code, emptySinceMs] of emptyRoomsSinceMap.entries()) {
        const participants = roomParticipantsMap.get(code) || [];
        if (participants.length > 0) {
            emptyRoomsSinceMap.delete(code);
            continue;
        }

        if (now - emptySinceMs >= TWENTY_FOUR_HOURS_MS) {
            console.log(`🗑️ Disbanding inactive study room '${code}' (empty for 24h)...`);

            if (isDbConnected && dbPool) {
                try {
                    await dbPool.query('DELETE FROM study_rooms WHERE room_code = ?', [code]);
                    console.log(`💾 Deleted room '${code}' from MySQL study_rooms table.`);
                } catch (dbErr) {
                    console.error(`MySQL delete empty room error for '${code}':`, dbErr.message);
                }
            }

            inMemoryRooms = inMemoryRooms.filter(r => r.code !== code);
            roomStartTimesMap.delete(code);
            roomParticipantsMap.delete(code);
            emptyRoomsSinceMap.delete(code);
        }
    }
}

setInterval(cleanupEmptyRooms, 10000);

// 8. Flashcard Decks & Cards API (MySQL Persistence)
app.get('/api/decks', async (req, res) => {
    try {
        const { email } = req.query;
        let decksList = [];

        if (isDbConnected && dbPool && email) {
            try {
                const [uRows] = await dbPool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
                if (uRows.length > 0) {
                    const userId = uRows[0].id;
                    const [dRows] = await dbPool.query('SELECT * FROM flashcard_decks WHERE user_id = ? ORDER BY id DESC', [userId]);

                    for (const d of dRows) {
                        const [cRows] = await dbPool.query('SELECT * FROM flashcards WHERE deck_id = ? ORDER BY id ASC', [d.id]);
                        const deckShareCode = d.share_code || `DEC-${d.id}`;
                        decksList.push({
                            id: `deck_${d.id}`,
                            dbId: d.id,
                            shareCode: deckShareCode,
                            title: d.title,
                            subject: d.category || 'General',
                            description: d.description || '',
                            cards: cRows.map(c => ({
                                id: `card_${c.id}`,
                                dbId: c.id,
                                front: c.front,
                                back: c.back,
                                mastered: !!c.is_mastered
                            }))
                        });
                    }
                }
            } catch (dbErr) {
                console.error('MySQL fetch decks error:', dbErr.message);
            }
        }

        res.json({ decks: decksList });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch decks: ' + err.message });
    }
});

app.post('/api/decks/create', async (req, res) => {
    try {
        const { email, title, subject, description } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Deck title is required.' });
        }

        let dbDeckId = null;
        const generatedShareCode = `DEC-${Math.floor(100000 + Math.random() * 900000)}`;

        if (isDbConnected && dbPool && email) {
            try {
                const [uRows] = await dbPool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
                if (uRows.length > 0) {
                    const userId = uRows[0].id;
                    const [result] = await dbPool.query(
                        'INSERT INTO flashcard_decks (user_id, title, category, description, share_code) VALUES (?, ?, ?, ?, ?)',
                        [userId, title, subject || 'General', description || '', generatedShareCode]
                    );
                    dbDeckId = result.insertId;
                    console.log(`💾 Created private flashcard deck '${title}' in MySQL (ID: ${dbDeckId}, ShareCode: ${generatedShareCode})`);
                }
            } catch (dbErr) {
                console.error('MySQL create deck error:', dbErr.message);
            }
        }

        const newDeck = {
            id: dbDeckId ? `deck_${dbDeckId}` : `deck_${Date.now()}`,
            dbId: dbDeckId,
            shareCode: generatedShareCode,
            title: title,
            subject: subject || 'General',
            description: description || '',
            cards: []
        };

        res.json({ message: 'Private Deck created! 🎴', deck: newDeck });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create deck: ' + err.message });
    }
});

// Import Shared Deck via Deck ID Code API
app.get('/api/decks/import/:code', async (req, res) => {
    try {
        const rawCode = req.params.code ? req.params.code.trim().toUpperCase() : '';
        if (!rawCode) {
            return res.status(400).json({ error: 'Deck ID Code is required.' });
        }

        if (isDbConnected && dbPool) {
            const numericId = parseInt(rawCode.replace('DEC-', ''), 10);
            const [dRows] = await dbPool.query(
                'SELECT * FROM flashcard_decks WHERE share_code = ? OR id = ?',
                [rawCode, isNaN(numericId) ? -1 : numericId]
            );

            if (dRows.length > 0) {
                const d = dRows[0];
                const [cRows] = await dbPool.query('SELECT * FROM flashcards WHERE deck_id = ? ORDER BY id ASC', [d.id]);
                const importedDeck = {
                    id: `deck_imported_${d.id}_${Date.now()}`,
                    dbId: d.id,
                    shareCode: d.share_code || `DEC-${d.id}`,
                    title: d.title,
                    subject: d.category || 'General',
                    description: d.description || '',
                    cards: cRows.map(c => ({
                        id: `card_${c.id}`,
                        dbId: c.id,
                        front: c.front,
                        back: c.back,
                        mastered: false
                    }))
                };
                return res.json({ message: 'Deck found successfully!', deck: importedDeck });
            }
        }

        res.status(404).json({ error: 'No private deck found with this Deck ID Code.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to import deck: ' + err.message });
    }
});

app.post('/api/decks/add-card', async (req, res) => {
    try {
        const { deckId, front, back } = req.body;
        if (!front || !back) {
            return res.status(400).json({ error: 'Card front and back are required.' });
        }

        let dbCardId = null;
        const numericDeckId = deckId && typeof deckId === 'string' && deckId.startsWith('deck_')
            ? parseInt(deckId.replace('deck_', ''), 10)
            : parseInt(deckId, 10);

        if (isDbConnected && dbPool && !isNaN(numericDeckId)) {
            try {
                const [result] = await dbPool.query(
                    'INSERT INTO flashcards (deck_id, front, back) VALUES (?, ?, ?)',
                    [numericDeckId, front, back]
                );
                dbCardId = result.insertId;
                console.log(`💾 Added card to deck ID ${numericDeckId} in MySQL (Card ID: ${dbCardId})`);
            } catch (dbErr) {
                console.error('MySQL add card error:', dbErr.message);
            }
        }

        const newCard = {
            id: dbCardId ? `card_${dbCardId}` : `card_${Date.now()}`,
            dbId: dbCardId,
            front: front,
            back: back,
            mastered: false
        };

        res.json({ message: 'Card added! 📝', card: newCard });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add card: ' + err.message });
    }
});

app.delete('/api/decks/:id', async (req, res) => {
    try {
        const deckId = parseInt(req.params.id, 10);
        if (isDbConnected && dbPool && !isNaN(deckId)) {
            try {
                await dbPool.query('DELETE FROM flashcard_decks WHERE id = ?', [deckId]);
                console.log(`💾 Deleted flashcard deck ID ${deckId} from MySQL.`);
            } catch (dbErr) {
                console.error('MySQL delete deck error:', dbErr.message);
            }
        }
        res.json({ message: 'Deck deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete deck: ' + err.message });
    }
});

app.post('/api/decks/card-mastered', async (req, res) => {
    try {
        const { cardId, isMastered } = req.body;
        const numericCardId = cardId && typeof cardId === 'string' && cardId.startsWith('card_')
            ? parseInt(cardId.replace('card_', ''), 10)
            : parseInt(cardId, 10);

        if (isDbConnected && dbPool && !isNaN(numericCardId)) {
            try {
                await dbPool.query(
                    'UPDATE flashcards SET is_mastered = ? WHERE id = ?',
                    [isMastered ? 1 : 0, numericCardId]
                );
                console.log(`💾 Updated card ID ${numericCardId} mastered status to ${isMastered} in MySQL.`);
            } catch (dbErr) {
                console.error('MySQL update card mastered error:', dbErr.message);
            }
        }

        res.json({ message: 'Card mastery status updated.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update card mastery: ' + err.message });
    }
});

// 9. Edit Profile API (MySQL & Memory Sync)
app.post('/api/user/update-profile', async (req, res) => {
    try {
        const { email, name, photoUrl } = req.body;
        if (!email || !name) {
            return res.status(400).json({ error: 'Email and name are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const cleanName = name.trim();
        const photo = photoUrl && typeof photoUrl === 'string' && photoUrl.trim() ? photoUrl.trim() : null;

        // Update in-memory user record
        const user = users.find(u => u.email === normalizedEmail);
        if (user) {
            user.name = cleanName;
            user.avatar = cleanName.charAt(0).toUpperCase();
            user.photoUrl = photo;
            saveUsers();
        }

        // Update in MySQL database
        if (isDbConnected && dbPool) {
            try {
                await dbPool.query(
                    'UPDATE users SET username = ?, avatar_url = ? WHERE email = ?',
                    [cleanName, photo || cleanName.charAt(0).toUpperCase(), normalizedEmail]
                );
                console.log(`💾 Updated profile for user '${normalizedEmail}' in MySQL: name = '${cleanName}'`);
            } catch (dbErr) {
                console.error('MySQL update profile error:', dbErr.message);
            }
        }

        res.json({
            message: 'Profile updated successfully! ✨',
            user: {
                name: cleanName,
                avatar: cleanName.charAt(0).toUpperCase(),
                photoUrl: photo
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile: ' + err.message });
    }
});

// Serve frontend SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n[SERVER] Bloom Authentication & Backend Server listening on http://localhost:${PORT}`);
    console.log(`[MAIL] Nodemailer Email Service Initialized\n`);
});
