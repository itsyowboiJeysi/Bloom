const savedAuthUser = (() => {
    try {
        const item = localStorage.getItem('bloom_auth_user');
        return item ? JSON.parse(item) : null;
    } catch (e) {
        return null;
    }
})();

const savedFlashcards = (() => {
    try {
        const item = localStorage.getItem('bloom_flashcard_decks');
        return item ? JSON.parse(item) : null;
    } catch (e) {
        return null;
    }
})();

const defaultDecks = [
    {
        id: 'deck-bio-1',
        title: 'Cell Biology Essentials',
        subject: 'Biology',
        description: 'Key structures and organelles of eukaryotic & prokaryotic cells.',
        cards: [
            { id: 'c1', front: 'What is the primary function of the Mitochondria?', back: 'Generates ATP (energy) for cellular activity via cellular respiration.', mastered: false },
            { id: 'c2', front: 'What organelle is responsible for protein synthesis?', back: 'Ribosomes (found free floating or attached to Rough ER).', mastered: false },
            { id: 'c3', front: 'What is the role of the Lysosome?', back: 'Contains digestive enzymes to break down waste materials and cellular debris.', mastered: false },
            { id: 'c4', front: 'Define selective permeability in cell membranes.', back: 'The property that allows certain molecules to pass while blocking others.', mastered: false }
        ]
    },
    {
        id: 'deck-cs-1',
        title: 'Data Structures & Algorithms',
        subject: 'Computer Science',
        description: 'Core Big-O time complexities and data structure fundamentals.',
        cards: [
            { id: 'c5', front: 'What is the average time complexity of QuickSort?', back: 'O(n log n)', mastered: false },
            { id: 'c6', front: 'What data structure operates on a LIFO (Last In First Out) basis?', back: 'Stack', mastered: false },
            { id: 'c7', front: 'What is the worst-case lookup time in a balanced BST?', back: 'O(log n)', mastered: false }
        ]
    },
    {
        id: 'deck-span-1',
        title: 'Spanish Conversational Basics',
        subject: 'Languages',
        description: 'Common verbs, greetings, and daily vocabulary phrases.',
        cards: [
            { id: 'c8', front: 'How do you say "Nice to meet you" in Spanish?', back: 'Mucho gusto / Encantado(a)', mastered: false },
            { id: 'c9', front: 'What does the verb "Estudiar" mean?', back: 'To study', mastered: false }
        ]
    }
];

const todayDateStr = new Date().toISOString().split('T')[0];
const isSameDayStudy = savedAuthUser && savedAuthUser.lastStudyDate === todayDateStr;

const AppState = {
    user: {
        name: savedAuthUser ? savedAuthUser.name : "Student",
        email: savedAuthUser ? savedAuthUser.email : "",
        greeting: "Welcome",
        avatar: savedAuthUser ? savedAuthUser.avatar : "S",
        isLoggedIn: savedAuthUser ? true : false,
        authProvider: savedAuthUser ? savedAuthUser.authProvider : null, // 'google' or 'email'
        photoUrl: savedAuthUser ? savedAuthUser.photoUrl : null,
        xp: savedAuthUser ? (savedAuthUser.xp !== undefined ? savedAuthUser.xp : 0) : 0,
        streak: savedAuthUser ? (savedAuthUser.streak !== undefined ? savedAuthUser.streak : 1) : 1,
        lastLoginDate: savedAuthUser ? (savedAuthUser.lastLoginDate || localStorage.getItem('bloom_last_login_date')) : localStorage.getItem('bloom_last_login_date'),
        dailyGoalMinutes: savedAuthUser && savedAuthUser.dailyGoalMinutes ? savedAuthUser.dailyGoalMinutes : 120,
        todayStudySeconds: isSameDayStudy ? (savedAuthUser.todayStudySeconds || ((savedAuthUser.todayStudyMinutes || 0) * 60)) : 0,
        todayStudyMinutes: isSameDayStudy ? (savedAuthUser.todayStudyMinutes || 0) : 0,
        lastStudyDate: savedAuthUser ? (savedAuthUser.lastStudyDate || todayDateStr) : todayDateStr,
        theme: localStorage.getItem('bloom_theme') || 'light'
    },

    focus: {
        studyMinutes: 25,
        breakMinutes: 5,
        currentMode: 'study', // 'study' or 'break'
        defaultDurationSeconds: 25 * 60,
        secondsRemaining: 25 * 60,
        isRunning: false,
        isPaused: false,
        timerInterval: null
    },

    recentSessions: [],

    flashcards: {
        decks: savedFlashcards || defaultDecks
    },

    progress: {
        totalStudyHours: "0 hrs",
        weekOffset: 0,
        weeklyData: [
            { day: "M", minutes: 0, percent: 0 },
            { day: "T", minutes: 0, percent: 0 },
            { day: "W", minutes: 0, percent: 0 },
            { day: "T", minutes: 0, percent: 0 },
            { day: "F", minutes: 0, percent: 0 },
            { day: "S", minutes: 0, percent: 0 },
            { day: "S", minutes: 0, percent: 0 }
        ]
    },

    rooms: {
        activeRoom: null,
        publicRooms: [],
        privateRooms: []
    }
};

window.AppState = AppState;
