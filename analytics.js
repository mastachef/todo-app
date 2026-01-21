// Analytics Page
class Analytics {
    constructor() {
        this.API_BASE = '/.netlify/functions';
        this.tasks = [];
        this.lists = [];
        this.isOnline = false;
        this.authToken = null;

        this.loadTheme();
        this.bindThemeToggle();
        this.init();
    }

    async init() {
        this.loadAuthToken();
        if (this.authToken) {
            await this.loadOnlineData();
        } else {
            this.loadOfflineData();
        }
        this.renderAnalytics();
    }

    loadAuthToken() {
        this.authToken = localStorage.getItem('taskManager_authToken');
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
        };
    }

    async loadOnlineData() {
        try {
            const [tasksRes, listsRes] = await Promise.all([
                fetch(`${this.API_BASE}/api-tasks`, { headers: this.getAuthHeaders() }),
                fetch(`${this.API_BASE}/api-lists`, { headers: this.getAuthHeaders() })
            ]);

            if (tasksRes.ok && listsRes.ok) {
                this.tasks = await tasksRes.json();
                this.lists = await listsRes.json();
                this.isOnline = true;
            } else {
                // Fall back to offline
                this.loadOfflineData();
            }
        } catch (e) {
            console.error('Failed to load online data:', e);
            this.loadOfflineData();
        }
    }

    loadOfflineData() {
        const stored = localStorage.getItem('taskManager_data');
        if (stored) {
            const data = JSON.parse(stored);
            this.tasks = data.tasks || [];
            this.lists = data.lists || [];
        }
        this.isOnline = false;
    }

    loadTheme() {
        const saved = localStorage.getItem('taskManager_theme');
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    bindThemeToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
                localStorage.setItem('taskManager_theme', isDark ? 'light' : 'dark');
            });
        }
    }

    getStats() {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const completedTasks = this.tasks.filter(t => t.completed);
        const activeTasks = this.tasks.filter(t => !t.completed);

        // Completed today/week/month
        const completedToday = completedTasks.filter(t => {
            if (!t.completed_at) return false;
            return new Date(t.completed_at) >= todayStart;
        }).length;

        const completedThisWeek = completedTasks.filter(t => {
            if (!t.completed_at) return false;
            return new Date(t.completed_at) >= weekStart;
        }).length;

        const completedThisMonth = completedTasks.filter(t => {
            if (!t.completed_at) return false;
            return new Date(t.completed_at) >= monthStart;
        }).length;

        // Completion rate
        const totalTasks = this.tasks.length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

        // By priority
        const byPriority = {
            high: this.tasks.filter(t => t.priority === 'high').length,
            medium: this.tasks.filter(t => t.priority === 'medium').length,
            low: this.tasks.filter(t => t.priority === 'low').length,
            none: this.tasks.filter(t => !t.priority || t.priority === 'none').length
        };

        // By list
        const byList = this.lists.map(list => ({
            name: list.name,
            count: this.tasks.filter(t => String(t.list_id) === String(list.id)).length
        })).sort((a, b) => b.count - a.count);

        return {
            total: totalTasks,
            active: activeTasks.length,
            completed: completedTasks.length,
            completedToday,
            completedThisWeek,
            completedThisMonth,
            completionRate,
            byPriority,
            byList
        };
    }

    renderAnalytics() {
        const stats = this.getStats();
        const maxPriority = Math.max(...Object.values(stats.byPriority), 1);
        const maxList = Math.max(...stats.byList.map(l => l.count), 1);

        const content = document.getElementById('analytics-content');
        content.innerHTML = `
            <!-- Stats Cards -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.completedToday}</div>
                    <div class="stat-label">Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.completedThisWeek}</div>
                    <div class="stat-label">This Week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.completedThisMonth}</div>
                    <div class="stat-label">This Month</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">Total Tasks</div>
                </div>
            </div>

            <!-- Completion Rate -->
            <div class="chart-section">
                <h3 class="chart-title">Completion Rate</h3>
                <div class="completion-rate">
                    <div class="rate-circle">
                        <svg viewBox="0 0 36 36">
                            <circle class="rate-circle-bg" cx="18" cy="18" r="16"/>
                            <circle class="rate-circle-fill" cx="18" cy="18" r="16"
                                stroke-dasharray="${stats.completionRate}, 100"/>
                        </svg>
                        <div class="rate-text">
                            <span class="rate-value">${stats.completionRate}%</span>
                            <span class="rate-label">Complete</span>
                        </div>
                    </div>
                    <div class="rate-details">
                        <div class="rate-detail-item">
                            <strong>${stats.completed}</strong> completed tasks
                        </div>
                        <div class="rate-detail-item">
                            <strong>${stats.active}</strong> active tasks
                        </div>
                        <div class="rate-detail-item">
                            <strong>${stats.total}</strong> total tasks
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tasks by Priority -->
            <div class="chart-section">
                <h3 class="chart-title">Tasks by Priority</h3>
                <div class="bar-chart">
                    <div class="bar-row">
                        <span class="bar-label">High</span>
                        <div class="bar-container">
                            <div class="bar-fill priority-high" style="width: ${(stats.byPriority.high / maxPriority) * 100}%"></div>
                        </div>
                        <span class="bar-value">${stats.byPriority.high}</span>
                    </div>
                    <div class="bar-row">
                        <span class="bar-label">Medium</span>
                        <div class="bar-container">
                            <div class="bar-fill priority-medium" style="width: ${(stats.byPriority.medium / maxPriority) * 100}%"></div>
                        </div>
                        <span class="bar-value">${stats.byPriority.medium}</span>
                    </div>
                    <div class="bar-row">
                        <span class="bar-label">Low</span>
                        <div class="bar-container">
                            <div class="bar-fill priority-low" style="width: ${(stats.byPriority.low / maxPriority) * 100}%"></div>
                        </div>
                        <span class="bar-value">${stats.byPriority.low}</span>
                    </div>
                    <div class="bar-row">
                        <span class="bar-label">None</span>
                        <div class="bar-container">
                            <div class="bar-fill priority-none" style="width: ${(stats.byPriority.none / maxPriority) * 100}%"></div>
                        </div>
                        <span class="bar-value">${stats.byPriority.none}</span>
                    </div>
                </div>
            </div>

            <!-- Tasks by List -->
            ${stats.byList.length > 0 ? `
            <div class="chart-section">
                <h3 class="chart-title">Tasks by List</h3>
                <div class="bar-chart">
                    ${stats.byList.slice(0, 5).map(list => `
                        <div class="bar-row">
                            <span class="bar-label" title="${this.escapeHTML(list.name)}">${this.escapeHTML(list.name.substring(0, 10))}${list.name.length > 10 ? '...' : ''}</span>
                            <div class="bar-container">
                                <div class="bar-fill list" style="width: ${(list.count / maxList) * 100}%"></div>
                            </div>
                            <span class="bar-value">${list.count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        `;
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Analytics();
});
