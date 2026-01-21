// Task Manager Application - Supports offline (localStorage) and online (API) modes
class TaskManager {
    constructor() {
        this.user = null;
        this.isOnline = false;
        this.lists = [];
        this.tasks = [];
        this.currentListId = null;
        this.currentTaskId = null;
        this.currentPriority = 'none';
        this.currentSort = 'newest';
        this.editingListId = null;
        this.authToken = null;

        // Undo functionality
        this.undoStack = [];

        // Bulk selection mode
        this.selectionMode = false;
        this.selectedTasks = new Set();

        // Focus mode & timer
        this.focusModeActive = false;
        this.timerInterval = null;
        this.timerSeconds = 25 * 60;
        this.timerRunning = false;
        this.isBreakTime = false;

        // Subtasks
        this.subtasks = {}; // Keyed by task_id

        // Use Netlify Functions
        this.API_BASE = '/.netlify/functions';
        
        this.cacheDOM();
        this.init();
    }
    
    cacheDOM() {
        // Auth elements
        this.authContainer = document.getElementById('auth-container');
        this.appContainer = document.getElementById('app-container');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.authError = document.getElementById('auth-error');
        this.authSuccess = document.getElementById('auth-success');
        this.authTabs = document.querySelectorAll('.auth-tab');
        this.authSkip = document.getElementById('auth-skip');
        
        // App elements
        this.newTaskInput = document.getElementById('new-task-input');
        this.activeTasksList = document.getElementById('active-tasks');
        this.completedTasksList = document.getElementById('completed-tasks');
        this.activeCount = document.getElementById('active-count');
        this.completedCount = document.getElementById('completed-count');
        this.completedSection = document.getElementById('completed-section');
        this.completedHeader = document.getElementById('completed-header');
        this.documentTitle = document.querySelector('.document-title');
        this.listTabs = document.getElementById('list-tabs');
        this.syncStatus = document.getElementById('sync-status');
        
        // Theme & User
        this.themeToggle = document.getElementById('theme-toggle');
        this.userMenuBtn = document.getElementById('user-menu-btn');
        this.userMenu = document.getElementById('user-menu');
        this.userInfo = document.getElementById('user-info');
        this.logoutBtn = document.getElementById('logout-btn');
        this.enableNotificationsBtn = document.getElementById('enable-notifications');
        this.notificationsBtnText = document.getElementById('notifications-btn-text');
        
        // Sort
        this.sortBtn = document.getElementById('sort-btn');
        this.sortMenu = document.getElementById('sort-menu');
        this.sortLabel = document.getElementById('sort-label');

        // Search
        this.searchBtn = document.getElementById('search-btn');
        this.searchModal = document.getElementById('search-modal');
        this.searchModalClose = document.getElementById('search-modal-close');
        this.searchInput = document.getElementById('search-input');
        this.searchClear = document.getElementById('search-clear');
        this.searchResultsHeader = document.getElementById('search-results-header');
        this.searchResultsList = document.getElementById('search-results-list');
        this.searchResultsCount = document.getElementById('search-results-count');
        
        // Task Modal
        this.taskModal = document.getElementById('task-modal');
        this.modalClose = document.getElementById('modal-close');
        this.modalCheckbox = document.getElementById('modal-checkbox');
        this.modalTaskText = document.getElementById('modal-task-text');
        this.modalMeta = document.getElementById('modal-meta');
        this.modalNotes = document.getElementById('modal-notes');
        this.modalDelete = document.getElementById('modal-delete');
        this.modalSave = document.getElementById('modal-save');
        this.reminderTime = document.getElementById('reminder-time');
        this.reminderRepeat = document.getElementById('reminder-repeat');
        this.recurrenceSelect = document.getElementById('recurrence-select');
        this.clearReminder = document.getElementById('clear-reminder');
        
        // List Modal
        this.listModal = document.getElementById('list-modal');
        this.listModalClose = document.getElementById('list-modal-close');
        this.listModalTitle = document.getElementById('list-modal-title');
        this.listNameInput = document.getElementById('list-name-input');
        this.listDelete = document.getElementById('list-delete');
        this.listSave = document.getElementById('list-save');

        // Bulk Selection
        this.bulkSelectBtn = document.getElementById('bulk-select-btn');
        this.bulkActionBar = document.getElementById('bulk-action-bar');
        this.bulkCancelBtn = document.getElementById('bulk-cancel-btn');
        this.bulkCount = document.getElementById('bulk-count');
        this.bulkCompleteBtn = document.getElementById('bulk-complete-btn');
        this.bulkMoveBtn = document.getElementById('bulk-move-btn');
        this.bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        this.bulkMoveModal = document.getElementById('bulk-move-modal');
        this.bulkMoveModalClose = document.getElementById('bulk-move-modal-close');
        this.bulkMoveList = document.getElementById('bulk-move-list');

        // Focus Mode
        this.focusModeBtn = document.getElementById('focus-mode-btn');
        this.focusOverlay = document.getElementById('focus-overlay');
        this.focusClose = document.getElementById('focus-close');
        this.focusTasksList = document.getElementById('focus-tasks-list');
        this.focusEmpty = document.getElementById('focus-empty');
        this.focusToggle = document.getElementById('focus-toggle');

        // Timer
        this.timerDisplay = document.getElementById('timer-display');
        this.timerLabel = document.getElementById('timer-label');
        this.timerStart = document.getElementById('timer-start');
        this.timerPause = document.getElementById('timer-pause');
        this.timerReset = document.getElementById('timer-reset');
        this.workDuration = document.getElementById('work-duration');
        this.breakDuration = document.getElementById('break-duration');

        // Subtasks
        this.subtasksList = document.getElementById('subtasks-list');
        this.subtaskInput = document.getElementById('subtask-input');
        this.subtaskAddBtn = document.getElementById('subtask-add-btn');
        this.subtaskProgress = document.getElementById('subtask-progress');
        this.subtaskProgressFill = document.getElementById('subtask-progress-fill');
        this.subtaskProgressText = document.getElementById('subtask-progress-text');
    }
    
    async init() {
        this.loadTheme();
        this.loadAuthToken();
        await this.checkAuth();
        this.bindEvents();
        await this.registerServiceWorker();
        this.updateNotificationButtonState();
        this.startReminderChecker();
    }
    
    // ============ AUTH TOKEN MANAGEMENT ============
    
    loadAuthToken() {
        this.authToken = localStorage.getItem('taskManager_authToken');
    }
    
    saveAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem('taskManager_authToken', token);
        } else {
            localStorage.removeItem('taskManager_authToken');
        }
    }
    
    getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        return headers;
    }
    
    // ============ AUTH ============
    
    async checkAuth() {
        if (!this.authToken) {
            this.showAuth();
            return;
        }
        
        try {
            const res = await fetch(`${this.API_BASE}/auth-me`, {
                headers: this.getAuthHeaders()
            });
            const data = await res.json();
            
            if (data.user) {
                this.user = data.user;
                this.isOnline = true;
                this.showApp();
                await this.loadFromServer();
            } else {
                // Token invalid or expired
                this.saveAuthToken(null);
                this.showAuth();
            }
        } catch (e) {
            // Server not available, show auth with skip option
            this.showAuth();
        }
    }
    
    showAuth() {
        this.authContainer.style.display = 'flex';
        this.appContainer.style.display = 'none';
    }
    
    showApp() {
        this.authContainer.style.display = 'none';
        this.appContainer.style.display = 'flex';
        
        if (this.user) {
            this.userInfo.textContent = this.user.email;
            this.syncStatus.textContent = 'Synced';
        } else {
            this.userInfo.textContent = 'Offline Mode';
            this.syncStatus.textContent = 'Local only';
        }
    }
    
    async login(email, password) {
        this.authError.textContent = '';
        this.authSuccess.textContent = '';
        
        try {
            const res = await fetch(`${this.API_BASE}/auth-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (res.ok && data.token) {
                this.saveAuthToken(data.token);
                this.user = data.user;
                this.isOnline = true;
                this.showApp();
                await this.loadFromServer();
            } else {
                this.authError.textContent = data.error || 'Login failed';
            }
        } catch (e) {
            this.authError.textContent = 'Server unavailable';
        }
    }
    
    async register(email, password, name) {
        this.authError.textContent = '';
        this.authSuccess.textContent = '';
        
        try {
            const res = await fetch(`${this.API_BASE}/auth-register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            const data = await res.json();
            
            if (res.ok && data.token) {
                this.saveAuthToken(data.token);
                this.user = data.user;
                this.isOnline = true;
                this.showApp();
                await this.loadFromServer();
            } else {
                this.authError.textContent = data.error || 'Registration failed';
            }
        } catch (e) {
            this.authError.textContent = 'Server unavailable';
        }
    }
    
    async logout() {
        try {
            await fetch(`${this.API_BASE}/auth-logout`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
        } catch (e) {}
        this.saveAuthToken(null);
        this.user = null;
        this.isOnline = false;
        this.lists = [];
        this.tasks = [];
        this.showAuth();
    }
    
    skipAuth() {
        this.isOnline = false;
        this.loadFromLocalStorage();
        this.showApp();
    }
    
    // ============ DATA LOADING ============
    
    async loadFromServer() {
        try {
            const [listsRes, tasksRes] = await Promise.all([
                fetch(`${this.API_BASE}/api-lists`, { headers: this.getAuthHeaders() }),
                fetch(`${this.API_BASE}/api-tasks`, { headers: this.getAuthHeaders() })
            ]);
            
            if (!listsRes.ok || !tasksRes.ok) {
                // If 401, token expired
                if (listsRes.status === 401 || tasksRes.status === 401) {
                    console.log('Token expired, switching to offline mode');
                    this.saveAuthToken(null);
                    this.isOnline = false;
                    this.user = null;
                    this.loadFromLocalStorage();
                    this.showApp();
                    return;
                }
                throw new Error('Unauthorized or server error');
            }
            
            const listsData = await listsRes.json();
            const tasksData = await tasksRes.json();
            
            // Ensure they are arrays before assigning
            this.lists = Array.isArray(listsData) ? listsData : [];
            this.tasks = Array.isArray(tasksData) ? tasksData : [];
            
            // Normalize completed field and list_id
            this.tasks = this.tasks.map(t => ({
                ...t,
                completed: !!t.completed,
                list_id: Number(t.list_id)
            }));
            
            // Normalize list IDs as well
            this.lists = this.lists.map(l => ({
                ...l,
                id: Number(l.id)
            }));
            
            // Normalize currentListId
            if (this.currentListId !== null) {
                this.currentListId = Number(this.currentListId);
            }
            
            if (this.lists.length === 0) {
                await this.createList('My Tasks');
            }

            // Apply saved list order
            this.applyListOrder();

            this.currentListId = Number(this.lists[0]?.id);
            this.updateTitle();
            this.renderTabs();
            this.render();
        } catch (e) {
            console.error('Failed to load from server:', e);
            // Fallback to offline mode
            this.isOnline = false;
            if (!Array.isArray(this.tasks)) this.tasks = [];
            this.loadFromLocalStorage();
            this.showApp();
        }
    }
    
    loadFromLocalStorage() {
        const stored = localStorage.getItem('taskManager_data');
        if (stored) {
            const data = JSON.parse(stored);
            this.lists = data.lists || [];
            this.tasks = data.tasks || [];
            this.currentListId = data.currentListId;
        }

        if (this.lists.length === 0) {
            const defaultList = { id: this.generateId(), name: 'My Tasks' };
            this.lists.push(defaultList);
            this.currentListId = defaultList.id;
            this.saveToLocalStorage();
        }

        // Apply saved list order
        this.applyListOrder();

        if (!this.lists.find(l => String(l.id) === String(this.currentListId))) {
            this.currentListId = this.lists[0]?.id;
        }

        this.updateTitle();
        this.renderTabs();
        this.render();
    }
    
    saveToLocalStorage() {
        localStorage.setItem('taskManager_data', JSON.stringify({
            lists: this.lists,
            tasks: this.tasks,
            currentListId: this.currentListId
        }));
    }
    
    // ============ THEME ============
    
    loadTheme() {
        const savedTheme = localStorage.getItem('taskManager_theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
    
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('taskManager_theme', newTheme);
    }
    
    // ============ EVENT BINDINGS ============
    
    bindEvents() {
        // Auth
        this.authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loginForm.style.display = tab.dataset.tab === 'login' ? 'flex' : 'none';
                this.registerForm.style.display = tab.dataset.tab === 'register' ? 'flex' : 'none';
                this.authError.textContent = '';
            });
        });
        
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const form = new FormData(this.loginForm);
            this.login(form.get('email'), form.get('password'));
        });
        
        this.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const form = new FormData(this.registerForm);
            this.register(form.get('email'), form.get('password'), form.get('name'));
        });
        
        this.authSkip.addEventListener('click', () => this.skipAuth());
        this.logoutBtn.addEventListener('click', () => this.logout());
        
        // Notifications
        if (this.enableNotificationsBtn) {
            this.enableNotificationsBtn.addEventListener('click', () => this.requestNotificationPermission());
        }
        
        // Theme
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // User menu
        this.userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.userMenu.classList.toggle('open');
        });
        
        document.addEventListener('click', () => {
            this.userMenu.classList.remove('open');
            this.sortMenu.classList.remove('open');
        });
        
        // Sort
        this.sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sortMenu.classList.toggle('open');
        });
        
        document.querySelectorAll('.sort-option').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setSort(btn.dataset.sort);
                this.sortMenu.classList.remove('open');
            });
        });
        
        // New task
        this.newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.newTaskInput.value.trim()) {
                this.addTask(this.newTaskInput.value.trim());
                this.newTaskInput.value = '';
            }
        });
        
        // Completed section collapse
        this.completedHeader.addEventListener('click', (e) => {
            if (e.target.closest('.collapse-btn') || e.target === this.completedHeader) {
                this.completedSection.classList.toggle('collapsed');
            }
        });
        
        // Title editing
        this.documentTitle.addEventListener('blur', () => this.saveListName());
        this.documentTitle.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.documentTitle.blur(); }
        });
        
        // Task Modal
        this.modalClose.addEventListener('click', () => this.closeTaskModal());
        this.taskModal.addEventListener('click', (e) => {
            if (e.target === this.taskModal) this.closeTaskModal();
        });
        this.modalSave.addEventListener('click', () => this.saveTaskChanges());
        this.modalDelete.addEventListener('click', () => this.deleteCurrentTask());
        this.modalCheckbox.addEventListener('change', () => this.toggleCurrentTaskInModal());
        this.clearReminder.addEventListener('click', () => {
            this.reminderTime.value = '';
            this.reminderRepeat.value = '';
        });
        
        document.querySelectorAll('.priority-flag').forEach(btn => {
            btn.addEventListener('click', () => this.setModalPriority(btn.dataset.priority));
        });
        
        // List Modal
        this.listModalClose.addEventListener('click', () => this.closeListModal());
        this.listModal.addEventListener('click', (e) => {
            if (e.target === this.listModal) this.closeListModal();
        });
        this.listSave.addEventListener('click', () => this.saveListChanges());
        this.listDelete.addEventListener('click', () => this.deleteCurrentList());
        this.listNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveListChanges();
        });
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTaskModal();
                this.closeListModal();
                this.closeSearchModal();
                this.closeBulkMoveModal();
                if (this.selectionMode) this.exitSelectionMode();
                if (this.focusModeActive) this.closeFocusMode();
            }
        });

        // Search Modal
        this.searchBtn.addEventListener('click', () => this.openSearchModal());
        this.searchModalClose.addEventListener('click', () => this.closeSearchModal());
        this.searchModal.addEventListener('click', (e) => {
            if (e.target === this.searchModal) this.closeSearchModal();
        });
        this.searchInput.addEventListener('input', () => this.handleSearchInput());
        this.searchClear.addEventListener('click', () => this.clearSearch());

        // Bulk Selection
        this.bulkSelectBtn.addEventListener('click', () => this.toggleSelectionMode());
        this.bulkCancelBtn.addEventListener('click', () => this.exitSelectionMode());
        this.bulkCompleteBtn.addEventListener('click', () => this.bulkCompleteTasks());
        this.bulkMoveBtn.addEventListener('click', () => this.openBulkMoveModal());
        this.bulkDeleteBtn.addEventListener('click', () => this.bulkDeleteTasks());
        this.bulkMoveModalClose.addEventListener('click', () => this.closeBulkMoveModal());
        this.bulkMoveModal.addEventListener('click', (e) => {
            if (e.target === this.bulkMoveModal) this.closeBulkMoveModal();
        });

        // Focus Mode
        this.focusModeBtn.addEventListener('click', () => this.openFocusMode());
        this.focusClose.addEventListener('click', () => this.closeFocusMode());
        this.focusToggle.addEventListener('click', () => this.toggleCurrentTaskFocus());

        // Timer
        this.timerStart.addEventListener('click', () => this.startTimer());
        this.timerPause.addEventListener('click', () => this.pauseTimer());
        this.timerReset.addEventListener('click', () => this.resetTimer());
        this.workDuration.addEventListener('change', () => this.updateTimerSettings());
        this.breakDuration.addEventListener('change', () => this.updateTimerSettings());

        // Subtasks
        this.subtaskAddBtn.addEventListener('click', () => this.addSubtask());
        this.subtaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.subtaskInput.value.trim()) {
                this.addSubtask();
            }
        });
    }

    // ============ LISTS ============
    
    async createList(name) {
        if (this.isOnline) {
            const res = await fetch(`${this.API_BASE}/api-lists`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            const list = await res.json();
            // Normalize list ID to number
            list.id = Number(list.id);
            this.lists.push(list);
            return list;
        } else {
            const list = { id: this.generateId(), name };
            this.lists.push(list);
            this.saveToLocalStorage();
            return list;
        }
    }
    
    async updateList(id, name) {
        if (this.isOnline) {
            await fetch(`${this.API_BASE}/api-lists-id/${id}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name })
            });
        }
        const list = this.lists.find(l => String(l.id) === String(id));
        if (list) list.name = name;
        if (!this.isOnline) this.saveToLocalStorage();
    }
    
    async deleteList(id) {
        if (this.isOnline) {
            await fetch(`${this.API_BASE}/api-lists-id/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
        }
        this.lists = this.lists.filter(l => String(l.id) !== String(id));
        this.tasks = this.tasks.filter(t => String(t.list_id) !== String(id));
        if (!this.isOnline) this.saveToLocalStorage();
    }
    
    addList() {
        this.editingListId = null;
        this.listModalTitle.textContent = 'New List';
        this.listNameInput.value = '';
        this.listDelete.style.display = 'none';
        this.openListModal();
    }
    
    editList(listId) {
        const list = this.lists.find(l => String(l.id) === String(listId));
        if (!list) return;
        this.editingListId = list.id;  // Use the actual list ID
        this.listModalTitle.textContent = 'Edit List';
        this.listNameInput.value = list.name;
        this.listDelete.style.display = this.lists.length > 1 ? 'flex' : 'none';
        this.openListModal();
    }
    
    async saveListChanges() {
        const name = this.listNameInput.value.trim();
        if (!name) return;
        
        if (this.editingListId) {
            await this.updateList(this.editingListId, name);
            if (String(this.editingListId) === String(this.currentListId)) {
                this.documentTitle.textContent = name;
                document.title = name;
            }
        } else {
            const list = await this.createList(name);
            this.currentListId = list.id;
            this.documentTitle.textContent = name;
            document.title = name;
        }
        
        this.renderTabs();
        this.render();
        this.closeListModal();
    }
    
    async deleteCurrentList() {
        if (this.lists.length <= 1) return;
        await this.deleteList(this.editingListId);
        
        if (String(this.currentListId) === String(this.editingListId)) {
            this.currentListId = this.lists[0]?.id;
            this.updateTitle();
        }
        
        this.renderTabs();
        this.render();
        this.closeListModal();
    }
    
    switchList(listId) {
        // Keep ID as-is - can be string (offline) or number (online)
        // Use string comparison to handle both cases
        if (String(listId) === String(this.currentListId)) return;
        this.currentListId = listId;
        this.updateTitle();
        if (!this.isOnline) this.saveToLocalStorage();
        this.renderTabs();
        this.render();
    }
    
    updateTitle() {
        // Handle both string and number IDs
        const list = this.lists.find(l => String(l.id) === String(this.currentListId));
        if (list) {
            this.documentTitle.textContent = list.name;
            document.title = list.name;
        }
    }
    
    async saveListName() {
        const name = this.documentTitle.textContent.trim();
        if (name && this.currentListId) {
            await this.updateList(this.currentListId, name);
            document.title = name;
            this.renderTabs();
        }
    }
    
    renderTabs() {
        const html = this.lists.map((list, index) => `
            <button class="list-tab ${String(list.id) === String(this.currentListId) ? 'active' : ''}"
                    data-list-id="${list.id}"
                    data-index="${index}"
                    draggable="true">
                <span class="list-tab-name">${this.escapeHTML(list.name)}</span>
                <svg class="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" data-edit="${list.id}">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </button>
        `).join('') + `
            <button class="add-list-btn" id="add-list-btn" title="Add new list">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>
        `;

        this.listTabs.innerHTML = html;

        this.listTabs.querySelectorAll('.list-tab').forEach(tab => {
            // Click handler
            tab.addEventListener('click', (e) => {
                const editIcon = e.target.closest('.edit-icon');
                if (editIcon) {
                    e.stopPropagation();
                    this.editList(editIcon.dataset.edit);
                } else {
                    this.switchList(tab.dataset.listId);
                }
            });

            // Drag and drop handlers
            tab.addEventListener('dragstart', (e) => this.handleTabDragStart(e, tab));
            tab.addEventListener('dragend', (e) => this.handleTabDragEnd(e, tab));
            tab.addEventListener('dragover', (e) => this.handleTabDragOver(e, tab));
            tab.addEventListener('dragleave', (e) => this.handleTabDragLeave(e, tab));
            tab.addEventListener('drop', (e) => this.handleTabDrop(e, tab));
        });

        document.getElementById('add-list-btn').addEventListener('click', () => this.addList());
    }

    // ============ LIST TAB DRAG & DROP ============

    handleTabDragStart(e, tab) {
        this.draggedTabIndex = parseInt(tab.dataset.index);
        tab.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tab.dataset.index);
    }

    handleTabDragEnd(e, tab) {
        tab.classList.remove('dragging');
        this.listTabs.querySelectorAll('.list-tab').forEach(t => {
            t.classList.remove('drag-over');
        });
        this.draggedTabIndex = null;
    }

    handleTabDragOver(e, tab) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const targetIndex = parseInt(tab.dataset.index);
        if (this.draggedTabIndex !== targetIndex) {
            tab.classList.add('drag-over');
        }
    }

    handleTabDragLeave(e, tab) {
        tab.classList.remove('drag-over');
    }

    async handleTabDrop(e, tab) {
        e.preventDefault();
        tab.classList.remove('drag-over');

        const fromIndex = this.draggedTabIndex;
        const toIndex = parseInt(tab.dataset.index);

        if (fromIndex === toIndex || fromIndex === null) return;

        // Reorder the lists array
        const [movedList] = this.lists.splice(fromIndex, 1);
        this.lists.splice(toIndex, 0, movedList);

        // Save the new order
        if (!this.isOnline) {
            this.saveToLocalStorage();
        } else {
            // For online mode, we'll save to localStorage as well for order persistence
            this.saveListOrder();
        }

        // Re-render tabs
        this.renderTabs();
    }

    saveListOrder() {
        // Save list order to localStorage (works for both online and offline)
        const listOrder = this.lists.map(l => l.id);
        localStorage.setItem('taskManager_listOrder', JSON.stringify(listOrder));
    }

    applyListOrder() {
        // Apply saved list order if it exists
        const savedOrder = localStorage.getItem('taskManager_listOrder');
        if (!savedOrder) return;

        try {
            const orderArray = JSON.parse(savedOrder);
            const orderedLists = [];

            // First add lists in saved order
            for (const id of orderArray) {
                const list = this.lists.find(l => String(l.id) === String(id));
                if (list) {
                    orderedLists.push(list);
                }
            }

            // Then add any new lists not in saved order
            for (const list of this.lists) {
                if (!orderedLists.find(l => String(l.id) === String(list.id))) {
                    orderedLists.push(list);
                }
            }

            this.lists = orderedLists;
        } catch (e) {
            console.log('Could not apply saved list order');
        }
    }
    
    openListModal() { this.listModal.classList.add('open'); this.listNameInput.focus(); }
    closeListModal() { this.listModal.classList.remove('open'); this.editingListId = null; }
    
    // ============ TASKS ============
    
    getListTasks() {
        if (!Array.isArray(this.tasks)) {
            console.warn('this.tasks is not an array in getListTasks, resetting...');
            this.tasks = [];
        }
        const filtered = this.tasks.filter(t => {
            // Use string comparison to handle both string and number IDs
            return String(t.list_id) === String(this.currentListId);
        });
        return filtered;
    }
    
    async addTask(text) {
        const task = {
            list_id: this.currentListId,
            text,
            notes: '',
            priority: 'none',
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: null,
            reminder_time: null,
            reminder_repeat: null
        };
        
        // Ensure tasks is an array
        if (!Array.isArray(this.tasks)) {
            this.tasks = [];
        }
        
        if (this.isOnline) {
            try {
                const res = await fetch(`${this.API_BASE}/api-tasks`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(task)
                });
                
                if (res.ok) {
                    const created = await res.json();
                    // Normalize completed field and list_id
                    created.completed = !!created.completed;
                    if (created.list_id !== undefined) {
                        created.list_id = Number(created.list_id);
                    }
                    if (!Array.isArray(this.tasks)) this.tasks = [];
                    this.tasks.unshift(created);
                } else {
                    const errorData = await res.json().catch(() => ({}));
                    console.error('Failed to create task:', res.status, errorData);
                    
                    // If 401, token expired
                    if (res.status === 401) {
                        this.saveAuthToken(null);
                        this.isOnline = false;
                        this.user = null;
                        this.loadFromLocalStorage();
                    }
                    
                    // Fallback to local storage
                    if (!Array.isArray(this.tasks)) this.tasks = [];
                    task.id = this.generateId();
                    this.tasks.unshift(task);
                    this.saveToLocalStorage();
                }
            } catch (e) {
                console.error('Error creating task:', e);
                this.isOnline = false;
                if (!Array.isArray(this.tasks)) this.tasks = [];
                task.id = this.generateId();
                this.tasks.unshift(task);
                this.saveToLocalStorage();
            }
        } else {
            if (!Array.isArray(this.tasks)) this.tasks = [];
            task.id = this.generateId();
            this.tasks.unshift(task);
            this.saveToLocalStorage();
        }
        
        this.render();
        this.newTaskInput.focus();
    }
    
    async updateTask(id, updates) {
        if (this.isOnline) {
            const res = await fetch(`${this.API_BASE}/api-tasks-id/${id}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updates)
            });
            const updated = await res.json();
            // Normalize completed field
            updated.completed = !!updated.completed;
            const idx = this.tasks.findIndex(t => String(t.id) === String(id));
            if (idx !== -1) this.tasks[idx] = updated;
        } else {
            const task = this.tasks.find(t => String(t.id) === String(id));
            if (task) {
                Object.assign(task, updates);
                if (updates.completed && !task.completed_at) {
                    task.completed_at = new Date().toISOString();
                } else if (!updates.completed) {
                    task.completed_at = null;
                }
            }
            this.saveToLocalStorage();
        }
    }
    
    async deleteTask(id, showUndo = true) {
        const task = this.tasks.find(t => String(t.id) === String(id));

        // Store for undo before deleting
        if (task && showUndo) {
            this.storeForUndo('delete', { ...task });
        }

        if (this.isOnline) {
            await fetch(`${this.API_BASE}/api-tasks-id/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
        }
        this.tasks = this.tasks.filter(t => String(t.id) !== String(id));
        if (!this.isOnline) this.saveToLocalStorage();

        if (showUndo) {
            this.showUndoToast('Task deleted');
        }
    }
    
    async toggleTask(id) {
        // Handle both string and number IDs
        const task = this.tasks.find(t => String(t.id) === String(id));
        if (task) {
            const wasCompleted = task.completed;
            await this.updateTask(task.id, { completed: !task.completed });

            // Handle recurring tasks - create new task when completing
            if (!wasCompleted && task.recurrence) {
                await this.createRecurringTask(task);
            }

            this.render();
        }
    }

    async createRecurringTask(originalTask) {
        const newTask = {
            list_id: originalTask.list_id,
            text: originalTask.text,
            notes: originalTask.notes || '',
            priority: originalTask.priority || 'none',
            recurrence: originalTask.recurrence,
            reminder_time: null,
            reminder_repeat: null
        };

        if (this.isOnline) {
            try {
                const res = await fetch(`${this.API_BASE}/api-tasks`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(newTask)
                });
                if (res.ok) {
                    const created = await res.json();
                    created.completed = false;
                    created.list_id = Number(created.list_id);
                    this.tasks.unshift(created);
                }
            } catch (e) {
                console.error('Failed to create recurring task:', e);
            }
        } else {
            newTask.id = this.generateId();
            newTask.completed = false;
            newTask.created_at = new Date().toISOString();
            newTask.completed_at = null;
            this.tasks.unshift(newTask);
            this.saveToLocalStorage();
        }
    }
    
    // ============ TASK MODAL ============
    
    openTaskModal(taskId) {
        // Handle both string and number IDs
        const task = this.tasks.find(t => String(t.id) === String(taskId));
        if (!task) return;
        
        this.currentTaskId = taskId;
        this.modalCheckbox.checked = task.completed;
        this.modalTaskText.value = task.text;
        this.modalNotes.value = task.notes || '';
        this.setModalPriority(task.priority || 'none');
        
        // Reminder - convert to local time for datetime-local input
        if (task.reminder_time) {
            const dt = new Date(task.reminder_time);
            // Format as local datetime string (YYYY-MM-DDTHH:MM)
            const year = dt.getFullYear();
            const month = String(dt.getMonth() + 1).padStart(2, '0');
            const day = String(dt.getDate()).padStart(2, '0');
            const hours = String(dt.getHours()).padStart(2, '0');
            const minutes = String(dt.getMinutes()).padStart(2, '0');
            this.reminderTime.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        } else {
            this.reminderTime.value = '';
        }
        this.reminderRepeat.value = task.reminder_repeat || '';
        this.recurrenceSelect.value = task.recurrence || '';

        // Focus toggle
        this.updateFocusToggleUI(task.is_focused);

        // Meta
        this.modalMeta.innerHTML = `
            <div class="modal-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Created: <strong>${this.formatDateFull(task.created_at)}</strong></span>
            </div>
            ${task.completed_at ? `
            <div class="modal-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Completed: <strong>${this.formatDateFull(task.completed_at)}</strong></span>
            </div>` : ''}
        `;
        
        // Load subtasks
        this.loadSubtasks(taskId);

        this.taskModal.classList.add('open');
        this.taskModal.setAttribute('aria-hidden', 'false');
        this.modalTaskText.focus();
    }

    closeTaskModal() {
        this.taskModal.classList.remove('open');
        this.taskModal.setAttribute('aria-hidden', 'true');
        this.currentTaskId = null;
    }
    
    async saveTaskChanges() {
        if (!this.currentTaskId) return;

        await this.updateTask(this.currentTaskId, {
            text: this.modalTaskText.value.trim(),
            notes: this.modalNotes.value.trim(),
            priority: this.currentPriority,
            reminder_time: this.reminderTime.value ? new Date(this.reminderTime.value).toISOString() : null,
            reminder_repeat: this.reminderRepeat.value || null,
            recurrence: this.recurrenceSelect.value || null
        });

        this.render();
        this.closeTaskModal();
    }
    
    async deleteCurrentTask() {
        if (this.currentTaskId) {
            await this.deleteTask(this.currentTaskId);
            this.render();
            this.closeTaskModal();
        }
    }
    
    async toggleCurrentTaskInModal() {
        if (!this.currentTaskId) return;
        await this.updateTask(this.currentTaskId, { completed: this.modalCheckbox.checked });
    }
    
    setModalPriority(priority) {
        this.currentPriority = priority;
        document.querySelectorAll('.priority-flag').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.priority === priority);
        });
    }
    
    // ============ SORTING ============
    
    setSort(sortType) {
        this.currentSort = sortType;
        const labels = { newest: 'Newest', oldest: 'Oldest', priority: 'Priority' };
        this.sortLabel.textContent = labels[sortType];
        document.querySelectorAll('.sort-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === sortType);
        });
        this.render();
    }
    
    sortTasks(tasks) {
        const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 };
        switch (this.currentSort) {
            case 'oldest': return tasks.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            case 'priority': return tasks.sort((a, b) => {
                const diff = priorityOrder[a.priority || 'none'] - priorityOrder[b.priority || 'none'];
                return diff !== 0 ? diff : new Date(b.created_at) - new Date(a.created_at);
            });
            default: return tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
    }
    
    // ============ RENDERING ============
    
    render() {
        const listTasks = this.getListTasks();
        let activeTasks = listTasks.filter(t => !t.completed);
        let completedTasks = listTasks.filter(t => t.completed);
        
        activeTasks = this.sortTasks(activeTasks);
        completedTasks.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
        
        this.activeTasksList.innerHTML = activeTasks.length
            ? activeTasks.map(t => this.createTaskHTML(t)).join('')
            : '<li class="empty-state">No tasks yet. Add one above!</li>';
        
        this.completedTasksList.innerHTML = completedTasks.length
            ? completedTasks.map(t => this.createTaskHTML(t)).join('')
            : '<li class="empty-state">Completed tasks will appear here</li>';
        
        this.activeCount.textContent = activeTasks.length;
        this.completedCount.textContent = completedTasks.length;
        this.completedSection.style.display = completedTasks.length > 0 ? 'block' : 'none';
        
        this.bindTaskEvents();
    }
    
    createTaskHTML(task) {
        const hasNotes = task.notes && task.notes.trim().length > 0;
        const notesPreview = hasNotes ? task.notes.trim().substring(0, 60) + (task.notes.length > 60 ? '...' : '') : '';
        const priority = task.priority || 'none';
        const hasReminder = task.reminder_time;
        const hasRecurrence = task.recurrence;

        const recurrenceLabels = {
            'daily': 'Daily',
            'weekly': 'Weekly',
            'monthly': 'Monthly',
            'yearly': 'Yearly'
        };

        const priorityFlag = priority !== 'none' ? `
            <span class="task-priority-flag" data-priority="${priority}">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                    <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
            </span>
        ` : '';
        
        const isSelected = this.selectedTasks.has(String(task.id));
        const selectionModeClass = this.selectionMode ? 'selection-mode' : '';
        const selectedClass = isSelected ? 'selected' : '';

        // Get subtask stats
        const subtaskStats = this.getSubtaskStats(task.id);
        const subtaskIndicator = subtaskStats ? `<span class="task-subtasks-indicator ${subtaskStats.completed === subtaskStats.total ? 'has-completed' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> ${subtaskStats.completed}/${subtaskStats.total}</span>` : '';

        return `
            <li class="task-item ${task.completed ? 'completed' : ''} ${selectionModeClass} ${selectedClass}" data-id="${task.id}">
                <label class="task-selection-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''}>
                </label>
                <label class="task-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${task.completed ? 'checked' : ''}>
                    <span class="checkmark">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                </label>
                <button type="button" class="task-content" onclick="window.taskManager.openTaskModal('${task.id}')">
                    <p class="task-text">${this.escapeHTML(task.text)}${task.is_focused ? `<span class="task-focused-indicator"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>` : ''}</p>
                    ${hasNotes ? `<p class="task-notes-preview">${this.escapeHTML(notesPreview)}</p>` : ''}
                    ${hasReminder ? `<span class="task-reminder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Reminder set</span>` : ''}
                    ${hasRecurrence ? `<span class="task-recurrence"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/></svg> ${recurrenceLabels[task.recurrence] || task.recurrence}</span>` : ''}
                    ${subtaskIndicator}
                </button>
                ${priorityFlag}
            </li>
        `;
    }
    
    bindTaskEvents() {
        // Regular task completion checkbox
        document.querySelectorAll('.task-checkbox input').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const id = e.target.closest('.task-item').dataset.id;
                this.toggleTask(id);
            });
        });

        // Selection mode checkbox
        document.querySelectorAll('.task-selection-checkbox input').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const id = e.target.closest('.task-item').dataset.id;
                this.toggleTaskSelection(id);
            });
        });

        // In selection mode, clicking anywhere on the task toggles selection
        if (this.selectionMode) {
            document.querySelectorAll('.task-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Don't toggle if clicking the content button (to open modal)
                    if (!e.target.closest('.task-content') && !e.target.closest('.task-checkbox')) {
                        const id = item.dataset.id;
                        this.toggleTaskSelection(id);
                    }
                });
            });
        }
    }
    
    // ============ SERVICE WORKER & PUSH NOTIFICATIONS ============
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered');
            } catch (e) {
                console.log('SW registration failed:', e);
            }
        }
    }
    
    updateNotificationButtonState() {
        if (!this.enableNotificationsBtn) return;

        if (!('Notification' in window) || !('PushManager' in window)) {
            this.notificationsBtnText.textContent = 'Notifications not supported';
            this.enableNotificationsBtn.disabled = true;
            this.enableNotificationsBtn.style.opacity = '0.5';
            return;
        }

        const notificationsMuted = localStorage.getItem('taskManager_notificationsMuted') === 'true';

        if (Notification.permission === 'denied') {
            this.notificationsBtnText.textContent = 'Notifications Blocked';
            this.enableNotificationsBtn.style.opacity = '0.5';
            this.enableNotificationsBtn.disabled = true;
        } else if (Notification.permission === 'granted' && !notificationsMuted) {
            this.notificationsBtnText.textContent = 'Disable Notifications';
            this.enableNotificationsBtn.style.opacity = '1';
            this.enableNotificationsBtn.disabled = false;
        } else if (Notification.permission === 'granted' && notificationsMuted) {
            this.notificationsBtnText.textContent = 'Enable Notifications';
            this.enableNotificationsBtn.style.opacity = '1';
            this.enableNotificationsBtn.disabled = false;
        } else {
            this.notificationsBtnText.textContent = 'Enable Notifications';
            this.enableNotificationsBtn.style.opacity = '1';
            this.enableNotificationsBtn.disabled = false;
        }
    }

    areNotificationsEnabled() {
        if (Notification.permission !== 'granted') return false;
        return localStorage.getItem('taskManager_notificationsMuted') !== 'true';
    }
    
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            alert('This browser does not support notifications');
            return;
        }

        if (!('PushManager' in window)) {
            alert('Push notifications are not supported in this browser');
            return;
        }

        // If already granted, toggle mute state
        if (Notification.permission === 'granted') {
            const currentlyMuted = localStorage.getItem('taskManager_notificationsMuted') === 'true';
            if (currentlyMuted) {
                // Re-enable notifications
                localStorage.removeItem('taskManager_notificationsMuted');
                this.updateNotificationButtonState();

                if (this.swRegistration) {
                    this.swRegistration.showNotification('Notifications Re-enabled', {
                        body: 'You will receive reminders for your tasks.',
                        icon: '/icons/icon-192.svg',
                        badge: '/icons/icon-96.svg'
                    });
                }
            } else {
                // Disable (mute) notifications
                localStorage.setItem('taskManager_notificationsMuted', 'true');
                this.updateNotificationButtonState();
            }
            return;
        }

        // Check if running as PWA on iOS
        const isIOSPWA = window.navigator.standalone === true;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        if (isIOS && !isIOSPWA) {
            alert('For notifications on iOS, please add this app to your Home Screen first:\n\n1. Tap the Share button\n2. Select "Add to Home Screen"\n3. Then enable notifications from the app');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);

            if (permission === 'granted') {
                // Make sure muted state is cleared when first enabling
                localStorage.removeItem('taskManager_notificationsMuted');
                await this.subscribeToPush();
                this.updateNotificationButtonState();

                // Show test notification
                if (this.swRegistration) {
                    this.swRegistration.showNotification('Notifications Enabled!', {
                        body: 'You will now receive reminders for your tasks.',
                        icon: '/icons/icon-192.svg',
                        badge: '/icons/icon-96.svg'
                    });
                }
            } else if (permission === 'denied') {
                alert('Notifications were blocked. You can enable them in your browser settings.');
            }

            this.updateNotificationButtonState();
        } catch (e) {
            console.error('Error requesting notification permission:', e);
            alert('Failed to enable notifications. Please try again.');
        }
    }
    
    async subscribeToPush() {
        if (!this.swRegistration || !this.isOnline) {
            console.log('Cannot subscribe: no SW registration or offline');
            return;
        }
        
        try {
            // Get VAPID public key from server
            const vapidRes = await fetch(`${this.API_BASE}/api-push-vapid`);
            const vapidData = await vapidRes.json();
            
            if (!vapidData.key) {
                console.error('No VAPID key from server');
                return;
            }
            
            // Convert VAPID key to Uint8Array
            const applicationServerKey = this.urlBase64ToUint8Array(vapidData.key);
            
            // Subscribe to push
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });
            
            console.log('Push subscription:', JSON.stringify(subscription));
            
            // Send subscription to server
            const res = await fetch(`${this.API_BASE}/api-push-subscribe`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });
            
            if (res.ok) {
                console.log('Push subscription saved to server');
            } else {
                console.error('Failed to save push subscription');
            }
        } catch (e) {
            console.error('Push subscription error:', e);
        }
    }
    
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    
    // ============ CLIENT-SIDE REMINDER CHECKER ============
    
    startReminderChecker() {
        console.log('[Reminders] Starting reminder checker...');
        
        // Track last check time for throttling
        this.lastReminderCheck = 0;
        
        // Check reminders every 10 seconds when app is open
        this.reminderCheckInterval = setInterval(() => {
            console.log('[Reminders] Interval triggered');
            this.checkLocalReminders();
        }, 10000);
        
        // Also check when page becomes visible (user switches back to tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('[Reminders] Page visible, checking reminders...');
                this.checkLocalReminders();
            }
        });
        
        // Check on window focus
        window.addEventListener('focus', () => {
            console.log('[Reminders] Window focused, checking reminders...');
            this.checkLocalReminders();
        });
        
        // Check on ANY user interaction (click, key, touch, scroll)
        const interactionHandler = () => {
            // Throttle: only check if more than 5 seconds since last check
            const now = Date.now();
            if (now - this.lastReminderCheck > 5000) {
                console.log('[Reminders] User interaction, checking reminders...');
                this.checkLocalReminders();
            }
        };
        
        document.addEventListener('click', interactionHandler);
        document.addEventListener('keydown', interactionHandler);
        document.addEventListener('touchstart', interactionHandler);
        document.addEventListener('scroll', interactionHandler, { passive: true });
        
        // Initial check after tasks are loaded
        setTimeout(() => {
            console.log('[Reminders] Initial check...');
            this.checkLocalReminders();
        }, 3000);
        
        // Secondary check in case first one was too early
        setTimeout(() => {
            console.log('[Reminders] Secondary check...');
            this.checkLocalReminders();
        }, 10000);
    }
    
    async checkLocalReminders() {
        // Update last check timestamp
        this.lastReminderCheck = Date.now();
        
        // Make sure we have tasks
        if (!Array.isArray(this.tasks) || this.tasks.length === 0) {
            console.log('[Reminders] No tasks to check');
            return;
        }
        
        // Check notification permission
        if (!('Notification' in window)) {
            console.log('[Reminders] Notifications not supported');
            return;
        }
        
        if (Notification.permission !== 'granted') {
            console.log('[Reminders] Notification permission not granted:', Notification.permission);
            return;
        }

        // Check if notifications are muted by user
        if (!this.areNotificationsEnabled()) {
            console.log('[Reminders] Notifications are muted by user');
            return;
        }
        
        const now = new Date();
        console.log(`[Reminders] Checking at ${now.toLocaleTimeString()}`);
        const notifiedKey = 'taskManager_notifiedReminders';
        let notified = {};
        
        try {
            notified = JSON.parse(localStorage.getItem(notifiedKey) || '{}');
        } catch (e) {
            notified = {};
        }
        
        // Clean old entries (older than 1 hour)
        const oneHourAgo = now.getTime() - 60 * 60 * 1000;
        for (const key in notified) {
            if (notified[key] < oneHourAgo) delete notified[key];
        }
        
        let tasksWithReminders = 0;
        let dueReminders = 0;
        
        for (const task of this.tasks) {
            if (task.completed || !task.reminder_time) continue;
            tasksWithReminders++;
            
            const reminderTime = new Date(task.reminder_time);
            const taskKey = `${task.id}_${reminderTime.getTime()}`;
            
            // Check if reminder time has passed and not already notified
            const isDue = reminderTime <= now;
            const alreadyNotified = !!notified[taskKey];
            
            console.log(`[Reminders] Task "${task.text}": due=${isDue}, notified=${alreadyNotified}, time=${reminderTime.toLocaleString()}`);
            
            if (isDue && !alreadyNotified) {
                dueReminders++;
                console.log(`[Reminders] 🔔 Triggering notification for: ${task.text}`);
                
                try {
                    await this.showLocalNotification(task);
                    notified[taskKey] = now.getTime();
                    
                    // Handle repeat reminders
                    if (task.reminder_repeat) {
                        await this.rescheduleReminder(task);
                    } else {
                        // Clear one-time reminder locally
                        task.reminder_time = null;
                        // Also update on server if online
                        if (this.isOnline) {
                            await this.updateTask(task.id, { reminder_time: null });
                        }
                    }
                } catch (e) {
                    console.error('[Reminders] Failed to show notification:', e);
                }
            }
        }
        
        console.log(`[Reminders] Checked ${tasksWithReminders} tasks with reminders, ${dueReminders} due`);
        localStorage.setItem(notifiedKey, JSON.stringify(notified));
    }
    
    async showLocalNotification(task) {
        console.log('[Reminders] Showing notification for task:', task.text);
        
        const notificationOptions = {
            body: task.text,
            icon: '/icons/icon-192.svg',
            badge: '/icons/icon-96.svg',
            tag: `reminder-${task.id}`,
            renotify: true,
            vibrate: [200, 100, 200],
            data: { taskId: task.id, url: '/' },
            silent: false
        };
        
        let notificationShown = false;
        
        // Try service worker notification first (works better on mobile and in background)
        if (this.swRegistration && this.swRegistration.showNotification) {
            try {
                await this.swRegistration.showNotification('⏰ Reminder', {
                    ...notificationOptions,
                    requireInteraction: true
                });
                console.log('[Reminders] SW notification shown');
                notificationShown = true;
            } catch (e) {
                console.log('[Reminders] SW notification failed:', e.message);
            }
        }
        
        // Fallback to Notification API if SW failed
        if (!notificationShown && 'Notification' in window) {
            try {
                const notification = new Notification('⏰ Reminder', notificationOptions);
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
                console.log('[Reminders] Notification API notification shown');
                notificationShown = true;
            } catch (e) {
                console.log('[Reminders] Notification API failed:', e.message);
            }
        }
        
        // Last resort: use alert (will work everywhere but is blocking)
        if (!notificationShown) {
            console.log('[Reminders] Using alert fallback');
            // Don't use alert as it's too disruptive, just log
        }
        
        // Also play a sound if possible
        try {
            // Try to play a notification sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 200);
        } catch (e) {
            // Sound not available, that's ok
        }
    }
    
    async rescheduleReminder(task) {
        const reminderDate = new Date(task.reminder_time);
        
        switch (task.reminder_repeat) {
            case 'hourly':
                reminderDate.setHours(reminderDate.getHours() + 1);
                break;
            case 'daily':
                reminderDate.setDate(reminderDate.getDate() + 1);
                break;
            case 'weekly':
                reminderDate.setDate(reminderDate.getDate() + 7);
                break;
            case 'monthly':
                reminderDate.setMonth(reminderDate.getMonth() + 1);
                break;
        }
        
        await this.updateTask(task.id, { reminder_time: reminderDate.toISOString() });
        console.log(`Rescheduled reminder for task ${task.id} to ${reminderDate.toISOString()}`);
    }
    
    // ============ SEARCH ============

    openSearchModal() {
        this.searchModal.classList.add('open');
        this.searchInput.focus();
    }

    closeSearchModal() {
        this.searchModal.classList.remove('open');
        this.clearSearch();
    }

    handleSearchInput() {
        const query = this.searchInput.value.trim();

        // Show/hide clear button
        this.searchClear.style.display = query ? 'block' : 'none';

        // Debounce search
        clearTimeout(this.searchTimeout);

        if (!query) {
            this.searchResultsHeader.style.display = 'none';
            this.searchResultsList.innerHTML = '<li class="search-empty">Type to search tasks...</li>';
            return;
        }

        this.searchTimeout = setTimeout(() => this.performSearch(query), 300);
    }

    async performSearch(query) {
        this.searchResultsHeader.style.display = 'block';
        this.searchResultsList.innerHTML = '<li class="search-loading">Searching...</li>';

        try {
            let results = [];

            if (this.isOnline) {
                // Search via API
                const res = await fetch(`${this.API_BASE}/api-tasks-search?q=${encodeURIComponent(query)}`, {
                    headers: this.getAuthHeaders()
                });

                if (res.ok) {
                    results = await res.json();
                } else {
                    // Fallback to local search
                    results = this.searchLocalTasks(query);
                }
            } else {
                // Offline: search local tasks
                results = this.searchLocalTasks(query);
            }

            this.renderSearchResults(results, query);
        } catch (e) {
            console.error('Search error:', e);
            // Fallback to local search on error
            const results = this.searchLocalTasks(query);
            this.renderSearchResults(results, query);
        }
    }

    searchLocalTasks(query) {
        const lowerQuery = query.toLowerCase();
        return this.tasks.filter(task => {
            const textMatch = task.text && task.text.toLowerCase().includes(lowerQuery);
            const notesMatch = task.notes && task.notes.toLowerCase().includes(lowerQuery);
            return textMatch || notesMatch;
        }).map(task => {
            // Add list name for display
            const list = this.lists.find(l => String(l.id) === String(task.list_id));
            return {
                ...task,
                list_name: list ? list.name : 'Unknown List'
            };
        });
    }

    renderSearchResults(results, query) {
        const count = results.length;
        this.searchResultsCount.textContent = `${count} result${count !== 1 ? 's' : ''}`;

        if (count === 0) {
            this.searchResultsList.innerHTML = '<li class="search-empty">No tasks found</li>';
            return;
        }

        this.searchResultsList.innerHTML = results.map(task => {
            const highlightedText = this.highlightMatch(task.text, query);
            const highlightedNotes = task.notes ? this.highlightMatch(task.notes, query) : '';
            const notesPreview = highlightedNotes ? highlightedNotes.substring(0, 80) + (task.notes.length > 80 ? '...' : '') : '';

            return `
                <li class="search-result-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" data-list-id="${task.list_id}">
                    <span class="search-result-checkbox"></span>
                    <div class="search-result-content">
                        <div class="search-result-text">${highlightedText}</div>
                        ${notesPreview ? `<div class="search-result-notes">${notesPreview}</div>` : ''}
                        <div class="search-result-meta">
                            <span class="search-result-list-name">${this.escapeHTML(task.list_name)}</span>
                        </div>
                    </div>
                </li>
            `;
        }).join('');

        // Bind click events on search results
        this.searchResultsList.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const taskId = item.dataset.taskId;
                const listId = item.dataset.listId;

                // Switch to the list containing this task
                if (String(listId) !== String(this.currentListId)) {
                    this.switchList(listId);
                }

                // Close search modal and open task modal
                this.closeSearchModal();
                this.openTaskModal(taskId);
            });
        });
    }

    highlightMatch(text, query) {
        if (!text || !query) return this.escapeHTML(text || '');

        const escaped = this.escapeHTML(text);
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return escaped.replace(regex, '<mark>$1</mark>');
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    clearSearch() {
        this.searchInput.value = '';
        this.searchClear.style.display = 'none';
        this.searchResultsHeader.style.display = 'none';
        this.searchResultsList.innerHTML = '<li class="search-empty">Type to search tasks...</li>';
    }

    // ============ UNDO FUNCTIONALITY ============

    storeForUndo(action, data) {
        this.undoStack.push({
            action,
            data,
            timestamp: Date.now()
        });
        // Keep only last 10 actions
        if (this.undoStack.length > 10) this.undoStack.shift();
    }

    showUndoToast(message) {
        const container = document.getElementById('toast-container');
        const toastId = 'toast-' + Date.now();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.id = toastId;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-undo" onclick="window.taskManager.undoLastAction('${toastId}')">Undo</button>
            <button class="toast-dismiss" onclick="window.taskManager.dismissToast('${toastId}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        container.appendChild(toast);

        // Auto-dismiss after 5 seconds
        setTimeout(() => this.dismissToast(toastId), 5000);
    }

    dismissToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }

    async undoLastAction(toastId) {
        const lastAction = this.undoStack.pop();
        if (!lastAction) return;

        this.dismissToast(toastId);

        switch (lastAction.action) {
            case 'delete':
                await this.restoreTask(lastAction.data);
                break;
            case 'bulk-delete':
                for (const task of lastAction.data) {
                    await this.restoreTask(task);
                }
                break;
            case 'complete':
                await this.updateTask(lastAction.data.id, { completed: false });
                break;
            case 'bulk-complete':
                for (const task of lastAction.data) {
                    await this.updateTask(task.id, { completed: false });
                }
                break;
        }
        this.render();
    }

    async restoreTask(task) {
        if (this.isOnline) {
            try {
                const res = await fetch(`${this.API_BASE}/api-tasks`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({
                        list_id: task.list_id,
                        text: task.text,
                        notes: task.notes || '',
                        priority: task.priority || 'none',
                        reminder_time: task.reminder_time,
                        reminder_repeat: task.reminder_repeat
                    })
                });
                if (res.ok) {
                    const restored = await res.json();
                    restored.completed = !!restored.completed;
                    this.tasks.unshift(restored);
                }
            } catch (e) {
                console.error('Failed to restore task:', e);
            }
        } else {
            // Restore locally with a new ID
            const restoredTask = { ...task, id: this.generateId() };
            this.tasks.unshift(restoredTask);
            this.saveToLocalStorage();
        }
    }

    // ============ BULK SELECTION MODE ============

    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        if (this.selectionMode) {
            this.enterSelectionMode();
        } else {
            this.exitSelectionMode();
        }
    }

    enterSelectionMode() {
        this.selectionMode = true;
        this.selectedTasks.clear();
        this.bulkSelectBtn.classList.add('active');
        this.bulkActionBar.style.display = 'flex';
        document.querySelectorAll('.task-item').forEach(item => {
            item.classList.add('selection-mode');
        });
        this.updateBulkCount();
        this.render();
    }

    exitSelectionMode() {
        this.selectionMode = false;
        this.selectedTasks.clear();
        this.bulkSelectBtn.classList.remove('active');
        this.bulkActionBar.style.display = 'none';
        document.querySelectorAll('.task-item').forEach(item => {
            item.classList.remove('selection-mode', 'selected');
        });
        this.render();
    }

    toggleTaskSelection(id) {
        const taskId = String(id);
        if (this.selectedTasks.has(taskId)) {
            this.selectedTasks.delete(taskId);
        } else {
            this.selectedTasks.add(taskId);
        }
        this.updateBulkCount();
        this.updateTaskSelectionUI(taskId);
    }

    updateTaskSelectionUI(id) {
        const taskElement = document.querySelector(`.task-item[data-id="${id}"]`);
        if (taskElement) {
            const checkbox = taskElement.querySelector('.task-selection-checkbox input');
            if (this.selectedTasks.has(String(id))) {
                taskElement.classList.add('selected');
                if (checkbox) checkbox.checked = true;
            } else {
                taskElement.classList.remove('selected');
                if (checkbox) checkbox.checked = false;
            }
        }
    }

    updateBulkCount() {
        const count = this.selectedTasks.size;
        this.bulkCount.textContent = `${count} selected`;

        // Disable action buttons if nothing selected
        const hasSelection = count > 0;
        this.bulkCompleteBtn.disabled = !hasSelection;
        this.bulkMoveBtn.disabled = !hasSelection;
        this.bulkDeleteBtn.disabled = !hasSelection;
    }

    async bulkCompleteTasks() {
        if (this.selectedTasks.size === 0) return;

        const tasksToComplete = this.tasks.filter(t =>
            this.selectedTasks.has(String(t.id)) && !t.completed
        );

        // Store for undo
        this.storeForUndo('bulk-complete', tasksToComplete.map(t => ({ ...t })));

        // Complete each task
        for (const task of tasksToComplete) {
            await this.updateTask(task.id, { completed: true });

            // Handle recurring tasks
            if (task.recurrence) {
                await this.createRecurringTask(task);
            }
        }

        this.showUndoToast(`Completed ${tasksToComplete.length} task${tasksToComplete.length > 1 ? 's' : ''}`);
        this.exitSelectionMode();
    }

    openBulkMoveModal() {
        if (this.selectedTasks.size === 0) return;

        // Populate the list of available lists
        this.bulkMoveList.innerHTML = this.lists.map(list => `
            <button class="bulk-move-item" data-list-id="${list.id}">${this.escapeHTML(list.name)}</button>
        `).join('');

        // Bind click events
        this.bulkMoveList.querySelectorAll('.bulk-move-item').forEach(item => {
            item.addEventListener('click', () => {
                this.bulkMoveTasks(item.dataset.listId);
            });
        });

        this.bulkMoveModal.style.display = 'flex';
    }

    closeBulkMoveModal() {
        this.bulkMoveModal.style.display = 'none';
    }

    async bulkMoveTasks(newListId) {
        if (this.selectedTasks.size === 0) return;

        const tasksToMove = this.tasks.filter(t => this.selectedTasks.has(String(t.id)));
        const count = tasksToMove.length;

        for (const task of tasksToMove) {
            await this.updateTask(task.id, { list_id: Number(newListId) });
        }

        const targetList = this.lists.find(l => String(l.id) === String(newListId));
        const listName = targetList ? targetList.name : 'list';

        this.showUndoToast(`Moved ${count} task${count > 1 ? 's' : ''} to ${listName}`);
        this.closeBulkMoveModal();
        this.exitSelectionMode();
    }

    async bulkDeleteTasks() {
        if (this.selectedTasks.size === 0) return;

        const tasksToDelete = this.tasks.filter(t => this.selectedTasks.has(String(t.id)));
        const count = tasksToDelete.length;

        // Store for undo
        this.storeForUndo('bulk-delete', tasksToDelete.map(t => ({ ...t })));

        // Delete each task
        for (const task of tasksToDelete) {
            if (this.isOnline) {
                try {
                    await fetch(`${this.API_BASE}/api-tasks-id/${task.id}`, {
                        method: 'DELETE',
                        headers: this.getAuthHeaders()
                    });
                } catch (e) {
                    console.error('Failed to delete task:', e);
                }
            }
            this.tasks = this.tasks.filter(t => String(t.id) !== String(task.id));
        }

        if (!this.isOnline) this.saveToLocalStorage();

        this.showUndoToast(`Deleted ${count} task${count > 1 ? 's' : ''}`);
        this.exitSelectionMode();
    }

    // ============ SUBTASKS ============

    async loadSubtasks(taskId) {
        this.subtaskInput.value = '';
        let loadedFromApi = false;

        if (this.isOnline) {
            try {
                const res = await fetch(`${this.API_BASE}/api-subtasks?task_id=${taskId}`, {
                    headers: this.getAuthHeaders()
                });
                if (res.ok) {
                    const subtasks = await res.json();
                    this.subtasks[taskId] = subtasks;
                    // Sync to localStorage as backup
                    localStorage.setItem(`subtasks_${taskId}`, JSON.stringify(subtasks));
                    loadedFromApi = true;
                }
            } catch (e) {
                console.error('Failed to load subtasks from API:', e);
            }
        }

        // Load from localStorage if API failed or offline
        if (!loadedFromApi) {
            const stored = localStorage.getItem(`subtasks_${taskId}`);
            this.subtasks[taskId] = stored ? JSON.parse(stored) : [];
        }

        this.renderSubtasks();
    }

    renderSubtasks() {
        const taskId = this.currentTaskId;
        const subtasks = this.subtasks[taskId] || [];

        if (subtasks.length === 0) {
            this.subtasksList.innerHTML = '<p class="subtasks-empty" style="color: var(--text-muted); font-size: 0.875rem; text-align: center; padding: 0.5rem;">No subtasks yet</p>';
            this.subtaskProgress.style.display = 'none';
            return;
        }

        this.subtasksList.innerHTML = subtasks.map(st => `
            <div class="subtask-item ${st.completed ? 'completed' : ''}" data-id="${st.id}">
                <label class="subtask-checkbox">
                    <input type="checkbox" ${st.completed ? 'checked' : ''}>
                </label>
                <span class="subtask-text">${this.escapeHTML(st.text)}</span>
                <button class="subtask-delete" title="Delete subtask">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // Bind events
        this.subtasksList.querySelectorAll('.subtask-checkbox input').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.closest('.subtask-item').dataset.id;
                this.toggleSubtask(id);
            });
        });

        this.subtasksList.querySelectorAll('.subtask-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.subtask-item').dataset.id;
                this.deleteSubtask(id);
            });
        });

        // Update progress
        const completed = subtasks.filter(st => st.completed).length;
        const total = subtasks.length;
        const percent = Math.round((completed / total) * 100);

        this.subtaskProgress.style.display = 'flex';
        this.subtaskProgressFill.style.width = `${percent}%`;
        this.subtaskProgressText.textContent = `${completed}/${total}`;
    }

    async addSubtask() {
        const text = this.subtaskInput.value.trim();
        if (!text || !this.currentTaskId) return;

        const taskId = this.currentTaskId;
        let savedToApi = false;

        // Create subtask object
        const subtask = {
            id: this.generateId(),
            task_id: taskId,
            text,
            completed: false,
            sort_order: (this.subtasks[taskId]?.length || 0)
        };

        if (this.isOnline) {
            try {
                const res = await fetch(`${this.API_BASE}/api-subtasks`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ task_id: taskId, text })
                });
                if (res.ok) {
                    const apiSubtask = await res.json();
                    subtask.id = apiSubtask.id; // Use the API-generated ID
                    savedToApi = true;
                }
            } catch (e) {
                console.error('Failed to add subtask to API:', e);
            }
        }

        // Always add to local state and localStorage
        if (!this.subtasks[taskId]) this.subtasks[taskId] = [];
        this.subtasks[taskId].push(subtask);
        localStorage.setItem(`subtasks_${taskId}`, JSON.stringify(this.subtasks[taskId]));

        this.subtaskInput.value = '';
        this.renderSubtasks();
        this.render(); // Update task list to show subtask indicator
    }

    async toggleSubtask(subtaskId) {
        const taskId = this.currentTaskId;
        const subtasks = this.subtasks[taskId] || [];
        const subtask = subtasks.find(st => String(st.id) === String(subtaskId));

        if (!subtask) return;

        subtask.completed = !subtask.completed;

        if (this.isOnline) {
            try {
                await fetch(`${this.API_BASE}/api-subtasks-id/${subtaskId}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ completed: subtask.completed })
                });
            } catch (e) {
                console.error('Failed to toggle subtask:', e);
            }
        }

        // Always save to localStorage as backup
        localStorage.setItem(`subtasks_${taskId}`, JSON.stringify(this.subtasks[taskId]));

        this.renderSubtasks();
        this.render(); // Update task list to show subtask progress
    }

    async deleteSubtask(subtaskId) {
        const taskId = this.currentTaskId;

        if (this.isOnline) {
            try {
                await fetch(`${this.API_BASE}/api-subtasks-id/${subtaskId}`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });
            } catch (e) {
                console.error('Failed to delete subtask:', e);
            }
        }

        this.subtasks[taskId] = (this.subtasks[taskId] || []).filter(st => String(st.id) !== String(subtaskId));

        // Always save to localStorage as backup
        localStorage.setItem(`subtasks_${taskId}`, JSON.stringify(this.subtasks[taskId]));

        this.renderSubtasks();
        this.render(); // Update task list
    }

    getSubtaskStats(taskId) {
        const subtasks = this.subtasks[taskId] || [];
        if (subtasks.length === 0) return null;

        const completed = subtasks.filter(st => st.completed).length;
        return { completed, total: subtasks.length };
    }

    // ============ FOCUS MODE ============

    openFocusMode() {
        this.focusModeActive = true;
        this.focusOverlay.style.display = 'block';
        this.focusModeBtn.classList.add('active');
        this.renderFocusTasks();
        document.body.style.overflow = 'hidden';
    }

    closeFocusMode() {
        this.focusModeActive = false;
        this.focusOverlay.style.display = 'none';
        this.focusModeBtn.classList.remove('active');
        document.body.style.overflow = '';
    }

    renderFocusTasks() {
        const focusedTasks = this.tasks.filter(t => t.is_focused && !t.completed);
        const completedFocused = this.tasks.filter(t => t.is_focused && t.completed);

        if (focusedTasks.length === 0 && completedFocused.length === 0) {
            this.focusTasksList.innerHTML = '';
            this.focusEmpty.style.display = 'block';
            return;
        }

        this.focusEmpty.style.display = 'none';

        const allFocused = [...focusedTasks, ...completedFocused];
        this.focusTasksList.innerHTML = allFocused.map(task => `
            <li class="focus-task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <label class="focus-task-checkbox">
                    <input type="checkbox" ${task.completed ? 'checked' : ''}>
                </label>
                <span class="focus-task-text">${this.escapeHTML(task.text)}</span>
                <button class="focus-task-unfocus" title="Remove from focus">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </button>
            </li>
        `).join('');

        // Bind events
        this.focusTasksList.querySelectorAll('.focus-task-checkbox input').forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const id = e.target.closest('.focus-task-item').dataset.id;
                await this.toggleTask(id);
                this.renderFocusTasks();
            });
        });

        this.focusTasksList.querySelectorAll('.focus-task-unfocus').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('.focus-task-item').dataset.id;
                await this.setTaskFocus(id, false);
                this.renderFocusTasks();
            });
        });
    }

    async toggleCurrentTaskFocus() {
        if (!this.currentTaskId) return;

        const task = this.tasks.find(t => String(t.id) === String(this.currentTaskId));
        if (task) {
            const newFocused = !task.is_focused;
            await this.setTaskFocus(this.currentTaskId, newFocused);
            this.updateFocusToggleUI(newFocused);
        }
    }

    async setTaskFocus(id, isFocused) {
        const task = this.tasks.find(t => String(t.id) === String(id));
        if (!task) return;

        task.is_focused = isFocused;

        if (this.isOnline) {
            try {
                await fetch(`${this.API_BASE}/api-tasks-id/${id}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ is_focused: isFocused })
                });
            } catch (e) {
                console.error('Failed to update task focus:', e);
            }
        } else {
            this.saveToLocalStorage();
        }

        this.render();
    }

    updateFocusToggleUI(isFocused) {
        if (isFocused) {
            this.focusToggle.classList.add('active');
            this.focusToggle.title = 'Remove from focus list';
        } else {
            this.focusToggle.classList.remove('active');
            this.focusToggle.title = 'Add to focus list';
        }
    }

    // ============ POMODORO TIMER ============

    startTimer() {
        if (this.timerRunning) return;

        this.timerRunning = true;
        this.timerStart.style.display = 'none';
        this.timerPause.style.display = 'inline-flex';

        this.timerInterval = setInterval(() => {
            this.timerSeconds--;

            if (this.timerSeconds <= 0) {
                this.onTimerComplete();
            } else {
                this.updateTimerDisplay();
            }
        }, 1000);
    }

    pauseTimer() {
        this.timerRunning = false;
        this.timerStart.style.display = 'inline-flex';
        this.timerPause.style.display = 'none';

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.pauseTimer();
        this.isBreakTime = false;
        this.timerSeconds = parseInt(this.workDuration.value) * 60;
        this.updateTimerDisplay();
        this.timerLabel.textContent = 'Work Time';
        this.timerLabel.classList.remove('break');
    }

    updateTimerSettings() {
        if (!this.timerRunning) {
            this.timerSeconds = parseInt(this.workDuration.value) * 60;
            this.updateTimerDisplay();
        }
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timerSeconds / 60);
        const seconds = this.timerSeconds % 60;
        this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    onTimerComplete() {
        this.pauseTimer();

        // Play notification sound and show notification
        this.playTimerNotification();

        // Toggle between work and break
        if (this.isBreakTime) {
            this.isBreakTime = false;
            this.timerSeconds = parseInt(this.workDuration.value) * 60;
            this.timerLabel.textContent = 'Work Time';
            this.timerLabel.classList.remove('break');
        } else {
            this.isBreakTime = true;
            this.timerSeconds = parseInt(this.breakDuration.value) * 60;
            this.timerLabel.textContent = 'Break Time';
            this.timerLabel.classList.add('break');
        }

        this.updateTimerDisplay();
    }

    playTimerNotification() {
        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
            const title = this.isBreakTime ? 'Work session complete!' : 'Break time over!';
            const body = this.isBreakTime ? 'Time for a break. Good work!' : 'Ready to focus again?';
            new Notification(title, { body, icon: '/icons/icon-192.svg' });
        }

        // Play a simple beep using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 200);
        } catch (e) {
            console.log('Audio notification not available');
        }
    }

    // ============ UTILITIES ============

    generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
    
    formatDateFull(iso) {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    }
    
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => { window.taskManager = new TaskManager(); });
