/**
 * Bloom App Logic & Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    // 0. Initialize Loading Screen
    initLoadingScreen();

    // 1. Initialize Theme & Auth UI
    initTheme();
    updateAuthUI();
    checkAndUpdateDailyStreak();

    // 2. Initialize Router
    AppRouter.init();

    // 3. Render Initial Screen Views
    renderHomeScreen();
    renderFocusScreen();
    renderRoomsScreen();
    renderFlashcardsScreen();
    renderProgressScreen();
    renderProfileScreen();

    // 4. Attach Navigation, Room & Auth Handlers
    attachEventHandlers();
    attachRoomModalHandlers();
    attachFlashcardModalHandlers();
    attachAuthHandlers();
});

/* Loading Screen Controller */
function initLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;

    let isHidden = false;
    const hideLoading = () => {
        if (isHidden) return;
        isHidden = true;
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            if (loadingScreen && loadingScreen.parentNode) {
                loadingScreen.parentNode.removeChild(loadingScreen);
            }
            checkAuthGuard();
        }, 500);
    };

    // Guarantee loading screen fades out cleanly within 1.2s
    setTimeout(hideLoading, 1200);
    if (document.readyState === 'complete') {
        setTimeout(hideLoading, 600);
    } else {
        window.addEventListener('load', hideLoading, { once: true });
    }
}

/* Daily Login Streak Controller (+1 Streak Every New Calendar Day) */
function checkAndUpdateDailyStreak() {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastLogin = AppState.user.lastLoginDate || localStorage.getItem('bloom_last_login_date');

    if (!lastLogin) {
        AppState.user.lastLoginDate = todayStr;
        AppState.user.streak = Math.max(1, AppState.user.streak || 1);
        localStorage.setItem('bloom_last_login_date', todayStr);
        try {
            localStorage.setItem('bloom_auth_user', JSON.stringify(AppState.user));
        } catch (e) {}
        return;
    }

    if (lastLogin === todayStr) {
        // Already logged in today!
        return;
    }

    const lastDate = new Date(lastLogin);
    const currentDate = new Date(todayStr);
    const diffTime = Math.abs(currentDate - lastDate);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        // Consecutive calendar day! +1 Streak!
        AppState.user.streak = (AppState.user.streak || 0) + 1;
        AppState.user.lastLoginDate = todayStr;
        localStorage.setItem('bloom_last_login_date', todayStr);
        try {
            localStorage.setItem('bloom_auth_user', JSON.stringify(AppState.user));
        } catch (e) {}

        setTimeout(() => {
            showXpToastNotification(`<i class="fi fi-sr-flame" style="color: #E76F51; margin-right: 4px;"></i> Daily Streak Bonus! You logged in today (+1 Streak)! Current Streak: ${AppState.user.streak} Days`);
        }, 1200);
    } else if (diffDays > 1) {
        // Missed a day! Reset streak to 1
        AppState.user.streak = 1;
        AppState.user.lastLoginDate = todayStr;
        localStorage.setItem('bloom_last_login_date', todayStr);
        try {
            localStorage.setItem('bloom_auth_user', JSON.stringify(AppState.user));
        } catch (e) {}

        setTimeout(() => {
            showXpToastNotification(`Welcome back! Daily streak reset to 1 Day. Keep up daily study logins!`);
        }, 1200);
    }
}
function initTheme() {
    const savedTheme = AppState.user.theme;
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme(isDark) {
    const theme = isDark ? 'dark' : 'light';
    AppState.user.theme = theme;
    localStorage.setItem('bloom_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
}

function updateAvatarElement(element, user) {
    if (!element || !user) return;
    element.style.overflow = 'hidden';
    element.style.display = 'inline-flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';

    const photo = user.photoUrl || (user.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://') || user.avatar.startsWith('data:image')) ? user.avatar : null);

    if (photo) {
        element.innerHTML = `<img src="${escapeHtml(photo)}" alt="${escapeHtml(user.name || 'User')}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" onerror="this.onerror=null; this.outerHTML='<span style=\\'font-weight: 700; font-size: 1.1rem;\\'>${escapeHtml(user.avatar && user.avatar.length <= 2 ? user.avatar : (user.name ? user.name.charAt(0).toUpperCase() : 'U'))}</span>';">`;
    } else {
        const letter = user.avatar && user.avatar.length <= 2 ? user.avatar : (user.name ? user.name.charAt(0).toUpperCase() : 'U');
        element.textContent = letter;
    }
}

function renderHomeScreen() {
    const { greeting, name, avatar, todayStudyMinutes, dailyGoalMinutes, xp, streak } = AppState.user;
    const levelInfo = calculateUserLevel(xp || 0);

    // Greeting & Avatar Stats
    const avatarEl = document.getElementById('home-user-avatar');
    updateAvatarElement(avatarEl, AppState.user);

    const levelHeaderEl = document.getElementById('home-user-level');
    if (levelHeaderEl) levelHeaderEl.textContent = `Level ${levelInfo.level} · ${levelInfo.title}`;

    const greetingEl = document.getElementById('home-greeting');
    if (greetingEl) greetingEl.textContent = `${greeting}, ${name}`;

    const studyTimeEl = document.getElementById('home-study-time');
    if (studyTimeEl) {
        const totalSecs = AppState.user.todayStudySeconds || ((AppState.user.todayStudyMinutes || 0) * 60);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        if (hours > 0) {
            studyTimeEl.textContent = `${hours}h ${mins}m`;
        } else if (mins > 0) {
            studyTimeEl.textContent = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        } else {
            studyTimeEl.textContent = `${secs}s`;
        }
    }

    const totalSecs = AppState.user.todayStudySeconds || ((AppState.user.todayStudyMinutes || 0) * 60);
    const goalTargetSecs = (dailyGoalMinutes || 25) * 60;
    const goalPercent = Math.min(100, Math.round((totalSecs / goalTargetSecs) * 100));
    const goalEl = document.getElementById('home-goal-percent');
    if (goalEl) goalEl.textContent = `${goalPercent}%`;

    const goalBarEl = document.getElementById('home-goal-bar');
    if (goalBarEl) goalBarEl.style.width = `${goalPercent}%`;

    const xpEl = document.getElementById('home-xp');
    if (xpEl) xpEl.textContent = `${(xp || 0).toLocaleString()} XP`;

    const streakEl = document.getElementById('home-streak');
    if (streakEl) streakEl.textContent = `${streak || 1} Day${(streak || 1) === 1 ? '' : 's'}`;

    const streakValEl = document.getElementById('home-streak-val');
    if (streakValEl) streakValEl.textContent = `${streak || 1} Day${(streak || 1) === 1 ? '' : 's'}`;

    // Recent Sessions
    const sessionsContainer = document.getElementById('home-recent-sessions');
    if (sessionsContainer) {
        if (AppState.recentSessions.length === 0) {
            sessionsContainer.innerHTML = `
                <div class="empty-sessions-state" style="text-align: center; padding: 24px 16px; background: var(--surface-card); border-radius: 12px; border: 1px dashed var(--border);">
                    <i class="fi fi-rr-time-past" style="font-size: 2rem; margin-bottom: 6px; color: var(--primary-600); display: block;"></i>
                    <div style="font-weight: 600; font-size: 0.92rem; color: var(--text-primary); margin-bottom: 4px;">No study sessions logged yet</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Complete a focus timer session to earn XP and build your streak!</div>
                </div>
            `;
        } else {
            sessionsContainer.innerHTML = AppState.recentSessions.map(session => `
                <div class="session-item">
                    <div class="session-info">
                        <span class="session-subject">${escapeHtml(session.subject)}</span>
                        <span class="session-time">${escapeHtml(session.time)}</span>
                    </div>
                    <span class="session-duration">${escapeHtml(session.duration)}</span>
                </div>
            `).join('');
        }
    }

    // Daily Goal Card Click Listener
    const goalCard = document.getElementById('home-daily-goal-card');
    if (goalCard) {
        goalCard.onclick = openGoalStatsModal;
    }

    const exportBtn = document.getElementById('btn-export-strava-stats');
    if (exportBtn) exportBtn.onclick = exportLearnerStatsImage;

    const closeBtn1 = document.getElementById('modal-close-goal-stats-btn');
    const closeBtn2 = document.getElementById('btn-close-goal-stats-modal');
    if (closeBtn1) closeBtn1.onclick = closeGoalStatsModal;
    if (closeBtn2) closeBtn2.onclick = closeGoalStatsModal;
}

function exportLearnerStatsImage() {
    const user = AppState.user;
    const totalSecs = user.todayStudySeconds || ((user.todayStudyMinutes || 0) * 60);
    const targetGoalMins = user.dailyGoalMinutes || 25;
    const targetSecs = targetGoalMins * 60;
    const percent = Math.min(100, Math.round((totalSecs / targetSecs) * 100));

    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    let timeStr = '0s';
    if (hours > 0) timeStr = `${hours}h ${mins}m`;
    else if (mins > 0) timeStr = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    else timeStr = `${secs}s`;

    const levelInfo = calculateUserLevel(user.xp || 0);

    const nameEl = document.getElementById('strava-export-name');
    const rankEl = document.getElementById('strava-export-rank');
    const timeEl = document.getElementById('strava-export-time');
    const goalPctEl = document.getElementById('strava-export-goal-pct');
    const streakEl = document.getElementById('strava-export-streak');

    if (nameEl) nameEl.textContent = user.name || 'Scholar';
    if (rankEl) rankEl.textContent = `Level ${levelInfo.level} · ${levelInfo.title}`;
    if (timeEl) timeEl.textContent = timeStr;
    if (goalPctEl) goalPctEl.textContent = `${percent}%`;
    if (streakEl) streakEl.textContent = `${user.streak || 1} Day${(user.streak || 1) === 1 ? '' : 's'}`;

    const exportContainer = document.getElementById('strava-export-container');
    if (!exportContainer) return;

    // Temporarily bring container into visible render tree for canvas capture
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '50%';
    exportContainer.style.top = '50%';
    exportContainer.style.transform = 'translate(-50%, -50%)';
    exportContainer.style.zIndex = '9999999';

    if (typeof html2canvas === 'undefined') {
        alert("Image generator library is loading. Please try again in a moment.");
        exportContainer.style.position = 'absolute';
        exportContainer.style.left = '-9999px';
        exportContainer.style.top = '-9999px';
        return;
    }

    html2canvas(exportContainer, {
        backgroundColor: null, // Pure transparent background for Instagram stories!
        scale: 2,
        useCORS: true
    }).then(canvas => {
        exportContainer.style.position = 'absolute';
        exportContainer.style.left = '-9999px';
        exportContainer.style.top = '-9999px';

        const fileName = `Bloom-Learner-Stats-${(user.name || 'Scholar').replace(/\s+/g, '_')}.png`;
        const dataUrl = canvas.toDataURL("image/png");

        const triggerDownload = () => {
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();
            showXpToastNotification(`<i class="fi fi-rr-check" style="margin-right: 6px;"></i> Image downloaded! (Check your Files app Downloads folder)`);
        };

        if (canvas.toBlob && navigator.canShare) {
            canvas.toBlob(blob => {
                if (!blob) {
                    triggerDownload();
                    return;
                }
                const file = new File([blob], fileName, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    navigator.share({
                        files: [file],
                        title: 'Bloom Learner Stats',
                        text: 'Check out my study stats on Bloom!'
                    }).then(() => {
                        showXpToastNotification(`<i class="fi fi-rr-check" style="margin-right: 6px;"></i> Image saved!`);
                    }).catch(err => {
                        if (err.name !== 'AbortError') triggerDownload();
                    });
                } else {
                    triggerDownload();
                }
            }, 'image/png');
        } else {
            triggerDownload();
        }
    }).catch(err => {
        console.error("Export error:", err);
        exportContainer.style.position = 'absolute';
        exportContainer.style.left = '-9999px';
        exportContainer.style.top = '-9999px';
        showXpToastNotification(`Failed to generate PNG image.`);
    });
}

function openGoalStatsModal() {
    const totalSecs = AppState.user.todayStudySeconds || ((AppState.user.todayStudyMinutes || 0) * 60);
    const targetGoalMins = AppState.user.dailyGoalMinutes || 25;
    const targetSecs = targetGoalMins * 60;
    const percent = Math.min(100, Math.round((totalSecs / targetSecs) * 100));

    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    let timeStr = '0s';
    if (hours > 0) timeStr = `${hours}h ${mins}m`;
    else if (mins > 0) timeStr = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    else timeStr = `${secs}s`;

    const levelInfo = calculateUserLevel(AppState.user.xp || 0);

    const studyTimeEl = document.getElementById('goal-modal-study-time');
    const targetEl = document.getElementById('goal-modal-target');
    const percentEl = document.getElementById('goal-modal-percent');
    const statusEl = document.getElementById('goal-modal-status');
    const xpEl = document.getElementById('goal-modal-xp');
    const rankEl = document.getElementById('goal-modal-rank');
    const streakEl = document.getElementById('goal-modal-streak');
    const bonusBadgeEl = document.getElementById('goal-modal-bonus-badge');
    const bonusDescEl = document.getElementById('goal-modal-bonus-desc');

    const progressBarFill = document.getElementById('goal-modal-progress-bar');
    const barPercentEl = document.getElementById('goal-modal-bar-percent');
    const barStudyLabel = document.getElementById('goal-modal-bar-study-label');
    const barTargetLabel = document.getElementById('goal-modal-bar-target-label');

    if (progressBarFill) progressBarFill.style.width = `${percent}%`;
    if (barPercentEl) barPercentEl.textContent = `${percent}%`;
    if (barStudyLabel) barStudyLabel.textContent = `${timeStr} studied`;
    if (barTargetLabel) barTargetLabel.textContent = `Target: ${targetGoalMins}m`;

    if (studyTimeEl) studyTimeEl.textContent = timeStr;
    if (targetEl) targetEl.textContent = `Target: ${targetGoalMins}m`;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (statusEl) statusEl.textContent = percent >= 100 ? 'Completed!' : 'In Progress';
    if (xpEl) xpEl.textContent = `${(AppState.user.xp || 0).toLocaleString()} XP`;
    if (rankEl) rankEl.textContent = `Level ${levelInfo.level} · ${levelInfo.title}`;
    if (streakEl) streakEl.textContent = `${AppState.user.streak || 1} Day${(AppState.user.streak || 1) === 1 ? '' : 's'}`;

    const todayStr = new Date().toISOString().split('T')[0];
    const isBonusClaimed = AppState.user.lastGoalBonusDate === todayStr;

    if (isBonusClaimed) {
        if (bonusBadgeEl) {
            bonusBadgeEl.className = 'chip chip-success';
            bonusBadgeEl.textContent = 'Claimed (+100 XP)';
        }
        if (bonusDescEl) bonusDescEl.textContent = 'Awesome job! You reached today\'s study goal!';
    } else {
        const remSecs = Math.max(0, targetSecs - totalSecs);
        const remMins = Math.ceil(remSecs / 60);
        if (bonusBadgeEl) {
            bonusBadgeEl.className = 'chip';
            bonusBadgeEl.textContent = percent >= 100 ? 'Unlocked' : 'Locked';
        }
        if (bonusDescEl) {
            bonusDescEl.textContent = percent >= 100 ? '+100 XP Bonus unlocked for today!' : `Study ${remMins} more mins to claim +100 XP Bonus!`;
        }
    }

    const modal = document.getElementById('modal-study-goal-stats');
    if (modal) modal.style.display = 'flex';
}

function closeGoalStatsModal() {
    const modal = document.getElementById('modal-study-goal-stats');
    if (modal) modal.style.display = 'none';
}

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

async function recordCompletedStudySession(durationInput, subjectName = 'General Focus', logToRecentHistory = true) {
    let seconds = 0;
    if (typeof durationInput === 'number') {
        seconds = Math.max(1, Math.round(durationInput));
    } else {
        seconds = Math.max(1, Math.round(parseFloat(durationInput || 0) * 60));
    }

    if (seconds <= 0) return;

    const oldLevel = calculateUserLevel(AppState.user.xp || 0).level;
    const todayStr = new Date().toISOString().split('T')[0];

    // Reset daily counter if calendar day changed
    if (AppState.user.lastStudyDate !== todayStr) {
        AppState.user.todayStudySeconds = 0;
        AppState.user.todayStudyMinutes = 0;
        AppState.user.lastStudyDate = todayStr;
    }

    // Accumulate study seconds for today
    AppState.user.todayStudySeconds = (AppState.user.todayStudySeconds || 0) + seconds;
    AppState.user.todayStudyMinutes = Math.floor(AppState.user.todayStudySeconds / 60);

    const minutesForXp = Math.max(1, Math.ceil(seconds / 60));
    const xpEarned = calculateRoomTimeXP(minutesForXp);

    AppState.user.xp = (AppState.user.xp || 0) + xpEarned;
    AppState.user.streak = Math.max(1, AppState.user.streak || 1);

    // Save updated state to localStorage immediately
    try {
        localStorage.setItem('bloom_auth_user', JSON.stringify(AppState.user));
    } catch (e) {}

    // Check Daily Goal Completion Bonus (+100 XP Awarded Once Per Day)
    const targetGoalSecs = (AppState.user.dailyGoalMinutes || 25) * 60;
    const currentStudySecs = AppState.user.todayStudySeconds || 0;

    if (currentStudySecs >= targetGoalSecs && AppState.user.lastGoalBonusDate !== todayStr) {
        AppState.user.lastGoalBonusDate = todayStr;
        const goalBonusXp = 100;
        AppState.user.xp = (AppState.user.xp || 0) + goalBonusXp;

        setTimeout(() => {
            showXpToastNotification(`<i class="fi fi-sr-trophy" style="color: #E9C46A; margin-right: 6px;"></i> DAILY GOAL REACHED! +100 XP Bonus Awarded!`);
        }, 800);
    }

    const newLevelInfo = calculateUserLevel(AppState.user.xp);

    if (logToRecentHistory) {
        const formattedDuration = seconds < 60
            ? `${seconds}s (+${xpEarned} XP)`
            : `${Math.floor(seconds / 60)}m ${seconds % 60}s (+${xpEarned} XP)`;

        const newSession = {
            id: Date.now(),
            subject: subjectName,
            time: "Just now",
            duration: formattedDuration
        };
        AppState.recentSessions.unshift(newSession);
    }

    if (AppState.user.email) {
        try {
            const res = await fetch(getApiUrl('/api/user/complete-session'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: AppState.user.email,
                    subject: subjectName,
                    durationMinutes: minutesForXp,
                    currentXp: AppState.user.xp
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.totalXp && data.totalXp > AppState.user.xp) {
                    AppState.user.xp = data.totalXp;
                }
                if (data.streak !== undefined) AppState.user.streak = Math.max(AppState.user.streak || 1, data.streak);
                try {
                    localStorage.setItem('bloom_auth_user', JSON.stringify(AppState.user));
                } catch (e) {}
            }
        } catch (e) {
            console.log("Offline session logged locally.");
        }
    }

    renderHomeScreen();
    renderProfileScreen();
    renderProgressScreen();

    if (newLevelInfo.level > oldLevel) {
        showLevelUpModal(newLevelInfo);
    }
}

function showLevelUpModal(levelInfo) {
    const modal = document.getElementById('modal-level-up');
    const titleEl = document.getElementById('level-up-modal-title');
    const msgEl = document.getElementById('level-up-modal-msg');
    const tierEl = document.getElementById('level-up-modal-tier');
    const xpEl = document.getElementById('level-up-modal-total-xp');
    const closeBtn = document.getElementById('btn-close-level-up-modal');

    if (titleEl) titleEl.textContent = `LEVEL ${levelInfo.level} REACHED!`;
    if (msgEl) msgEl.innerHTML = `Congratulations, <strong>${escapeHtml(AppState.user.name || 'Scholar')}</strong>! You unlocked your new title: <strong>${escapeHtml(levelInfo.title)}</strong>.`;
    if (tierEl) tierEl.textContent = levelInfo.title;
    if (xpEl) xpEl.textContent = `${(AppState.user.xp || 0).toLocaleString()} XP`;

    if (closeBtn) {
        closeBtn.onclick = () => {
            if (modal) modal.style.display = 'none';
        };
    }

    if (modal) modal.style.display = 'flex';
}

/* Web Audio API Synthesized Loud Alarm Sound */
function playLoudAlarmSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        // 4 loud dual-tone chime beeps (A5: 880Hz, C6: 1046.5Hz)
        const beeps = [
            { time: 0.0, freq1: 880, freq2: 1046.5, duration: 0.25 },
            { time: 0.3, freq1: 880, freq2: 1046.5, duration: 0.25 },
            { time: 0.6, freq1: 880, freq2: 1046.5, duration: 0.25 },
            { time: 0.9, freq1: 1046.5, freq2: 1318.5, duration: 0.5 }
        ];

        beeps.forEach(b => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'triangle';
            osc1.frequency.value = b.freq1;
            osc2.frequency.value = b.freq2;

            gain.gain.setValueAtTime(0.7, ctx.currentTime + b.time);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + b.time + b.duration);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(ctx.currentTime + b.time);
            osc2.start(ctx.currentTime + b.time);
            osc1.stop(ctx.currentTime + b.time + b.duration);
            osc2.stop(ctx.currentTime + b.time + b.duration);
        });
    } catch (e) {}
}

/* Screen 2: Focus Screen Timer Controller */
function renderFocusScreen() {
    updateTimerDisplay();

    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resetBtn = document.getElementById('timer-reset-btn');

    if (startBtn) {
        startBtn.onclick = () => {
            if (!AppState.focus.isRunning) {
                startTimer();
            } else if (AppState.focus.isPaused) {
                resumeTimer();
            }
        };
    }

    if (pauseBtn) {
        pauseBtn.onclick = () => {
            pauseTimer();
        };
    }

    if (resetBtn) {
        resetBtn.onclick = () => {
            resetTimer();
        };
    }

    // Preset quick selector chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            const studyMins = parseInt(chip.getAttribute('data-study'), 10) || 25;
            const breakMins = parseInt(chip.getAttribute('data-break'), 10) || 5;

            const studyInput = document.getElementById('input-study-mins');
            const breakInput = document.getElementById('input-break-mins');
            if (studyInput) studyInput.value = studyMins;
            if (breakInput) breakInput.value = breakMins;

            setTimerDurations(studyMins, breakMins);
        };
    });

    // Custom duration number inputs
    const studyInput = document.getElementById('input-study-mins');
    const breakInput = document.getElementById('input-break-mins');

    if (studyInput) {
        studyInput.onchange = () => {
            const studyMins = Math.max(1, parseInt(studyInput.value, 10) || 25);
            const breakMins = Math.max(1, parseInt(breakInput.value, 10) || 5);
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            setTimerDurations(studyMins, breakMins);
        };
    }

    if (breakInput) {
        breakInput.onchange = () => {
            const studyMins = Math.max(1, parseInt(studyInput.value, 10) || 25);
            const breakMins = Math.max(1, parseInt(breakInput.value, 10) || 5);
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            setTimerDurations(studyMins, breakMins);
        };
    }

    // Test alarm button
    const testAlarmBtn = document.getElementById('btn-test-alarm');
    if (testAlarmBtn) {
        testAlarmBtn.onclick = () => {
            playLoudAlarmSound();
        };
    }
}

function setTimerDurations(studyMins, breakMins) {
    AppState.focus.studyMinutes = studyMins;
    AppState.focus.breakMinutes = breakMins;

    if (!AppState.focus.isRunning) {
        const targetMins = AppState.focus.currentMode === 'study' ? studyMins : breakMins;
        AppState.focus.defaultDurationSeconds = targetMins * 60;
        AppState.focus.secondsRemaining = targetMins * 60;
        updateTimerDisplay();
    }
}

function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const displayEl = document.getElementById('timer-display');
    if (displayEl) {
        displayEl.textContent = formatTime(AppState.focus.secondsRemaining);
    }

    const mode = AppState.focus.currentMode;
    const total = mode === 'study' ? AppState.focus.studyMinutes * 60 : AppState.focus.breakMinutes * 60;
    const current = AppState.focus.secondsRemaining;
    const fraction = Math.max(0, current / (total || 1));
    const strokeDasharray = 264;
    const dashoffset = strokeDasharray * (1 - fraction);

    const progressCircle = document.getElementById('timer-progress-circle');
    if (progressCircle) {
        progressCircle.style.strokeDashoffset = dashoffset;
        if (mode === 'break') {
            progressCircle.classList.add('ring-break-mode');
        } else {
            progressCircle.classList.remove('ring-break-mode');
        }
    }

    // Update Mode Labels
    const badgeEl = document.getElementById('timer-mode-badge');
    const badgeLabel = document.getElementById('timer-mode-label');
    const centerLabel = document.getElementById('timer-center-label');
    const titleEl = document.getElementById('timer-mode-title');

    if (mode === 'break') {
        if (badgeEl) { badgeEl.className = 'chip chip-success'; }
        if (badgeLabel) badgeLabel.textContent = 'Rest Break';
        if (centerLabel) centerLabel.textContent = 'Break Mode';
        if (titleEl) titleEl.textContent = 'Rest & Recharge Break';
    } else {
        if (badgeEl) { badgeEl.className = 'chip chip-focus'; }
        if (badgeLabel) badgeLabel.textContent = 'Study Session';
        if (centerLabel) centerLabel.textContent = 'Study Mode';
        if (titleEl) titleEl.textContent = 'Deep Work Session';
    }
}

function startTimer() {
    AppState.focus.isRunning = true;
    AppState.focus.isPaused = false;
    AppState.focus.lastTickMs = Date.now();

    updateTimerButtonsState('running');

    clearInterval(AppState.focus.timerInterval);
    AppState.focus.timerInterval = setInterval(() => {
        const now = Date.now();
        const deltaSec = Math.floor((now - (AppState.focus.lastTickMs || now)) / 1000);

        if (deltaSec >= 1) {
            AppState.focus.lastTickMs = now;

            if (AppState.focus.secondsRemaining > 0) {
                const step = Math.min(deltaSec, AppState.focus.secondsRemaining);
                AppState.focus.secondsRemaining -= step;

                if (AppState.focus.currentMode === 'study') {
                    AppState.focus.accumulatedActiveSeconds = (AppState.focus.accumulatedActiveSeconds || 0) + step;
                }

                updateTimerDisplay();

                // Track live 1-minute milestones during study mode
                if (AppState.focus.currentMode === 'study') {
                    const activeSecs = AppState.focus.accumulatedActiveSeconds || 0;
                    const elapsedMins = Math.floor(activeSecs / 60);
                    if (elapsedMins >= 1 && elapsedMins > (AppState.focus.lastAwardedMins || 0)) {
                        const incrementalMins = elapsedMins - (AppState.focus.lastAwardedMins || 0);
                        AppState.focus.lastAwardedMins = elapsedMins;
                        recordCompletedStudySession(incrementalMins * 60, 'Focus Session', false);
                        showXpToastNotification(`<i class="fi fi-sr-flame" style="color: #E76F51; margin-right: 6px;"></i> +${calculateRoomTimeXP(incrementalMins)} XP Earned for ${elapsedMins}m Focus!`);
                    }
                }
            } else {
                clearInterval(AppState.focus.timerInterval);
                AppState.focus.isRunning = false;
                updateTimerButtonsState('finished');

                // 1. Play Loud Web Audio Alarm Chime!
                playLoudAlarmSound();

                // 2. Log completed study session
                if (AppState.focus.currentMode === 'study') {
                    const completedMins = AppState.focus.studyMinutes;
                    const uncreditedMins = completedMins - (AppState.focus.lastAwardedMins || 0);
                    if (uncreditedMins > 0) {
                        recordCompletedStudySession(uncreditedMins * 60, 'Focus Session');
                    }
                    const totalXp = calculateRoomTimeXP(completedMins);

                    AppState.focus.accumulatedActiveSeconds = 0;
                    AppState.focus.lastAwardedMins = 0;

                    AppState.focus.currentMode = 'break';
                    AppState.focus.defaultDurationSeconds = AppState.focus.breakMinutes * 60;
                    AppState.focus.secondsRemaining = AppState.focus.breakMinutes * 60;
                    showTimerCompleteModal(
                        "Deep Work Session Finished!",
                        `Great job! You completed a ${completedMins}-minute focus session (+${totalXp} XP Earned). Ready for your ${AppState.focus.breakMinutes}-minute rest break?`,
                        `Start ${AppState.focus.breakMinutes}m Rest Break`,
                        () => { startTimer(); }
                    );
                } else {
                    AppState.focus.currentMode = 'study';
                    AppState.focus.defaultDurationSeconds = AppState.focus.studyMinutes * 60;
                    AppState.focus.secondsRemaining = AppState.focus.studyMinutes * 60;
                    AppState.focus.accumulatedActiveSeconds = 0;
                    AppState.focus.lastAwardedMins = 0;
                    updateTimerDisplay();

                    showTimerCompleteModal(
                        "Rest Break Finished!",
                        `Rest break is complete. Ready to jump into your next ${AppState.focus.studyMinutes}-minute deep work session?`,
                        `Start ${AppState.focus.studyMinutes}m Deep Work`,
                        () => { startTimer(); }
                    );
                }
            }
        }
    }, 1000);
}

function pauseTimer() {
    AppState.focus.isPaused = true;
    clearInterval(AppState.focus.timerInterval);
    updateTimerButtonsState('paused');
}

function resumeTimer() {
    startTimer();
}

function resetTimer() {
    if (AppState.focus.currentMode === 'study' && (AppState.focus.accumulatedActiveSeconds || 0) > 0) {
        const activeSecs = AppState.focus.accumulatedActiveSeconds || 0;
        const elapsedMins = Math.floor(activeSecs / 60);
        const uncreditedMins = elapsedMins - (AppState.focus.lastAwardedMins || 0);

        if (uncreditedMins >= 1) {
            recordCompletedStudySession(uncreditedMins * 60, 'Focus Session');
            showXpToastNotification(`<i class="fi fi-sr-flame" style="color: #E76F51; margin-right: 6px;"></i> +${calculateRoomTimeXP(uncreditedMins)} XP Earned for ${elapsedMins}m Focus!`);
        }
    }

    clearInterval(AppState.focus.timerInterval);
    AppState.focus.isRunning = false;
    AppState.focus.isPaused = false;
    AppState.focus.accumulatedActiveSeconds = 0;
    AppState.focus.lastAwardedMins = 0;

    const targetMins = AppState.focus.currentMode === 'study' ? AppState.focus.studyMinutes : AppState.focus.breakMinutes;
    AppState.focus.defaultDurationSeconds = targetMins * 60;
    AppState.focus.secondsRemaining = targetMins * 60;

    updateTimerDisplay();
    updateTimerButtonsState('initial');
}

function updateTimerButtonsState(state) {
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resetBtn = document.getElementById('timer-reset-btn');

    if (state === 'running') {
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'block';
        if (resetBtn) resetBtn.style.display = 'block';
    } else if (state === 'paused') {
        if (startBtn) {
            startBtn.style.display = 'block';
            startBtn.textContent = 'Resume';
        }
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'block';
    } else if (state === 'initial' || state === 'finished') {
        if (startBtn) {
            startBtn.style.display = 'block';
            startBtn.textContent = AppState.focus.currentMode === 'study' ? 'Start Study Session' : 'Start Break Timer';
        }
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
    }
}

/* Screen 3: Rooms Screen & Feature Controller */
let roomTimerInterval = null;

async function fetchRoomsFromDatabase() {
    try {
        const response = await fetch(getApiUrl('/api/rooms'));
        if (response.ok) {
            const data = await response.json();
            if (data.rooms && Array.isArray(data.rooms)) {
                const dbPublic = [];
                const dbPrivate = [];

                data.rooms.forEach(r => {
                    const roomObj = {
                        id: r.id,
                        name: r.name,
                        type: r.type,
                        code: r.code,
                        topic: r.topic,
                        timerMinutes: r.timerMinutes || 25,
                        secondsRemaining: r.secondsRemaining !== undefined ? r.secondsRemaining : ((r.timerMinutes || 25) * 60),
                        members: [
                            { name: "Host", avatar: r.name.charAt(0).toUpperCase(), status: "Host" }
                        ]
                    };

                    if (AppState.rooms.activeRoom && (AppState.rooms.activeRoom.id === r.id || AppState.rooms.activeRoom.code === r.code)) {
                        AppState.rooms.activeRoom.timerMinutes = roomObj.timerMinutes;
                        AppState.rooms.activeRoom.secondsRemaining = roomObj.secondsRemaining;
                        const timerEl = document.getElementById('active-room-timer');
                        if (timerEl) timerEl.textContent = formatTime(roomObj.secondsRemaining);
                    }

                    if (r.type === 'private') {
                        dbPrivate.push(roomObj);
                    } else {
                        dbPublic.push(roomObj);
                    }
                });

                AppState.rooms.publicRooms = dbPublic;
                AppState.rooms.privateRooms = dbPrivate;
            }
        }
    } catch (e) {
        console.log("Could not fetch rooms from database:", e.message);
    }

    restoreActiveRoomSession();
    renderActiveRoomStage();
    renderPublicRoomsList();
}

function restoreActiveRoomSession() {
    if (AppState.rooms.activeRoom) return;

    try {
        const savedItem = localStorage.getItem('bloom_active_room');
        if (savedItem) {
            const savedRoom = JSON.parse(savedItem);
            let room = AppState.rooms.publicRooms.find(r => r.id === savedRoom.id || r.code === savedRoom.code) ||
                       AppState.rooms.privateRooms.find(r => r.id === savedRoom.id || r.code === savedRoom.code);

            if (!room) {
                room = {
                    id: savedRoom.id,
                    name: savedRoom.name,
                    type: savedRoom.type,
                    code: savedRoom.code,
                    topic: savedRoom.topic,
                    timerMinutes: savedRoom.timerMinutes || 25,
                    secondsRemaining: savedRoom.secondsRemaining || (25 * 60),
                    members: []
                };
                if (room.type === 'private') {
                    AppState.rooms.privateRooms.unshift(room);
                } else {
                    AppState.rooms.publicRooms.unshift(room);
                }
            }

            const elapsedSeconds = Math.floor((Date.now() - (savedRoom.savedAt || Date.now())) / 1000);
            room.secondsRemaining = Math.max(0, (savedRoom.secondsRemaining || (room.timerMinutes * 60)) - elapsedSeconds);

            const user = AppState.user;
            const existing = room.members.find(m => m.isYou || m.name === user.name);
            if (!existing) {
                room.members.push({
                    name: user.name,
                    avatar: user.avatar,
                    status: "Focusing",
                    isYou: true
                });
            }

            AppState.rooms.activeRoom = room;

            // Sync rejoin with backend server
            if (user && room && room.code) {
                fetch(getApiUrl('/api/rooms/join'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomCode: room.code,
                        userEmail: user.email,
                        userName: user.name,
                        userAvatar: user.avatar
                    })
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.warn("Could not restore active room session:", e.message);
    }
}

async function rejoinLastRoom() {
    try {
        const lastStr = localStorage.getItem('bloom_last_joined_room') || localStorage.getItem('bloom_active_room');
        if (!lastStr) {
            showXpToastNotification("No recent study room found to rejoin.");
            return;
        }
        const lastRoom = JSON.parse(lastStr);
        let targetRoom = AppState.rooms.publicRooms.find(r => r.code === lastRoom.code) ||
                         AppState.rooms.privateRooms.find(r => r.code === lastRoom.code) ||
                         lastRoom;

        showXpToastNotification(`<i class="fi fi-rr-refresh" style="margin-right: 6px;"></i> Rejoining "${targetRoom.name}"...`);
        await joinRoom(targetRoom);
    } catch (e) {
        showXpToastNotification("Could not rejoin room. Please verify room code.");
    }
}

function renderRoomsScreen() {
    renderActiveRoomStage();
    renderPublicRoomsList();
    fetchRoomsFromDatabase();
}

function renderActiveRoomStage() {
    const activeContainer = document.getElementById('rooms-active-container');
    if (!activeContainer) return;

    const { activeRoom } = AppState.rooms;

    if (!activeRoom) {
        let lastRoomInfo = null;
        try {
            const lastStr = localStorage.getItem('bloom_last_joined_room') || localStorage.getItem('bloom_active_room');
            if (lastStr) lastRoomInfo = JSON.parse(lastStr);
        } catch (e) {}

        if (lastRoomInfo && lastRoomInfo.code) {
            activeContainer.innerHTML = `
                <div class="card" style="margin-bottom: 20px; background: rgba(82, 183, 136, 0.08); border: 1.5px dashed var(--primary-600); border-radius: 16px; padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
                        <div>
                            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 6px;">
                                <span class="chip chip-success" style="font-size: 0.72rem; font-weight: 700;"><i class="fi fi-rr-refresh" style="margin-right: 4px;"></i> Refresh / Disconnected?</span>
                                <span class="chip" style="font-family: var(--font-mono); font-size: 0.72rem; background: var(--surface-card); color: var(--primary-600); border: 1px solid var(--primary-600);">ID: ${escapeHtml(lastRoomInfo.code)}</span>
                            </div>
                            <h4 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">${escapeHtml(lastRoomInfo.name)}</h4>
                            <p style="font-size: 0.83rem; color: var(--text-secondary); margin: 0;">${escapeHtml(lastRoomInfo.topic || 'General Deep Work Session')}</p>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="btn-primary" onclick="rejoinLastRoom()" style="padding: 10px 22px; font-size: 0.88rem; font-weight: 700; border-radius: 12px; width: auto;">
                                <i class="fi fi-rr-undo-alt" style="margin-right: 6px;"></i> Rejoin Room
                            </button>
                            <button class="btn-outline" onclick="openJoinPrivateModal()" style="padding: 10px 14px; font-size: 0.82rem; border-radius: 12px; width: auto;">Join ID</button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        activeContainer.innerHTML = `
            <div class="card" style="margin-bottom: 20px; background: var(--surface-muted); border-style: dashed;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div class="card-title" style="font-size: 0.95rem;">Not in a study room</div>
                        <p style="font-size: 0.82rem; margin-top: 2px;">Join a public lounge below or enter a private Room ID code.</p>
                    </div>
                    <button class="btn-outline" onclick="openJoinPrivateModal()" style="padding: 8px 12px; font-size: 0.8rem; flex-shrink: 0;">Join ID</button>
                </div>
            </div>
        `;
        return;
    }

    const typeChipClass = activeRoom.type === 'private' ? 'chip-warning' : 'chip-success';
    const typeLabel = activeRoom.type === 'private' ? `Private · ID: ${escapeHtml(activeRoom.code)}` : `Public Lounge`;

    const membersHtml = activeRoom.members.map(m => `
        <div class="member-pill">
            <div class="mini-avatar">${m.avatar}</div>
            <span>${escapeHtml(m.name)}${m.isYou ? ' (You)' : ''}</span>
        </div>
    `).join('');

    activeContainer.innerHTML = `
        <div class="active-room-stage">
            <div class="card-header" style="margin-bottom: 0;">
                <div>
                    <span class="chip ${typeChipClass}" style="margin-bottom: 6px;">${typeLabel}</span>
                    <h3 style="font-size: 1.25rem;">${escapeHtml(activeRoom.name)}</h3>
                    <p style="font-size: 0.85rem; margin-top: 2px;">${escapeHtml(activeRoom.topic || 'General Deep Work')}</p>
                </div>
                <button class="btn-outline" onclick="leaveActiveRoom()" style="border-color: var(--error); color: var(--error); padding: 8px 14px; font-size: 0.82rem;">Leave Room</button>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border-radius: var(--radius-md); border: 1px solid var(--border);">
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">ROOM TIMER</div>
                    <div class="room-timer-display" id="active-room-timer">${formatTime(activeRoom.secondsRemaining)}</div>
                </div>
                <span class="chip chip-focus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>Live Session</span>
            </div>

            <div>
                <div id="active-room-studying-count" style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">STUDYING NOW (${activeRoom.members.length})</div>
                <div class="members-grid">
                    ${membersHtml}
                </div>
            </div>
        </div>
    `;

    startRoomTimerTicker();
}

let roomMemberPollCounter = 0;

function showXpToastNotification(msg) {
    let toast = document.getElementById('toast-xp-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-xp-notification';
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.background = 'var(--primary, #52B788)';
        toast.style.color = '#ffffff';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '12px';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
        toast.style.fontWeight = '700';
        toast.style.fontSize = '0.92rem';
        toast.style.zIndex = '999999';
        toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 4000);
}

function showTimerCompleteModal(title, msg, btnText = "Continue", onAction = null) {
    const modal = document.getElementById('modal-timer-complete');
    const titleEl = document.getElementById('timer-complete-modal-title');
    const msgEl = document.getElementById('timer-complete-modal-msg');
    const btnEl = document.getElementById('btn-timer-complete-modal-action');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    if (btnEl) btnEl.textContent = btnText;

    if (btnEl) {
        btnEl.onclick = () => {
            if (modal) modal.style.display = 'none';
            if (onAction && typeof onAction === 'function') onAction();
        };
    }

    if (modal) modal.style.display = 'flex';
}

function startRoomTimerTicker() {
    clearInterval(roomTimerInterval);
    roomTimerInterval = setInterval(() => {
        const { activeRoom } = AppState.rooms;
        if (!activeRoom) {
            clearInterval(roomTimerInterval);
            return;
        }

        if (!activeRoom.joinedAtMs) {
            activeRoom.joinedAtMs = Date.now();
            activeRoom.lastAwardedXpMinutes = 0;
        }

        if (activeRoom.secondsRemaining > 0) {
            activeRoom.secondsRemaining--;
            const timerEl = document.getElementById('active-room-timer');
            if (timerEl) timerEl.textContent = formatTime(activeRoom.secondsRemaining);
        } else {
            clearInterval(roomTimerInterval);
            showTimerCompleteModal(
                "Room Session Finished!",
                `The study session in room "${activeRoom.name}" has completed. Great work!`,
                "Great!"
            );
        }

        // Live Room XP Calculation (every 1-minute milestone while in room)
        const elapsedSec = Math.floor((Date.now() - activeRoom.joinedAtMs) / 1000);
        const elapsedMins = Math.floor(elapsedSec / 60);

        if (elapsedMins >= 1 && elapsedMins > (activeRoom.lastAwardedXpMinutes || 0)) {
            const alreadyAwardedXp = calculateRoomTimeXP(activeRoom.lastAwardedXpMinutes || 0);
            const totalXpForMins = calculateRoomTimeXP(elapsedMins);
            const incrementalXp = totalXpForMins - alreadyAwardedXp;

            activeRoom.lastAwardedXpMinutes = elapsedMins;

            if (incrementalXp > 0) {
                recordCompletedStudySession(60, `Study Room: ${activeRoom.name}`);
                showXpToastNotification(`<i class="fi fi-sr-flame" style="color: #E76F51; margin-right: 6px;"></i> +${incrementalXp} XP Earned for ${elapsedMins}m focus in ${activeRoom.name}!`);
            }
        }

        roomMemberPollCounter++;
        if (roomMemberPollCounter % 2 === 0 && activeRoom.code) {
            syncActiveRoomMembers(activeRoom.code);
        }
        if (roomMemberPollCounter % 3 === 0) {
            fetchRoomsFromDatabase();
        }
    }, 1000);
}

async function syncActiveRoomMembers(roomCode) {
    const { activeRoom } = AppState.rooms;
    if (!activeRoom || activeRoom.code !== roomCode) return;

    try {
        const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}/members`));
        if (res.ok) {
            const data = await res.json();
            if (data.participants && Array.isArray(data.participants)) {
                const user = AppState.user;
                const newMembersList = data.participants.map(p => ({
                    name: p.name,
                    avatar: p.avatar,
                    status: (user.name === p.name || user.email === p.email)
                        ? (p.isHost ? "Host (You)" : "Focusing (You)")
                        : (p.isHost ? "Host" : "Focusing"),
                    isYou: (user.name === p.name || user.email === p.email),
                    isHost: p.isHost
                }));

                activeRoom.members = newMembersList;

                const countEl = document.getElementById('active-room-studying-count');
                if (countEl) {
                    countEl.textContent = `STUDYING NOW (${newMembersList.length})`;
                }

                const membersContainer = document.querySelector('.members-grid');
                if (membersContainer) {
                    membersContainer.innerHTML = newMembersList.map(m => `
                        <div class="member-pill">
                            <div class="mini-avatar">${m.avatar}</div>
                            <span>${escapeHtml(m.name)}${m.isYou ? ' (You)' : ''} ${m.isHost ? '<i class="fi fi-sr-crown" style="color: #E9C46A; margin-left: 4px;"></i>' : ''}</span>
                        </div>
                    `).join('');
                }
            }
        }
    } catch (e) {}
}

function renderPublicRoomsList() {
    const listEl = document.getElementById('rooms-public-list');
    if (!listEl) return;

    if (AppState.rooms.publicRooms.length === 0) {
        listEl.innerHTML = `
            <div class="empty-rooms-card" style="text-align: center; padding: 28px 16px; background: var(--surface-card); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fi fi-rr-users-alt" style="font-size: 2.2rem; margin-bottom: 8px; color: var(--primary-600); display: block;"></i>
                <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 4px;">No active study rooms right now</div>
                <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 14px;">Create your own study room or join with a private Room ID!</div>
                <button class="btn-primary" onclick="openCreateRoomModal()" style="margin: 0 auto; padding: 8px 18px; font-size: 0.84rem; width: auto;">+ Create Study Room</button>
            </div>
        `;
        return;
    }

    listEl.innerHTML = AppState.rooms.publicRooms.map(room => {
        const isCurrent = AppState.rooms.activeRoom && AppState.rooms.activeRoom.id === room.id;
        const avatarStackHtml = room.members.slice(0, 4).map(m => `<div class="avatar-stack-item">${m.avatar}</div>`).join('');

        return `
            <div class="room-card">
                <div class="card-header" style="margin-bottom: 0;">
                    <div>
                        <div class="card-title">${escapeHtml(room.name)}</div>
                        <p style="font-size: 0.82rem; margin-top: 2px;">${escapeHtml(room.topic)}</p>
                    </div>
                    <span class="chip chip-success">Public</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; gap: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="avatar-stack">${avatarStackHtml}</div>
                        <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">${room.members.length} Online</span>
                    </div>
                    ${isCurrent ?
                        `<button class="btn-secondary" disabled style="opacity: 0.7;">Active</button>` :
                        `<button class="btn-primary" onclick="joinRoomById('${room.id}')" style="padding: 8px 16px; font-size: 0.82rem; width: auto;">Join Lounge</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function joinRoomById(roomId) {
    const room = AppState.rooms.publicRooms.find(r => r.id === roomId) || AppState.rooms.privateRooms.find(r => r.id === roomId);
    if (room) {
        joinRoom(room);
    }
}

async function joinRoom(room) {
    const user = AppState.user;

    try {
        const response = await fetch(getApiUrl('/api/rooms/join'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode: room.code,
                userEmail: user.email,
                userName: user.name,
                userAvatar: user.avatar
            })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.participants && Array.isArray(data.participants)) {
                room.members = data.participants.map(p => ({
                    name: p.name,
                    avatar: p.avatar,
                    status: (user.name === p.name || user.email === p.email)
                        ? (p.isHost ? "Host (You)" : "Focusing (You)")
                        : (p.isHost ? "Host" : "Focusing"),
                    isYou: (user.name === p.name || user.email === p.email),
                    isHost: p.isHost
                }));
            }
        }
    } catch (e) {
        const existing = room.members.find(m => m.isYou || m.name === user.name);
        if (!existing) {
            const isHost = room.members.length === 0;
            room.members.push({
                name: user.name,
                avatar: user.avatar,
                status: isHost ? "Host (You)" : "Focusing",
                isYou: true,
                isHost: isHost
            });
        }
    }

    room.joinedAtMs = Date.now();
    room.lastAwardedXpMinutes = 0;
    AppState.rooms.activeRoom = room;

    try {
        const roomStateData = JSON.stringify({
            id: room.id,
            code: room.code,
            name: room.name,
            type: room.type,
            topic: room.topic,
            timerMinutes: room.timerMinutes,
            secondsRemaining: room.secondsRemaining,
            savedAt: Date.now()
        });
        localStorage.setItem('bloom_active_room', roomStateData);
        localStorage.setItem('bloom_last_joined_room', roomStateData);
    } catch (e) {}

    renderRoomsScreen();
    AppRouter.navigateTo('rooms');
}

async function leaveActiveRoom() {
    const room = AppState.rooms.activeRoom;
    const user = AppState.user;

    if (room) {
        if (room.joinedAtMs) {
            const elapsedMins = Math.floor((Date.now() - room.joinedAtMs) / 1000 / 60);
            const uncreditedMins = elapsedMins - (room.lastAwardedXpMinutes || 0);
            if (uncreditedMins >= 1) {
                recordCompletedStudySession(uncreditedMins * 60, `Study Room: ${room.name}`);
            }
        }

        if (room.code) {
            try {
                await fetch(getApiUrl('/api/rooms/leave'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomCode: room.code,
                        userEmail: user.email,
                        userName: user.name
                    })
                });
            } catch (e) {}
        }
    }

    clearInterval(roomTimerInterval);
    AppState.rooms.activeRoom = null;
    try {
        localStorage.removeItem('bloom_active_room');
    } catch (e) {}
    renderRoomsScreen();
}

function openJoinPrivateModal() {
    const modal = document.getElementById('modal-join-private-room');
    if (modal) modal.style.display = 'flex';
}

function closeJoinPrivateModal() {
    const modal = document.getElementById('modal-join-private-room');
    if (modal) modal.style.display = 'none';
}

function openCreateRoomModal() {
    const modal = document.getElementById('modal-create-room');
    if (modal) modal.style.display = 'flex';
}

function closeCreateRoomModal() {
    const modal = document.getElementById('modal-create-room');
    if (modal) modal.style.display = 'none';
}



function attachRoomModalHandlers() {
    // Join Private Modal triggers
    const joinPrivateBtn = document.getElementById('rooms-join-private-btn');
    if (joinPrivateBtn) joinPrivateBtn.onclick = openJoinPrivateModal;

    const closeJoinBtn = document.getElementById('modal-close-join-btn');
    if (closeJoinBtn) closeJoinBtn.onclick = closeJoinPrivateModal;

    const cancelJoinBtn = document.getElementById('btn-cancel-join');
    if (cancelJoinBtn) cancelJoinBtn.onclick = closeJoinPrivateModal;

    const formJoinPrivate = document.getElementById('form-join-private-room');
    if (formJoinPrivate) {
        formJoinPrivate.onsubmit = (e) => {
            e.preventDefault();
            const inputCode = document.getElementById('input-private-room-code').value.trim().toUpperCase();
            if (!inputCode) return;

            // Search privateRooms or publicRooms by code
            let targetRoom = AppState.rooms.privateRooms.find(r => r.code.toUpperCase() === inputCode) ||
                             AppState.rooms.publicRooms.find(r => r.code.toUpperCase() === inputCode);

            if (!targetRoom) {
                // Generate a custom private room for this ID so user can test any code!
                targetRoom = {
                    id: `room-custom-${Date.now()}`,
                    name: `Private Group (${inputCode})`,
                    type: 'private',
                    code: inputCode,
                    topic: 'Private Study Session',
                    members: [
                        { name: "Host", avatar: "H", status: "Focusing" }
                    ],
                    timerMinutes: 25,
                    secondsRemaining: 25 * 60,
                    isRunning: true
                };
                AppState.rooms.privateRooms.push(targetRoom);
            }

            closeJoinPrivateModal();
            joinRoom(targetRoom);
        };
    }

    // Create Room Modal triggers
    const createBtn = document.getElementById('rooms-create-btn');
    if (createBtn) createBtn.onclick = openCreateRoomModal;

    const closeCreateBtn = document.getElementById('modal-close-create-btn');
    if (closeCreateBtn) closeCreateBtn.onclick = closeCreateRoomModal;

    const cancelCreateBtn = document.getElementById('btn-cancel-create');
    if (cancelCreateBtn) cancelCreateBtn.onclick = closeCreateRoomModal;

    const formCreate = document.getElementById('form-create-room');
    if (formCreate) {
        formCreate.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('input-room-name').value.trim();
            const topic = document.getElementById('input-room-topic').value.trim() || 'General Focus';
            const type = document.getElementById('select-room-type').value;
            const duration = parseInt(document.getElementById('select-room-duration').value, 10) || 25;

            if (!name) return;

            const newRoom = {
                id: `room-${Date.now()}`,
                name: name,
                type: type,
                code: type === 'private' ? `BLM-${Math.floor(1000 + Math.random() * 9000)}` : `PUB-${Math.floor(100 + Math.random() * 900)}`,
                topic: topic,
                members: [
                    { name: AppState.user.name, avatar: AppState.user.avatar, status: "Host (You)", isYou: true }
                ],
                timerMinutes: duration,
                secondsRemaining: duration * 60,
                isRunning: true
            };

            // Post room directly to backend API & MySQL database
            try {
                const response = await fetch(getApiUrl('/api/rooms/create'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        topic: topic,
                        type: type,
                        timerMinutes: duration
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.room) {
                        newRoom.id = data.room.id;
                        newRoom.code = data.room.code;
                    }
                }
            } catch (err) {
                console.warn("Backend room save warning:", err.message);
            }

            if (type === 'public') {
                AppState.rooms.publicRooms.unshift(newRoom);
            } else {
                AppState.rooms.privateRooms.unshift(newRoom);
            }

            closeCreateRoomModal();
            joinRoom(newRoom);
        };
    }
}

/* Helper: LocalStorage persistence for flashcards */
function saveFlashcardDecksToStorage() {
    try {
        localStorage.setItem('bloom_flashcard_decks', JSON.stringify(AppState.flashcards.decks));
    } catch (e) {}
}

async function fetchDecksFromDatabase() {
    const userEmail = AppState.user && AppState.user.email ? AppState.user.email : 'guest@bloom.app';

    if (activeStudyState && activeStudyState.deck) return;

    try {
        const response = await fetch(getApiUrl(`/api/decks?email=${encodeURIComponent(userEmail)}`));
        if (response.ok) {
            const data = await response.json();
            if (data.decks && Array.isArray(data.decks)) {
                if (activeStudyState && activeStudyState.deck) return;

                const dbDecksMap = new Map();
                data.decks.forEach(d => {
                    const key = String(d.dbId || d.id);
                    dbDecksMap.set(key, { ...d, creatorEmail: userEmail });
                });

                (AppState.flashcards.decks || []).forEach(localDeck => {
                    const key = String(localDeck.dbId || localDeck.id);
                    if (!dbDecksMap.has(key)) {
                        dbDecksMap.set(key, localDeck);
                    }
                });

                AppState.flashcards.decks = Array.from(dbDecksMap.values());
                saveFlashcardDecksToStorage();
                renderFlashcardsScreenUI();
            }
        }
    } catch (e) {
        console.warn("Could not fetch user decks from database:", e.message);
    }
}

/* Screen 4: Flashcards Screen & Modal Controllers */
function renderFlashcardsScreen() {
    fetchDecksFromDatabase();
    renderFlashcardsScreenUI();
}

function renderFlashcardsScreenUI() {
    const container = document.getElementById('flashcards-deck-list');
    if (!container) return;

    const currentUserEmail = AppState.user && AppState.user.email ? AppState.user.email : null;
    const userDecks = (AppState.flashcards.decks || []).filter(deck => {
        if (!currentUserEmail) return true;
        return !deck.creatorEmail || deck.creatorEmail === currentUserEmail || deck.isImported;
    });

    if (userDecks.length === 0) {
        container.innerHTML = `
            <div class="empty-flashcards-card" style="grid-column: 1 / -1; text-align: center; padding: 36px 20px; background: var(--surface-card); border-radius: 16px; border: 1px dashed var(--border);">
                <i class="fi fi-rr-subtitles" style="font-size: 2.5rem; margin-bottom: 8px; color: var(--primary-600); display: block;"></i>
                <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary); margin-bottom: 4px;">No flashcard decks created yet</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 18px;">Create your first private deck or import a shared deck by ID!</div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="btn-primary" onclick="openCreateDeckModal()" style="padding: 10px 22px; font-size: 0.86rem; width: auto;">+ Create First Deck</button>
                    <button class="btn-outline" onclick="openImportDeckModal()" style="padding: 10px 18px; font-size: 0.86rem; width: auto;"><i class="fi fi-rr-download" style="margin-right: 6px;"></i> Import Deck by ID</button>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = userDecks.map(deck => {
            const cardCount = deck.cards ? deck.cards.length : 0;
            const masteredCount = deck.cards ? deck.cards.filter(c => c.mastered).length : 0;
            const masteredPercent = cardCount > 0 ? Math.round((masteredCount / cardCount) * 100) : 0;
            const subjectTag = deck.subject || 'General';
            const shareCode = deck.shareCode || `DEC-${(deck.dbId || deck.id).toString().replace(/^deck[-_]/i, '')}`;
            const currentUser = AppState.user;
            const creatorDisplayName = deck.creatorName || (deck.creatorEmail ? deck.creatorEmail : currentUser ? currentUser.name : 'Learner');

            return `
                <div class="deck-card" style="display: flex; flex-direction: column; justify-content: space-between; padding: 20px; border-radius: 16px; background: var(--surface-card); border: 1px solid var(--border);">
                    <div class="deck-card-top">
                        <!-- Top Tags Row -->
                        <div class="deck-card-tags" style="display: flex; gap: 6px; align-items: center; justify-content: space-between; margin-bottom: 12px; width: 100%;">
                            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                <span class="chip chip-focus">${escapeHtml(subjectTag)}</span>
                                <span class="chip" style="font-family: var(--font-mono); font-size: 0.72rem; background: rgba(82,183,136,0.12); color: var(--primary-600); border: 1px solid var(--primary-600);"><i class="fi fi-rr-lock" style="margin-right: 4px;"></i> ID: ${escapeHtml(shareCode)}</span>
                            </div>
                            <span class="chip chip-success">${masteredPercent}% Mastered</span>
                        </div>

                        <!-- 1. DECK NAME -->
                        <h3 class="card-title" style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">${escapeHtml(deck.title)}</h3>

                        <!-- 2. Name of the deck creator -->
                        <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                            <i class="fi fi-rr-user" style="font-size: 0.78rem; color: var(--primary-600);"></i>
                            <span>${escapeHtml(creatorDisplayName)}</span>
                        </div>

                        <!-- 3. how many cards -->
                        <div class="deck-meta" style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 16px;">
                            <span><i class="fi fi-rr-book-alt" style="margin-right: 4px; color: var(--primary-600);"></i> ${cardCount} Card${cardCount === 1 ? '' : 's'}</span>
                            <span style="margin: 0 6px;">•</span>
                            <span><i class="fi fi-sr-star" style="margin-right: 4px; color: #E9C46A;"></i> ${masteredCount} Mastered</span>
                        </div>
                    </div>

                    <!-- 4. study deck and add cards & Flaticon-only share and trash -->
                    <div class="deck-card-actions" style="display: flex; gap: 8px; align-items: center; justify-content: space-between; width: 100%; border-top: 1px solid var(--border); padding-top: 14px;">
                        <div style="display: flex; gap: 6px; flex: 1;">
                            <button type="button" class="btn-primary deck-btn-study" onclick="openStudyModal('${deck.id}')" style="padding: 8px 14px; font-size: 0.82rem; white-space: nowrap; flex: 1; min-width: 0;">Study Deck</button>
                            <button type="button" class="btn-outline deck-btn-add" onclick="openAddCardModal('${deck.id}')" title="Add Card" style="padding: 8px 12px; font-size: 0.82rem; white-space: nowrap;">+ Card</button>
                        </div>

                        <!-- Flaticon-only share and trash buttons -->
                        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                            <button type="button" class="btn-outline" onclick="openShareDeckModal('${deck.id}')" title="Share Deck ID (${escapeHtml(shareCode)})" style="padding: 0; border-color: var(--primary-600); color: var(--primary-600); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; box-sizing: border-box;">
                                <i class="fi fi-rr-share" style="font-size: 1.05rem; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; margin: 0; line-height: 1;"></i>
                            </button>
                            <button type="button" class="btn-outline" onclick="deleteFlashcardDeck('${deck.id}')" title="Delete Deck" style="padding: 0; border-color: rgba(229, 62, 62, 0.4); color: var(--error, #e53e3e); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; box-sizing: border-box;">
                                <i class="fi fi-rr-trash" style="font-size: 1.05rem; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; margin: 0; line-height: 1;"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    const createBtn = document.getElementById('create-deck-btn');
    if (createBtn) {
        createBtn.onclick = openCreateDeckModal;
    }

    const openImportBtn = document.getElementById('btn-open-import-deck-modal');
    if (openImportBtn) openImportBtn.onclick = openImportDeckModal;

    const closeImportBtn = document.getElementById('modal-close-import-deck-btn');
    if (closeImportBtn) closeImportBtn.onclick = closeImportDeckModal;

    const cancelImportBtn = document.getElementById('btn-cancel-import-deck');
    if (cancelImportBtn) cancelImportBtn.onclick = closeImportDeckModal;

    const importForm = document.getElementById('form-import-deck');
    if (importForm) importForm.onsubmit = handleImportDeckSubmit;

    const closeShareBtn = document.getElementById('btn-close-share-deck-modal');
    if (closeShareBtn) closeShareBtn.onclick = closeShareDeckModal;

    const copyShareBtn = document.getElementById('btn-copy-share-deck-code');
    if (copyShareBtn) copyShareBtn.onclick = copyShareDeckCode;
    const closeCardNotFoundBtn = document.getElementById('btn-close-card-not-found-modal');
    if (closeCardNotFoundBtn) closeCardNotFoundBtn.onclick = closeCardNotFoundErrorModal;
}

/* Universal Flexible Deck Finder Helper */
function findDeckById(deckId) {
    if (!deckId) return null;
    const strId = String(deckId);
    const numericPart = strId.replace(/^deck[-_]/i, '');
    return AppState.flashcards.decks.find(d => {
        if (!d) return false;
        if (String(d.id) === strId) return true;
        if (d.dbId && (String(d.dbId) === strId || String(d.dbId) === numericPart)) return true;
        if (d.id && String(d.id).replace(/^deck[-_]/i, '') === numericPart) return true;
        if (d.shareCode && d.shareCode.toUpperCase() === strId.toUpperCase()) return true;
        return false;
    }) || null;
}

/* Share Private Deck Modal */
let activeShareDeckCode = null;

function openShareDeckModal(deckId) {
    const deck = findDeckById(deckId);
    if (!deck) return;

    const shareCode = deck.shareCode || `DEC-${(deck.dbId || deck.id).toString().replace(/^deck[-_]/i, '')}`;
    activeShareDeckCode = shareCode;

    const titleEl = document.getElementById('share-deck-title');
    const codeValEl = document.getElementById('share-deck-code-val');

    if (titleEl) titleEl.textContent = `Share "${deck.title}"`;
    if (codeValEl) codeValEl.textContent = shareCode;

    const modal = document.getElementById('modal-share-deck');
    if (modal) modal.style.display = 'flex';
}

function closeShareDeckModal() {
    const modal = document.getElementById('modal-share-deck');
    if (modal) modal.style.display = 'none';
}

function copyShareDeckCode() {
    if (!activeShareDeckCode) return;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(activeShareDeckCode).then(() => {
            showXpToastNotification(`<i class="fi fi-rr-check" style="margin-right: 6px;"></i> Deck ID Code (${activeShareDeckCode}) copied to clipboard!`);
        }).catch(() => {
            showXpToastNotification(`<i class="fi fi-rr-check" style="margin-right: 6px;"></i> Deck ID Code: ${activeShareDeckCode}`);
        });
    } else {
        showXpToastNotification(`<i class="fi fi-rr-check" style="margin-right: 6px;"></i> Deck ID Code: ${activeShareDeckCode}`);
    }
}

/* Import Shared Private Deck Modal & Errors */
function showImportDeckError(msg) {
    const errBox = document.getElementById('import-deck-error-box');
    const errText = document.getElementById('import-deck-error-text');
    if (errText) errText.textContent = msg;
    if (errBox) errBox.style.display = 'flex';
}

function hideImportDeckError() {
    const errBox = document.getElementById('import-deck-error-box');
    if (errBox) errBox.style.display = 'none';
}

function openCardNotFoundErrorModal(msg) {
    const modal = document.getElementById('modal-card-not-found');
    const msgEl = document.getElementById('card-not-found-msg');
    if (msgEl) msgEl.textContent = msg || "No flashcards deck found with this Deck ID Code. Please verify the ID and try again.";
    if (modal) modal.style.display = 'flex';
}

function closeCardNotFoundErrorModal() {
    const modal = document.getElementById('modal-card-not-found');
    if (modal) modal.style.display = 'none';
    const codeInput = document.getElementById('input-import-deck-code');
    if (codeInput) {
        codeInput.focus();
        codeInput.select();
    }
}

function openImportDeckModal() {
    hideImportDeckError();
    const modal = document.getElementById('modal-import-deck');
    if (modal) {
        modal.style.display = 'flex';
        const codeInput = document.getElementById('input-import-deck-code');
        if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
        }
    }
}

function closeImportDeckModal() {
    const modal = document.getElementById('modal-import-deck');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('form-import-deck');
    if (form) form.reset();
    hideImportDeckError();
}

async function handleImportDeckSubmit(e) {
    e.preventDefault();
    hideImportDeckError();
    const codeInput = document.getElementById('input-import-deck-code');
    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

    if (!code) return;

    try {
        const userEmail = AppState.user && AppState.user.email ? AppState.user.email : '';
        const response = await fetch(getApiUrl(`/api/decks/import/${encodeURIComponent(code)}?email=${encodeURIComponent(userEmail)}`));
        if (response.ok) {
            const data = await response.json();
            if (data.deck) {
                const imported = {
                    ...data.deck,
                    creatorEmail: userEmail,
                    isImported: true
                };

                // Check if already in list
                const existing = AppState.flashcards.decks.find(d =>
                    (d.shareCode && d.shareCode === imported.shareCode) || d.id === imported.id || (d.dbId && imported.dbId && d.dbId === imported.dbId)
                );

                if (existing) {
                    showXpToastNotification(`<i class="fi fi-rr-info" style="margin-right: 6px;"></i> "${imported.title}" is already in your decks list!`);
                } else {
                    AppState.flashcards.decks.unshift(imported);
                    saveFlashcardDecksToStorage();
                    renderFlashcardsScreenUI();
                    showXpToastNotification(`<i class="fi fi-rr-check" style="margin-right: 6px;"></i> Successfully imported "${imported.title}" (${imported.cards ? imported.cards.length : 0} cards)!`);
                }

                closeImportDeckModal();
            }
        } else {
            const errData = await response.json();
            const errorMsg = errData.error || `No cards found with Deck ID Code "${code}".`;
            showImportDeckError(errorMsg);
            openCardNotFoundErrorModal(errorMsg);
        }
    } catch (err) {
        const errorMsg = "Failed to import deck. Please check your internet connection.";
        showImportDeckError(errorMsg);
        openCardNotFoundErrorModal(errorMsg);
    }
}

/* Flashcard Deck Creation Modal & Confirmation Modal */
let newlyCreatedDeckId = null;

function openDeckCreatedSuccessModal(deck) {
    if (!deck) return;
    newlyCreatedDeckId = deck.id;

    const titleEl = document.getElementById('created-deck-title-text');
    const codeEl = document.getElementById('created-deck-code-text');

    if (titleEl) titleEl.textContent = deck.title || "New Deck";
    const shareCode = deck.shareCode || `DEC-${(deck.dbId || deck.id).toString().replace('deck_', '').replace('deck-', '')}`;
    if (codeEl) codeEl.textContent = shareCode;

    const modal = document.getElementById('modal-deck-created-success');
    if (modal) modal.style.display = 'flex';
}

function closeDeckCreatedSuccessModal() {
    const modal = document.getElementById('modal-deck-created-success');
    if (modal) modal.style.display = 'none';
}

function handleAddCardFromCreatedModal() {
    closeDeckCreatedSuccessModal();
    if (newlyCreatedDeckId) {
        openAddCardModal(newlyCreatedDeckId);
    }
}

function openCreateDeckModal() {
    const modal = document.getElementById('modal-create-deck');
    if (modal) {
        modal.style.display = 'flex';
        const titleInput = document.getElementById('input-deck-title');
        if (titleInput) titleInput.focus();
    }
}

function closeCreateDeckModal() {
    const modal = document.getElementById('modal-create-deck');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('form-create-deck');
    if (form) form.reset();
}

/* Add Flashcard Modal */
function openAddCardModal(deckId) {
    const deck = findDeckById(deckId);
    if (!deck) return;

    const deckIdInput = document.getElementById('input-add-card-deck-id');
    const deckNameLabel = document.getElementById('add-card-deck-name');
    if (deckIdInput) deckIdInput.value = deck.id;
    if (deckNameLabel) deckNameLabel.textContent = `Deck: ${deck.title}`;

    const modal = document.getElementById('modal-add-card');
    if (modal) {
        modal.style.display = 'flex';
        const frontInput = document.getElementById('input-card-front');
        if (frontInput) {
            frontInput.value = '';
            frontInput.focus();
        }
        const backInput = document.getElementById('input-card-back');
        if (backInput) backInput.value = '';
    }
}

function closeAddCardModal() {
    const modal = document.getElementById('modal-add-card');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('form-add-card');
    if (form) form.reset();
}

let pendingDeleteDeckId = null;

function deleteFlashcardDeck(deckId) {
    openDeleteDeckModal(deckId);
}

function openDeleteDeckModal(deckId) {
    const deck = findDeckById(deckId);
    if (!deck) return;

    pendingDeleteDeckId = deck.id || deckId;

    const titleEl = document.getElementById('delete-deck-title');
    if (titleEl) titleEl.textContent = `"${deck.title}"`;

    const modal = document.getElementById('modal-delete-deck');
    if (modal) modal.style.display = 'flex';
}

function closeDeleteDeckModal() {
    const modal = document.getElementById('modal-delete-deck');
    if (modal) modal.style.display = 'none';
    pendingDeleteDeckId = null;
}

async function confirmDeleteDeck() {
    if (!pendingDeleteDeckId) return;

    const deckId = pendingDeleteDeckId;
    const deck = findDeckById(deckId);

    if (deck) {
        const targetId = deck.id;
        const targetDbId = deck.dbId;

        AppState.flashcards.decks = AppState.flashcards.decks.filter(d => d !== deck && d.id !== targetId);
        saveFlashcardDecksToStorage();

        const numericId = targetDbId || (typeof targetId === 'string' && targetId.replace(/^deck[-_]/i, ''));
        if (numericId && !isNaN(parseInt(numericId, 10))) {
            try {
                await fetch(getApiUrl(`/api/decks/${parseInt(numericId, 10)}`), { method: 'DELETE' });
                console.log(`💾 Deleted deck ID ${numericId} from backend.`);
            } catch (e) {
                console.warn("Backend deck delete warning:", e.message);
            }
        }
        showXpToastNotification(`<i class="fi fi-rr-trash" style="margin-right: 6px;"></i> Deck "${deck.title}" deleted.`);
    }

    closeDeleteDeckModal();
    renderFlashcardsScreen();
}

/* Active Recall 3D Study Session Controller */
let activeStudyState = {
    deck: null,
    cardsQueue: [],
    currentIndex: 0,
    isFlipped: false,
    masteredCount: 0,
    totalInitialCards: 0,
    elapsedSeconds: 0,
    startTimeMs: 0,
    isCompleted: false
};
let deckTimerInterval = null;

function openStudyModal(deckId) {
    const deck = findDeckById(deckId);
    if (!deck) return;

    if (!deck.cards || deck.cards.length === 0) {
        showXpToastNotification("The deck has no cards yet. Add your first card to start studying!");
        openAddCardModal(deckId);
        return;
    }

    clearInterval(deckTimerInterval);

    activeStudyState = {
        deck: deck,
        cardsQueue: deck.cards.map(c => ({ ...c })),
        currentIndex: 0,
        isFlipped: false,
        masteredCount: 0,
        totalInitialCards: deck.cards.length,
        elapsedSeconds: 0,
        startTimeMs: Date.now(),
        isCompleted: false
    };

    const titleEl = document.getElementById('study-deck-title');
    const tagEl = document.getElementById('study-deck-tag');
    const timerTextEl = document.getElementById('study-live-timer-text');

    if (titleEl) titleEl.textContent = deck.title;
    if (tagEl) tagEl.textContent = deck.subject || 'Study';
    if (timerTextEl) timerTextEl.textContent = '00:00';

    const activeView = document.getElementById('study-active-view');
    const summaryView = document.getElementById('study-summary-view');
    if (activeView) activeView.style.display = 'block';
    if (summaryView) summaryView.style.display = 'none';

    renderCurrentStudyCard();

    // Start live stopwatch ticker counting seconds
    deckTimerInterval = setInterval(() => {
        activeStudyState.elapsedSeconds++;
        const liveTimerEl = document.getElementById('study-live-timer-text');
        if (liveTimerEl) {
            liveTimerEl.textContent = formatTime(activeStudyState.elapsedSeconds);
        }
    }, 1000);

    const modal = document.getElementById('modal-study-deck');
    if (modal) modal.style.display = 'flex';
}

function closeStudyModal() {
    clearInterval(deckTimerInterval);

    // Add deck timer duration to user study goal & XP upon exit!
    if (activeStudyState && activeStudyState.deck && activeStudyState.elapsedSeconds > 0) {
        const elapsedSec = activeStudyState.elapsedSeconds;
        const minutesForXp = Math.max(1, Math.ceil(elapsedSec / 60));
        const xpEarned = calculateRoomTimeXP(minutesForXp);

        recordCompletedStudySession(elapsedSec, `Flashcards: ${activeStudyState.deck.title}`);

        const timeLabel = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
        showXpToastNotification(`<i class="fi fi-sr-trophy" style="margin-right: 6px; color: #E9C46A;"></i> Session Logged! +${xpEarned} XP & ${timeLabel} added to Study Goal!`);
    }

    const modal = document.getElementById('modal-study-deck');
    if (modal) modal.style.display = 'none';

    activeStudyState.deck = null;
    activeStudyState.cardsQueue = [];
    activeStudyState.elapsedSeconds = 0;
    renderFlashcardsScreen();
}

function renderCurrentStudyCard() {
    const { cardsQueue, currentIndex, totalInitialCards } = activeStudyState;
    if (!cardsQueue || !cardsQueue[currentIndex]) return;

    const currentCard = cardsQueue[currentIndex];
    activeStudyState.isFlipped = false;

    // Reset 3D flip card visual
    const card3D = document.getElementById('flashcard-3d-card');
    if (card3D) card3D.classList.remove('flipped');

    // Content text elements
    const frontText = document.getElementById('flashcard-front-text');
    const backText = document.getElementById('flashcard-back-text');
    if (frontText) frontText.textContent = currentCard.front;
    if (backText) backText.textContent = currentCard.back;

    // Progress counter & bar
    const counterEl = document.getElementById('study-card-counter');
    const masteryEl = document.getElementById('study-mastery-count');
    const progressBar = document.getElementById('study-progress-bar');

    if (counterEl) counterEl.textContent = `Card ${currentIndex + 1} of ${cardsQueue.length}`;
    if (masteryEl) masteryEl.textContent = `Mastered: ${activeStudyState.masteredCount} / ${totalInitialCards}`;

    const percent = Math.min(100, Math.round(((currentIndex + 1) / cardsQueue.length) * 100));
    if (progressBar) progressBar.style.width = `${percent}%`;
}

function toggleStudyCardFlip() {
    activeStudyState.isFlipped = !activeStudyState.isFlipped;
    const card3D = document.getElementById('flashcard-3d-card');
    if (card3D) {
        if (activeStudyState.isFlipped) {
            card3D.classList.add('flipped');
        } else {
            card3D.classList.remove('flipped');
        }
    }
}

function gradeStudyCard(isMastered) {
    try {
        const { cardsQueue, currentIndex } = activeStudyState;
        if (!cardsQueue || !cardsQueue[currentIndex]) return;

        const currentCard = cardsQueue[currentIndex];

        if (isMastered) {
            currentCard.mastered = true;
            if (activeStudyState.deck && activeStudyState.deck.cards) {
                const origCard = activeStudyState.deck.cards.find(c => c.id === currentCard.id || c.front === currentCard.front);
                if (origCard) origCard.mastered = true;
            }

            // Post to MySQL database safely
            const cardDbId = currentCard.dbId || currentCard.id;
            if (cardDbId) {
                fetch(getApiUrl('/api/decks/card-mastered'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cardId: String(cardDbId), isMastered: true })
                }).catch(err => console.warn("Backend card mastery warning:", err.message));
            }
        }

        activeStudyState.masteredCount = cardsQueue.filter(c => c.mastered).length;
        saveFlashcardDecksToStorage();

        const unmasteredCards = cardsQueue.filter(c => !c.mastered);

        if (unmasteredCards.length === 0) {
            // All cards in deck mastered! Show summary view inside modal
            showStudySessionSummary();
        } else {
            // Advance to next card cleanly without duplicating or inflating cardsQueue
            let nextIndex = (currentIndex + 1) % cardsQueue.length;

            // If next card is already mastered, find next unmastered card
            let attempts = 0;
            while (cardsQueue[nextIndex].mastered && attempts < cardsQueue.length) {
                nextIndex = (nextIndex + 1) % cardsQueue.length;
                attempts++;
            }

            activeStudyState.currentIndex = nextIndex;
            renderCurrentStudyCard();
        }
    } catch (err) {
        console.error("Error grading study card:", err);
    }
}

function showStudySessionSummary() {
    // Freeze live timer on summary view
    clearInterval(deckTimerInterval);
    activeStudyState.isCompleted = true;

    const { deck, masteredCount, totalInitialCards, elapsedSeconds } = activeStudyState;
    const totalCards = totalInitialCards || (deck ? deck.cards.length : 0);

    const actualMins = Math.max(1, Math.ceil(elapsedSeconds / 60));
    const xpEarned = calculateRoomTimeXP(actualMins);

    const activeView = document.getElementById('study-active-view');
    const summaryView = document.getElementById('study-summary-view');
    if (activeView) activeView.style.display = 'none';
    if (summaryView) summaryView.style.display = 'block';

    const totalEl = document.getElementById('summary-total-cards');
    const masteredEl = document.getElementById('summary-mastered-cards');
    const xpEl = document.getElementById('summary-xp-earned');

    if (totalEl) totalEl.textContent = totalCards;
    if (masteredEl) masteredEl.textContent = masteredCount;
    if (xpEl) xpEl.textContent = `+${xpEarned} XP (${formatTime(elapsedSeconds)})`;
}

function nextStudyCard() {
    const { cardsQueue, currentIndex } = activeStudyState;
    if (!cardsQueue || cardsQueue.length === 0) return;

    activeStudyState.currentIndex = (currentIndex + 1) % cardsQueue.length;
    renderCurrentStudyCard();
}

function prevStudyCard() {
    const { cardsQueue, currentIndex } = activeStudyState;
    if (!cardsQueue || cardsQueue.length === 0) return;

    activeStudyState.currentIndex = (currentIndex - 1 + cardsQueue.length) % cardsQueue.length;
    renderCurrentStudyCard();
}

function attachFlashcardModalHandlers() {
    // Navigation Triggers
    const prevBtn = document.getElementById('btn-study-prev');
    if (prevBtn) {
        prevBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            prevStudyCard();
        };
    }

    const nextBtn = document.getElementById('btn-study-next');
    if (nextBtn) {
        nextBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            nextStudyCard();
        };
    }

    // Create Deck Modal
    const closeCreateBtn = document.getElementById('modal-close-create-deck-btn');
    const cancelCreateBtn = document.getElementById('btn-cancel-create-deck');
    if (closeCreateBtn) closeCreateBtn.onclick = closeCreateDeckModal;
    if (cancelCreateBtn) cancelCreateBtn.onclick = closeCreateDeckModal;

    const closeCreatedSuccessBtn = document.getElementById('btn-close-created-deck-modal');
    if (closeCreatedSuccessBtn) closeCreatedSuccessBtn.onclick = closeDeckCreatedSuccessModal;

    const addCardCreatedModalBtn = document.getElementById('btn-created-deck-add-card');
    if (addCardCreatedModalBtn) addCardCreatedModalBtn.onclick = handleAddCardFromCreatedModal;

    const createForm = document.getElementById('form-create-deck');
    if (createForm) {
        createForm.onsubmit = async (e) => {
            e.preventDefault();
            const title = document.getElementById('input-deck-title').value.trim();
            const subject = document.getElementById('input-deck-subject').value.trim() || 'General';
            const description = document.getElementById('input-deck-description').value.trim();

            if (!title) return;

            let newDeck = {
                id: `deck-${Date.now()}`,
                title: title,
                subject: subject,
                description: description,
                creatorEmail: AppState.user.email,
                cards: []
            };

            try {
                const response = await fetch(getApiUrl('/api/decks/create'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: AppState.user.email,
                        title: title,
                        subject: subject,
                        description: description
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.deck) {
                        newDeck = { ...data.deck, creatorEmail: AppState.user.email, cards: [] };
                    }
                }
            } catch (err) {
                console.warn("Backend deck create warning:", err.message);
            }

            AppState.flashcards.decks.unshift(newDeck);
            saveFlashcardDecksToStorage();
            closeCreateDeckModal();
            renderFlashcardsScreen();
            showXpToastNotification(`<i class="fi fi-rr-check" style="margin-right: 6px;"></i> Flashcard deck "${newDeck.title}" created successfully!`);

            // Prompt user with deck creation success pop-up modal
            openDeckCreatedSuccessModal(newDeck);
        };
    }

    // Add Card Modal
    const closeAddBtn = document.getElementById('modal-close-add-card-btn');
    const cancelAddBtn = document.getElementById('btn-cancel-add-card');
    if (closeAddBtn) closeAddBtn.onclick = closeAddCardModal;
    if (cancelAddBtn) cancelAddBtn.onclick = closeAddCardModal;

    const addCardForm = document.getElementById('form-add-card');
    if (addCardForm) {
        addCardForm.onsubmit = async (e) => {
            e.preventDefault();
            const deckId = document.getElementById('input-add-card-deck-id').value;
            const front = document.getElementById('input-card-front').value.trim();
            const back = document.getElementById('input-card-back').value.trim();

            if (!deckId || !front || !back) return;

            const deck = AppState.flashcards.decks.find(d => d.id === deckId || d.id == deckId || d.dbId == deckId || (d.dbId && `deck_${d.dbId}` === deckId));
            if (deck) {
                let newCard = {
                    id: `card-${Date.now()}`,
                    front: front,
                    back: back,
                    mastered: false
                };

                try {
                    const response = await fetch(getApiUrl('/api/decks/add-card'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deckId: deck.dbId || deck.id,
                            front: front,
                            back: back,
                            deckTitle: deck.title,
                            deckSubject: deck.subject,
                            email: AppState.user && AppState.user.email ? AppState.user.email : ''
                        })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.card) {
                            newCard = data.card;
                        }
                    }
                } catch (err) {
                    console.warn("Backend add card warning:", err.message);
                }

                if (!deck.cards) deck.cards = [];
                deck.cards.push(newCard);

                saveFlashcardDecksToStorage();
                closeAddCardModal();
                renderFlashcardsScreen();
                showXpToastNotification(`<i class="fi fi-rr-check" style="margin-right: 6px;"></i> Flashcard added to "${deck.title}"!`);
            }
        };
    }

    // Delete Deck Confirmation Modal
    const cancelDeleteBtn = document.getElementById('btn-cancel-delete-deck');
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete-deck');
    if (cancelDeleteBtn) cancelDeleteBtn.onclick = closeDeleteDeckModal;
    if (confirmDeleteBtn) confirmDeleteBtn.onclick = confirmDeleteDeck;

    // Study Modal Triggers
    const closeStudyBtn = document.getElementById('modal-close-study-btn');
    if (closeStudyBtn) {
        closeStudyBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            closeStudyModal();
        };
    }

    const finishStudyBtn = document.getElementById('btn-study-finish');
    if (finishStudyBtn) {
        finishStudyBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            closeStudyModal();
        };
    }

    const flipBtn = document.getElementById('btn-study-flip');
    if (flipBtn) {
        flipBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            toggleStudyCardFlip();
        };
    }

    const cardScene = document.getElementById('flashcard-3d-scene');
    if (cardScene) {
        cardScene.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            toggleStudyCardFlip();
        };
    }

    const reviewBtn = document.getElementById('btn-study-review');
    if (reviewBtn) {
        reviewBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            gradeStudyCard(false);
        };
    }

    const masteredBtn = document.getElementById('btn-study-mastered');
    if (masteredBtn) {
        masteredBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            gradeStudyCard(true);
        };
    }
}

/* Screen 5: Progress Screen */
function renderProgressScreen() {
    const totalSecs = AppState.user.todayStudySeconds || ((AppState.user.todayStudyMinutes || 0) * 60);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const totalHoursEl = document.getElementById('progress-total-hours');
    if (totalHoursEl) {
        if (hours > 0) totalHoursEl.textContent = `${hours}h ${mins}m`;
        else if (mins > 0) totalHoursEl.textContent = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        else totalHoursEl.textContent = `${secs}s`;
    }

    const streakEl = document.getElementById('progress-streak');
    if (streakEl) streakEl.textContent = `${AppState.user.streak || 1} Day${(AppState.user.streak || 1) === 1 ? '' : 's'}`;

    const xp = AppState.user.xp || 0;
    const xpEl = document.getElementById('progress-xp');
    if (xpEl) xpEl.textContent = `${xp.toLocaleString()}`;

    // Level Milestone details dynamically rendered based on real user XP
    const levelInfo = calculateUserLevel(xp);
    const levelTitleEl = document.getElementById('progress-level-title');
    const levelChipEl = document.getElementById('progress-level-chip');
    const xpBarEl = document.getElementById('progress-xp-bar');
    const percentEl = document.getElementById('progress-level-percent');
    const nextLevelEl = document.getElementById('progress-next-level');

    if (levelTitleEl) levelTitleEl.textContent = `Level ${levelInfo.level} · ${levelInfo.title}`;
    if (levelChipEl) levelChipEl.textContent = `${levelInfo.currentLevelXp} / 100 XP`;
    if (xpBarEl) xpBarEl.style.width = `${levelInfo.currentLevelXp}%`;
    if (percentEl) percentEl.textContent = `${levelInfo.currentLevelXp}% Completed`;
    if (nextLevelEl) nextLevelEl.textContent = `Next level: Level ${levelInfo.level + 1}`;

    // Week Offset & Date Range Calculation
    const weekOffset = AppState.progress.weekOffset || 0;
    const now = new Date();
    const jsDay = now.getDay();
    const currentDayIdx = jsDay === 0 ? 6 : jsDay - 1; // Map 0 (Mon) -> 6 (Sun)

    // Calculate Monday of the selected week
    const selectedMonday = new Date(now);
    selectedMonday.setDate(now.getDate() - currentDayIdx + (weekOffset * 7));

    const selectedSunday = new Date(selectedMonday);
    selectedSunday.setDate(selectedMonday.getDate() + 6);

    // Format week range label (e.g. "Aug 17 – Aug 23, 2026")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const startStr = `${monthNames[selectedMonday.getMonth()]} ${selectedMonday.getDate()}`;
    const endStr = `${monthNames[selectedSunday.getMonth()]} ${selectedSunday.getDate()}, ${selectedSunday.getFullYear()}`;
    const rangeLabelEl = document.getElementById('progress-week-range-label');
    if (rangeLabelEl) rangeLabelEl.textContent = `${startStr} – ${endStr}`;

    const weekBtnLabelEl = document.getElementById('btn-week-label');
    if (weekBtnLabelEl) {
        weekBtnLabelEl.textContent = weekOffset === 0 ? 'This Week' : (weekOffset === -1 ? 'Last Week' : `${weekOffset < 0 ? Math.abs(weekOffset) + 'w ago' : '+' + weekOffset + 'w'}`);
    }

    const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
    const targetGoalMins = AppState.user.dailyGoalMinutes || 25;
    const todayStr = now.toISOString().split('T')[0];

    const todayTotalSecs = AppState.user.todayStudySeconds || ((AppState.user.todayStudyMinutes || 0) * 60);
    const todayTotalMins = Math.round(todayTotalSecs / 60);

    // Load or initialize weekly minutes map from localStorage
    let weeklyMinutes = {};
    try {
        const stored = localStorage.getItem('bloom_weekly_minutes');
        if (stored) weeklyMinutes = JSON.parse(stored);
    } catch (e) {}

    weeklyMinutes[todayStr] = todayTotalMins;

    try {
        localStorage.setItem('bloom_weekly_minutes', JSON.stringify(weeklyMinutes));
    } catch (e) {}

    const weeklyData = dayLabels.map((dayLabel, idx) => {
        const d = new Date(selectedMonday);
        d.setDate(selectedMonday.getDate() + idx);
        const dateStr = d.toISOString().split('T')[0];
        const isToday = dateStr === todayStr;
        const minsStudied = weeklyMinutes[dateStr] || (isToday ? todayTotalMins : 0);
        const pct = Math.min(100, Math.round((minsStudied / targetGoalMins) * 100));
        return { day: dayLabel, dateStr: dateStr, minutes: minsStudied, percent: pct, isToday: isToday };
    });

    const chartContainer = document.getElementById('weekly-chart-bars');
    if (chartContainer) {
        chartContainer.innerHTML = weeklyData.map(item => `
            <div class="chart-col" title="${item.dateStr} (${item.day}): ${item.minutes}m studied (${item.percent}%)">
                <div class="chart-bar-wrap">
                    <div class="chart-bar" style="height: ${Math.max(item.minutes > 0 ? 8 : 0, item.percent)}%; background-color: ${item.isToday ? 'var(--primary-600)' : 'var(--primary-400)'};"></div>
                </div>
                <span class="chart-label" style="${item.isToday ? 'color: var(--primary-600); font-weight: 800;' : ''}">${item.day}</span>
            </div>
        `).join('');
    }

    // Attach Week Selector Button Handlers
    const prevWeekBtn = document.getElementById('btn-prev-week');
    if (prevWeekBtn) {
        prevWeekBtn.onclick = () => {
            AppState.progress.weekOffset = (AppState.progress.weekOffset || 0) - 1;
            renderProgressScreen();
        };
    }

    const nextWeekBtn = document.getElementById('btn-next-week');
    if (nextWeekBtn) {
        nextWeekBtn.onclick = () => {
            AppState.progress.weekOffset = (AppState.progress.weekOffset || 0) + 1;
            renderProgressScreen();
        };
    }

    const currentWeekBtn = document.getElementById('btn-current-week');
    if (currentWeekBtn) {
        currentWeekBtn.onclick = () => {
            openBloomCalendarModal();
        };
    }
}

let currentCalMonth = new Date();

function openBloomCalendarModal() {
    const modal = document.getElementById('modal-bloom-calendar');
    if (modal) {
        modal.style.display = 'flex';
        renderBloomCalendar(currentCalMonth);
    }
}

function closeBloomCalendarModal() {
    const modal = document.getElementById('modal-bloom-calendar');
    if (modal) modal.style.display = 'none';
}

function renderBloomCalendar(baseDate) {
    const monthTitle = document.getElementById('bloom-cal-month-title');
    const grid = document.getElementById('bloom-cal-grid');
    if (!grid) return;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();

    if (monthTitle) monthTitle.textContent = `${monthNames[month]} ${year}`;

    // Calculate Monday & Sunday of the currently selected progress week
    const now = new Date();
    const jsDay = now.getDay();
    const currentDayIdx = jsDay === 0 ? 6 : jsDay - 1;
    const weekOffset = AppState.progress.weekOffset || 0;

    const selectedMonday = new Date(now);
    selectedMonday.setDate(now.getDate() - currentDayIdx + (weekOffset * 7));
    selectedMonday.setHours(0, 0, 0, 0);

    const selectedSunday = new Date(selectedMonday);
    selectedSunday.setDate(selectedMonday.getDate() + 6);
    selectedSunday.setHours(23, 59, 59, 999);

    const todayStr = now.toISOString().split('T')[0];

    // Days in Month calculation
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayIdx = firstDayOfMonth.getDay() - 1;
    if (startDayIdx < 0) startDayIdx = 6;

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const daysInMonth = lastDayOfMonth.getDate();

    let html = '';

    // Prev month padding days
    for (let i = startDayIdx - 1; i >= 0; i--) {
        const pDay = prevMonthLastDay - i;
        const dObj = new Date(year, month - 1, pDay);
        const dStr = dObj.toISOString().split('T')[0];
        const inSelectedWeek = dObj >= selectedMonday && dObj <= selectedSunday;
        html += `<div class="bloom-cal-day other-month ${inSelectedWeek ? 'selected-week-day' : ''}" data-date="${dStr}">${pDay}</div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dObj = new Date(year, month, day);
        const dStr = dObj.toISOString().split('T')[0];
        const isToday = dStr === todayStr;
        const inSelectedWeek = dObj >= selectedMonday && dObj <= selectedSunday;

        let classes = 'bloom-cal-day';
        if (isToday) classes += ' today';
        if (inSelectedWeek) classes += ' selected-week-day';

        html += `<div class="${classes}" data-date="${dStr}">${day}</div>`;
    }

    // Next month padding days to fill grid rows
    const totalCells = startDayIdx + daysInMonth;
    const targetTotal = totalCells > 35 ? 42 : 35;
    for (let nextDay = 1; nextDay <= (targetTotal - totalCells); nextDay++) {
        const dObj = new Date(year, month + 1, nextDay);
        const dStr = dObj.toISOString().split('T')[0];
        const inSelectedWeek = dObj >= selectedMonday && dObj <= selectedSunday;
        html += `<div class="bloom-cal-day other-month ${inSelectedWeek ? 'selected-week-day' : ''}" data-date="${dStr}">${nextDay}</div>`;
    }

    grid.innerHTML = html;

    // Attach click listeners to calendar days
    grid.querySelectorAll('.bloom-cal-day').forEach(cell => {
        cell.onclick = () => {
            const dateStr = cell.getAttribute('data-date');
            if (!dateStr) return;
            const parts = dateStr.split('-');
            const pickedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (isNaN(pickedDate.getTime())) return;

            const diffMs = pickedDate.getTime() - now.getTime();
            const diffWeeks = Math.round(diffMs / (7 * 24 * 3600 * 1000));
            AppState.progress.weekOffset = diffWeeks;
            renderProgressScreen();
            closeBloomCalendarModal();
        };
    });

    // Month Navigation Buttons
    const prevMonthBtn = document.getElementById('bloom-cal-prev-month');
    if (prevMonthBtn) {
        prevMonthBtn.onclick = () => {
            currentCalMonth = new Date(year, month - 1, 1);
            renderBloomCalendar(currentCalMonth);
        };
    }

    const nextMonthBtn = document.getElementById('bloom-cal-next-month');
    if (nextMonthBtn) {
        nextMonthBtn.onclick = () => {
            currentCalMonth = new Date(year, month + 1, 1);
            renderBloomCalendar(currentCalMonth);
        };
    }

    const closeBtn = document.getElementById('modal-close-bloom-cal-btn');
    if (closeBtn) closeBtn.onclick = closeBloomCalendarModal;

    const doneBtn = document.getElementById('btn-bloom-cal-close');
    if (doneBtn) doneBtn.onclick = closeBloomCalendarModal;

    const todayBtn = document.getElementById('btn-bloom-cal-today');
    if (todayBtn) {
        todayBtn.onclick = () => {
            AppState.progress.weekOffset = 0;
            currentCalMonth = new Date();
            renderProgressScreen();
            closeBloomCalendarModal();
        };
    }
}

/* Edit Profile Modal Controller */
function openEditProfileModal() {
    const user = AppState.user;
    const nameInput = document.getElementById('input-edit-profile-name');
    const avatarPreview = document.getElementById('edit-profile-avatar-preview');

    if (nameInput) nameInput.value = user.name || '';
    if (avatarPreview) updateAvatarElement(avatarPreview, user);

    if (nameInput && avatarPreview) {
        nameInput.oninput = () => {
            const previewUser = {
                ...user,
                name: nameInput.value.trim() || user.name,
                avatar: nameInput.value.trim() ? nameInput.value.trim().charAt(0).toUpperCase() : 'U'
            };
            updateAvatarElement(avatarPreview, previewUser);
        };
    }

    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.style.display = 'flex';
}

function closeEditProfileModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('form-edit-profile');
    if (form) form.reset();
}

async function handleSaveProfile(e) {
    e.preventDefault();
    const nameInput = document.getElementById('input-edit-profile-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        alert("Please enter a valid display name.");
        return;
    }

    const saveBtn = document.getElementById('btn-save-edit-profile');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    AppState.user.name = name;
    AppState.user.avatar = name.charAt(0).toUpperCase();

    try {
        localStorage.setItem('bloom_auth_user', JSON.stringify(AppState.user));
    } catch (err) {}

    if (AppState.user.email) {
        try {
            await fetch(getApiUrl('/api/user/update-profile'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: AppState.user.email,
                    name: name,
                    photoUrl: AppState.user.photoUrl || null
                })
            });
        } catch (netErr) {
            console.warn("Offline profile save warning:", netErr.message);
        }
    }

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }

    closeEditProfileModal();

    renderHomeScreen();
    renderProfileScreen();
    updateAuthUI();
    showXpToastNotification("<i class=\"fi fi-rr-check\" style=\"margin-right: 6px;\"></i> Profile updated successfully!");
}

/* Screen 6: Profile Screen */
function renderProfileScreen() {
    const levelInfo = calculateUserLevel(AppState.user.xp || 0);

    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.textContent = AppState.user.name;

    const levelBadgeEl = document.getElementById('profile-level-badge');
    if (levelBadgeEl) levelBadgeEl.textContent = `Level ${levelInfo.level} ${levelInfo.title} • Member`;

    const avatarEl = document.getElementById('profile-avatar');
    updateAvatarElement(avatarEl, AppState.user);

    const xpEl = document.getElementById('profile-xp');
    if (xpEl) xpEl.textContent = `${(AppState.user.xp || 0).toLocaleString()} XP`;

    const streakEl = document.getElementById('profile-streak');
    if (streakEl) streakEl.textContent = `${AppState.user.streak || 1} Day${(AppState.user.streak || 1) === 1 ? '' : 's'}`;

    // Render Scholar Rank Tiers Roadmap List
    const ALL_TIERS = [
        { levelRange: "Level 1", title: "Novice Scholar", minXp: 0, maxXp: 99, icon: "fi-rr-user" },
        { levelRange: "Level 2", title: "Rising Scholar", minXp: 100, maxXp: 199, icon: "fi-rr-chart-histogram" },
        { levelRange: "Level 3–4", title: "Dedicated Learner", minXp: 200, maxXp: 399, icon: "fi-rr-book-alt" },
        { levelRange: "Level 5–6", title: "Expert Scholar", minXp: 400, maxXp: 599, icon: "fi-rr-graduation-cap" },
        { levelRange: "Level 7–9", title: "Focus Master", minXp: 600, maxXp: 899, icon: "fi-sr-flame" },
        { levelRange: "Level 10+", title: "Grand Master", minXp: 900, maxXp: Infinity, icon: "fi-sr-trophy" }
    ];

    const currentXp = AppState.user.xp || 0;
    const userLevel = levelInfo.level;

    const currentTierChip = document.getElementById('profile-current-tier-chip');
    if (currentTierChip) {
        currentTierChip.textContent = `Current: Level ${userLevel} · ${levelInfo.title}`;
    }

    const tierListContainer = document.getElementById('profile-tier-list');
    if (tierListContainer) {
        tierListContainer.innerHTML = ALL_TIERS.map(t => {
            const isCurrent = levelInfo.title === t.title;
            const isUnlocked = currentXp >= t.minXp;

            let badgeHtml = '';
            let borderStyle = '1px solid var(--border)';
            let bgStyle = 'var(--surface-card)';

            if (isCurrent) {
                borderStyle = '2px solid var(--primary-600)';
                bgStyle = 'rgba(82, 183, 136, 0.08)';
                badgeHtml = `<span class="chip chip-success" style="font-size: 0.72rem; font-weight: 700;"><i class="fi fi-sr-check" style="margin-right: 4px;"></i> Current Rank</span>`;
            } else if (isUnlocked) {
                badgeHtml = `<span class="chip chip-xp" style="font-size: 0.72rem; opacity: 0.85;"><i class="fi fi-rr-unlock" style="margin-right: 4px;"></i> Unlocked</span>`;
            } else {
                badgeHtml = `<span class="chip" style="font-size: 0.72rem; background: transparent; color: var(--text-tertiary); border: 1px solid var(--border);"><i class="fi fi-rr-lock" style="margin-right: 4px;"></i> Locked</span>`;
            }

            const xpReqStr = t.maxXp === Infinity ? `${t.minXp}+ XP` : `${t.minXp} - ${t.maxXp} XP`;

            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 12px; background: ${bgStyle}; border: ${borderStyle}; transition: all 0.2s ease;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: ${isCurrent ? 'var(--primary-600)' : (isUnlocked ? 'rgba(82,183,136,0.15)' : 'var(--surface-subtle)')}; color: ${isCurrent ? '#ffffff' : (isUnlocked ? 'var(--primary-600)' : 'var(--text-tertiary)')}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                            <i class="fi ${t.icon}"></i>
                        </div>
                        <div>
                            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${escapeHtml(t.title)} <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); opacity: 0.8;">(${t.levelRange})</span></div>
                            <div style="font-size: 0.78rem; color: var(--text-tertiary); margin-top: 1px;">Requirement: ${xpReqStr}</div>
                        </div>
                    </div>
                    <div>
                        ${badgeHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Edit Profile Triggers
    const openEditBtn = document.getElementById('btn-open-edit-profile');
    if (openEditBtn) openEditBtn.onclick = openEditProfileModal;

    const closeEditBtn = document.getElementById('modal-close-edit-profile-btn');
    const cancelEditBtn = document.getElementById('btn-cancel-edit-profile');
    if (closeEditBtn) closeEditBtn.onclick = closeEditProfileModal;
    if (cancelEditBtn) cancelEditBtn.onclick = closeEditProfileModal;

    const editProfileForm = document.getElementById('form-edit-profile');
    if (editProfileForm) editProfileForm.onsubmit = handleSaveProfile;

    // Theme Toggle Switch
    const themeToggle = document.getElementById('dark-mode-toggle');
    if (themeToggle) {
        themeToggle.checked = AppState.user.theme === 'dark';
        themeToggle.addEventListener('change', (e) => {
            toggleTheme(e.target.checked);
        });
    }
}

/* Shortcuts & Helper Handlers */
function attachEventHandlers() {
    // Start Focus Button on Home Screen
    const homeFocusBtn = document.getElementById('home-start-focus-btn');
    if (homeFocusBtn) {
        homeFocusBtn.addEventListener('click', () => {
            AppRouter.navigateTo('focus');
        });
    }

    // Flashcards Shortcut Card on Home Screen
    const homeFlashcardShortcut = document.getElementById('home-flashcard-shortcut');
    if (homeFlashcardShortcut) {
        homeFlashcardShortcut.addEventListener('click', () => {
            AppRouter.navigateTo('flashcards');
        });
    }

    // Mobile Center (+) Plus Button & Quick Nav Sheet Modal
    const quickAddBtn = document.getElementById('nav-quick-add-btn');
    const quickModal = document.getElementById('modal-nav-quick');
    const quickCloseBtn = document.getElementById('modal-close-quick-btn');

    if (quickAddBtn && quickModal) {
        quickAddBtn.addEventListener('click', (e) => {
            e.preventDefault();
            quickModal.style.display = 'flex';
        });
    }

    if (quickCloseBtn && quickModal) {
        quickCloseBtn.addEventListener('click', () => {
            quickModal.style.display = 'none';
        });
    }

    if (quickModal) {
        quickModal.addEventListener('click', (e) => {
            if (e.target === quickModal) {
                quickModal.style.display = 'none';
            }
        });
    }

    // Quick Nav Tiles inside Modal Sheet
    document.querySelectorAll('.quick-nav-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            const targetScreen = tile.getAttribute('data-nav-target');
            if (targetScreen) {
                if (quickModal) quickModal.style.display = 'none';
                AppRouter.navigateTo(targetScreen);
            }
        });
    });

    // Quick Creation Buttons inside Modal Sheet
    const quickCreateRoomBtn = document.getElementById('quick-action-create-room-btn');
    if (quickCreateRoomBtn) {
        quickCreateRoomBtn.addEventListener('click', () => {
            if (quickModal) quickModal.style.display = 'none';
            openCreateRoomModal();
        });
    }

    const quickCreateDeckBtn = document.getElementById('quick-action-create-deck-btn');
    if (quickCreateDeckBtn) {
        quickCreateDeckBtn.addEventListener('click', () => {
            if (quickModal) quickModal.style.display = 'none';
            openCreateDeckModal();
        });
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* Authentication & Google Auth Controller */
let isSignUpMode = false;

function updateAuthUI() {
    const { isLoggedIn, name, email, avatar, authProvider } = AppState.user;

    // Home Screen Greeting & Avatar
    const homeAvatar = document.getElementById('home-user-avatar');
    if (homeAvatar) homeAvatar.textContent = avatar;

    const homeGreeting = document.getElementById('home-greeting');
    if (homeGreeting) homeGreeting.textContent = `${AppState.user.greeting}, ${name}`;

    // Profile Screen Info
    const profileName = document.getElementById('profile-name');
    if (profileName) profileName.textContent = name;

    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) profileAvatar.textContent = avatar;

    // Profile Auth Card Elements
    const loggedInBox = document.getElementById('auth-status-logged-in');
    const loggedOutBox = document.getElementById('auth-status-logged-out');
    const userEmailEl = document.getElementById('auth-user-email');
    const badgeEl = document.getElementById('auth-provider-badge');

    if (isLoggedIn) {
        if (loggedInBox) loggedInBox.style.display = 'flex';
        if (loggedOutBox) loggedOutBox.style.display = 'none';
        if (userEmailEl) userEmailEl.textContent = email;
        if (badgeEl) {
            badgeEl.textContent = authProvider === 'google' ? 'Google Verified ✓' : 'Email Verified ✓';
        }
    } else {
        if (loggedInBox) loggedInBox.style.display = 'none';
        if (loggedOutBox) loggedOutBox.style.display = 'flex';
    }
}

function checkAuthGuard() {
    if (!AppState.user.isLoggedIn) {
        AppRouter.navigateTo('auth');
    }
}

function toggleAuthPageMode(signUp = false) {
    isSignUpMode = signUp;
    const titleEl = document.getElementById('auth-page-title');
    const subEl = document.getElementById('auth-page-sub');
    const nameGroup = document.getElementById('group-auth-name-page');
    const submitBtn = document.getElementById('btn-submit-auth-page');
    const toggleBtn = document.getElementById('btn-toggle-auth-mode-page');
    const googleBtn = document.getElementById('btn-google-auth-page');
    const dividerEl = document.querySelector('#screen-auth .auth-divider');

    if (isSignUpMode) {
        if (titleEl) titleEl.textContent = 'Create a Bloom Account';
        if (subEl) subEl.textContent = 'Sign up to track habits, earn XP, and study together.';
        if (nameGroup) nameGroup.style.display = 'block';
        if (submitBtn) submitBtn.textContent = 'Create Account';
        if (toggleBtn) toggleBtn.innerHTML = 'Already have an account? <strong style="color: var(--primary-600);">Sign in</strong>';
        
        // Hide Google Auth button & divider in Sign Up mode so the form stays short
        if (googleBtn) googleBtn.style.display = 'none';
        if (dividerEl) dividerEl.style.display = 'none';
    } else {
        if (titleEl) titleEl.textContent = 'Sign In to Bloom';
        if (subEl) subEl.textContent = 'Sync your study sessions, XP, and join rooms across all your devices.';
        if (nameGroup) nameGroup.style.display = 'none';
        if (submitBtn) submitBtn.textContent = 'Sign In';
        if (toggleBtn) toggleBtn.innerHTML = 'Don\'t have an account? <strong style="color: var(--primary-600);">Create one</strong>';
        
        // Show Google Auth button & divider in Sign In mode
        if (googleBtn) googleBtn.style.display = 'flex';
        if (dividerEl) dividerEl.style.display = 'flex';
    }
}

const RENDER_API_URL = 'https://bloom-j4ws.onrender.com';

function getApiUrl(endpoint) {
    // Inside Capacitor Android app, hostname is localhost with no port (port === '')
    if (window.Capacitor || (window.location.hostname === 'localhost' && window.location.port !== '5000' && window.location.port !== '3000')) {
        return `${RENDER_API_URL}${endpoint}`;
    }
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        const hostname = window.location.hostname || '';
        const port = window.location.port || '';
        if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '5000') {
            return endpoint;
        }
        if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '5000' && port !== '') {
            return `http://${hostname}:5000${endpoint}`;
        }
        return endpoint;
    }
    return `${RENDER_API_URL}${endpoint}`;
}

async function loginWithGoogleUser(userData) {
    const todayStr = new Date().toISOString().split('T')[0];
    const preservedSeconds = AppState.user.lastStudyDate === todayStr ? (AppState.user.todayStudySeconds || 0) : 0;
    const preservedMinutes = AppState.user.lastStudyDate === todayStr ? (AppState.user.todayStudyMinutes || 0) : 0;
    const preservedGoalMins = AppState.user.dailyGoalMinutes || 120;

    let userObj = {
        name: userData.name || "Google User",
        email: userData.email || "user@gmail.com",
        avatar: userData.avatar || (userData.name ? userData.name.charAt(0).toUpperCase() : "G"),
        isLoggedIn: true,
        authProvider: 'google',
        photoUrl: userData.photoUrl || null,
        xp: AppState.user.xp || 1250,
        streak: AppState.user.streak || 5,
        todayStudySeconds: preservedSeconds,
        todayStudyMinutes: preservedMinutes,
        lastStudyDate: todayStr,
        dailyGoalMinutes: preservedGoalMins
    };

    // Try posting to backend server if available
    try {
        const response = await fetch(getApiUrl('/api/auth/google'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                userObj = {
                    ...data.user,
                    todayStudySeconds: preservedSeconds,
                    todayStudyMinutes: preservedMinutes,
                    lastStudyDate: todayStr,
                    dailyGoalMinutes: preservedGoalMins,
                    isLoggedIn: true
                };
                if (data.token) localStorage.setItem('bloom_auth_token', data.token);
            }
        }
    } catch (e) {
        console.log("Backend server offline, using local Google auth session.");
    }

    Object.assign(AppState.user, userObj);
    try {
        localStorage.setItem('bloom_auth_user', JSON.stringify(AppState.user));
    } catch (e) {}

    const gSelectModal = document.getElementById('modal-google-accounts');
    if (gSelectModal) gSelectModal.style.display = 'none';

    updateAuthUI();
    renderHomeScreen();
    renderProfileScreen();
    AppRouter.navigateTo('home');

    // Display styled Welcome Pop-Up Modal
    showWelcomeUserModal(userObj);
}

function showWelcomeUserModal(userObj) {
    const welcomeAvatar = document.getElementById('welcome-user-avatar');
    const welcomeTitle = document.getElementById('welcome-user-title');
    const welcomeMsg = document.getElementById('welcome-user-message');
    const welcomeModal = document.getElementById('modal-welcome-user');
    const closeBtn = document.getElementById('btn-close-welcome-modal');

    if (welcomeAvatar) updateAvatarElement(welcomeAvatar, userObj);
    if (welcomeTitle) welcomeTitle.textContent = `Welcome, ${userObj.name}! 🌱`;
    if (welcomeMsg) welcomeMsg.textContent = `Your Google account (${userObj.email}) is connected. Ready to build focus habits, earn XP, and join live rooms?`;

    if (welcomeModal) welcomeModal.style.display = 'flex';
    if (closeBtn) {
        closeBtn.onclick = () => {
            if (welcomeModal) welcomeModal.style.display = 'none';
        };
    }
}

function logoutUser() {
    AppState.user.isLoggedIn = false;
    AppState.user.name = "Guest Student";
    AppState.user.email = "guest@bloom.app";
    AppState.user.avatar = "G";
    AppState.user.authProvider = null;

    try {
        localStorage.removeItem('bloom_auth_user');
        localStorage.removeItem('bloom_auth_token');
    } catch (e) {}

    updateAuthUI();
    renderHomeScreen();
    renderProfileScreen();
    AppRouter.navigateTo('auth');
    showXpToastNotification("👋 You have been signed out.");
}

let googleClientId = '';
let googleTokenClient = null;

async function initGoogleOAuth() {
    try {
        const res = await fetch(getApiUrl('/api/config/google-client-id'));
        if (res.ok) {
            const data = await res.json();
            googleClientId = data.clientId;
        }
    } catch (e) {}

    if (window.google && window.google.accounts && googleClientId && googleClientId.includes('.apps.googleusercontent.com')) {
        try {
            if (window.google.accounts.oauth2) {
                googleTokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: googleClientId,
                    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
                    callback: async (tokenResponse) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            try {
                                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                                });
                                const profile = await userInfoRes.json();
                                loginWithGoogleUser({
                                    email: profile.email,
                                    name: profile.name,
                                    photoUrl: profile.picture,
                                    avatar: profile.name ? profile.name.charAt(0).toUpperCase() : 'G'
                                });
                            } catch (err) {
                                console.error("Failed to fetch Google profile:", err);
                            }
                        }
                    }
                });
            }
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleCredentialResponse
            });
        } catch (e) {
            console.warn("Google Identity Services setup warning:", e);
        }
    }
}

function handleGoogleCredentialResponse(response) {
    try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const payload = JSON.parse(jsonPayload);
        
        loginWithGoogleUser({
            email: payload.email,
            name: payload.name,
            photoUrl: payload.picture,
            avatar: payload.name ? payload.name.charAt(0).toUpperCase() : 'G'
        });
    } catch (e) {
        console.error("Error decoding Google credential:", e);
    }
}

function attachAuthHandlers() {
    // Initialize Google OAuth SDK if configured
    initGoogleOAuth();

    // Open Auth Page Buttons
    const openLoginBtn = document.getElementById('btn-open-login');
    if (openLoginBtn) openLoginBtn.onclick = () => AppRouter.navigateTo('auth');

    const signOutBtn = document.getElementById('btn-sign-out');
    if (signOutBtn) signOutBtn.onclick = logoutUser;

    const toggleAuthModeBtn = document.getElementById('btn-toggle-auth-mode-page');
    if (toggleAuthModeBtn) {
        toggleAuthModeBtn.onclick = () => toggleAuthPageMode(!isSignUpMode);
    }

    // Google Auth Button Handler
    const googleAuthBtn = document.getElementById('btn-google-auth-page');
    const gSelectModal = document.getElementById('modal-google-accounts');
    const cancelGSelectBtn = document.getElementById('btn-cancel-google-select');

    if (googleAuthBtn) {
        googleAuthBtn.onclick = () => {
            if (googleTokenClient) {
                googleTokenClient.requestAccessToken();
                return;
            }
            if (window.google && window.google.accounts && window.google.accounts.id && googleClientId && googleClientId.includes('.apps.googleusercontent.com')) {
                try {
                    window.google.accounts.id.prompt((notification) => {
                        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                            if (gSelectModal) gSelectModal.style.display = 'flex';
                        }
                    });
                    return;
                } catch (e) {}
            }
            if (googleClientId && googleClientId.includes('.apps.googleusercontent.com')) {
                const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
                window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=token&scope=email%20profile`;
                return;
            }
            if (gSelectModal) gSelectModal.style.display = 'flex';
        };
    }

    if (cancelGSelectBtn && gSelectModal) {
        cancelGSelectBtn.onclick = () => {
            gSelectModal.style.display = 'none';
        };
    }

    // Custom Google Account Modal Handlers
    const customGModal = document.getElementById('modal-custom-google-login');
    const closeCustomGBtn = document.getElementById('modal-close-custom-google-btn');
    const cancelCustomGBtn = document.getElementById('btn-cancel-custom-google');
    const customGForm = document.getElementById('form-custom-google-login');

    const closeCustomGModal = () => {
        if (customGModal) customGModal.style.display = 'none';
        if (customGForm) customGForm.reset();
    };

    if (closeCustomGBtn) closeCustomGBtn.onclick = closeCustomGModal;
    if (cancelCustomGBtn) cancelCustomGBtn.onclick = closeCustomGModal;

    if (customGForm) {
        customGForm.onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('input-custom-google-name').value.trim();
            const email = document.getElementById('input-custom-google-email').value.trim();
            if (name && email) {
                closeCustomGModal();
                loginWithGoogleUser({
                    email,
                    name,
                    avatar: name.charAt(0).toUpperCase()
                });
            }
        };
    }

    // Google Account Tile click selection
    document.querySelectorAll('.google-account-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            const email = tile.getAttribute('data-google-email');
            if (email === 'custom') {
                if (gSelectModal) gSelectModal.style.display = 'none';
                if (customGModal) customGModal.style.display = 'flex';
            } else if (email) {
                const name = tile.getAttribute('data-google-name');
                const avatar = tile.getAttribute('data-google-avatar');
                loginWithGoogleUser({ email, name, avatar });
            }
        });
    });
}
