-- Bloom Database Schema Initial Version

CREATE DATABASE IF NOT EXISTS bloom_db;
USE bloom_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    xp INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Study Sessions Table
CREATE TABLE IF NOT EXISTS study_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject VARCHAR(100) DEFAULT 'General Focus',
    duration_minutes INT NOT NULL,
    session_type ENUM('pomodoro', 'short_break', 'long_break', 'custom') DEFAULT 'pomodoro',
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_sessions (user_id, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Study Goals Table
CREATE TABLE IF NOT EXISTS study_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    daily_target_minutes INT DEFAULT 120,
    current_streak INT DEFAULT 0,
    best_streak INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Flashcard Decks Table
CREATE TABLE IF NOT EXISTS flashcard_decks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    category VARCHAR(50) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_decks (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Flashcards Table
CREATE TABLE IF NOT EXISTS flashcards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deck_id INT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    is_mastered TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    INDEX idx_deck_cards (deck_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Daily Stats Table
CREATE TABLE IF NOT EXISTS daily_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stat_date DATE NOT NULL,
    total_minutes INT DEFAULT 0,
    xp_gained INT DEFAULT 0,
    cards_reviewed INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_date (user_id, stat_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_stats (user_id, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Email OTP Verification Table
CREATE TABLE IF NOT EXISTS otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    user_name VARCHAR(50) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_otp (email, otp_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Study Rooms Table
CREATE TABLE IF NOT EXISTS study_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    room_type ENUM('public', 'private') DEFAULT 'public',
    topic VARCHAR(255) DEFAULT 'General Focus',
    timer_minutes INT DEFAULT 25,
    host_user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


