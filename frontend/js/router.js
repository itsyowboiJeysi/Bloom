/**
 * Bloom Client-Side Router
 */
const AppRouter = {
    currentScreen: 'home',

    init() {
        // Attach click handlers to bottom navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetScreen = item.getAttribute('data-screen');
                if (targetScreen) {
                    this.navigateTo(targetScreen);
                }
            });
        });

        // Initialize screen based on current state
        this.navigateTo('home');
    },

    navigateTo(screenId) {
        const screens = document.querySelectorAll('.screen');
        const navItems = document.querySelectorAll('.nav-item');
        const bottomNav = document.querySelector('.bottom-nav');

        let targetFound = false;

        screens.forEach(screen => {
            if (screen.id === `screen-${screenId}`) {
                screen.classList.add('active');
                targetFound = true;
            } else {
                screen.classList.remove('active');
            }
        });

        if (!targetFound) return;

        this.currentScreen = screenId;

        // Show / Hide bottom navbar depending on auth screen state
        if (bottomNav) {
            if (screenId === 'auth') {
                bottomNav.style.display = 'none';
            } else {
                bottomNav.style.display = '';
            }
        }

        // Update bottom navigation bar active state
        navItems.forEach(item => {
            if (item.getAttribute('data-screen') === screenId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Scroll screen container back to top
        const container = document.querySelector('.screen-container');
        if (container) container.scrollTop = 0;

        // Synchronize live screen stats
        if (typeof renderHomeScreen === 'function') renderHomeScreen();
        if (typeof renderProfileScreen === 'function') renderProfileScreen();
        if (typeof renderProgressScreen === 'function') renderProgressScreen();
    }
};

window.AppRouter = AppRouter;
