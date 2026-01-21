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
        this.searchInput = document.getElementById('search-input');
        this.searchClear = document.getElementById('search-clear');
        this.searchResults = document.getElementById('search-results');
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
        this.clearReminder = document.getElementById('clear-reminder');
        
        // List Modal
        this.listModal = document.getElementById('list-modal');
        this.listModalClose = document.getElementById('list-modal-close');
        this.listModalTitle = document.getElementById('list-modal-title');
        this.listNameInput = document.getElementById('list-name-input');
        this.listDelete = document.getElementById('list-delete');
        this.listSave = document.getElementById('list-save');
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
                this.closeSearch();
            }
        });

        // Search
        this.searchInput.addEventListener('input', () => this.handleSearchInput());
        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.trim()) {
                this.searchResults.style.display = 'block';
            }
        });
        this.searchClear.addEventListener('click', () => this.clearSearch());

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            const searchContainer = document.getElementById('search-container');
            if (!searchContainer.contains(e.target)) {
                this.searchResults.style.display = 'none';
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
        const html = this.lists.map(list => `
            <button class="list-tab ${String(list.id) === String(this.currentListId) ? 'active' : ''}" data-list-id="${list.id}">
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
            tab.addEventListener('click', (e) => {
                const editIcon = e.target.closest('.edit-icon');
                if (editIcon) {
                    e.stopPropagation();
                    this.editList(editIcon.dataset.edit);
                } else {
                    this.switchList(tab.dataset.listId);
                }
            });
        });
        
        document.getElementById('add-list-btn').addEventListener('click', () => this.addList());
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
    
    async deleteTask(id) {
        if (this.isOnline) {
            await fetch(`${this.API_BASE}/api-tasks-id/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
        }
        this.tasks = this.tasks.filter(t => String(t.id) !== String(id));
        if (!this.isOnline) this.saveToLocalStorage();
    }
    
    async toggleTask(id) {
        // Handle both string and number IDs
        const task = this.tasks.find(t => String(t.id) === String(id));
        if (task) {
            await this.updateTask(task.id, { completed: !task.completed });
            this.render();
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
            reminder_repeat: this.reminderRepeat.value || null
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
        
        const priorityFlag = priority !== 'none' ? `
            <span class="task-priority-flag" data-priority="${priority}">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                    <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
            </span>
        ` : '';
        
        return `
            <li class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <label class="task-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" ${task.completed ? 'checked' : ''}>
                    <span class="checkmark">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                </label>
                <button type="button" class="task-content" onclick="window.taskManager.openTaskModal('${task.id}')">
                    <p class="task-text">${this.escapeHTML(task.text)}</p>
                    ${hasNotes ? `<p class="task-notes-preview">${this.escapeHTML(notesPreview)}</p>` : ''}
                    ${hasReminder ? `<span class="task-reminder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Reminder set</span>` : ''}
                </button>
                ${priorityFlag}
            </li>
        `;
    }
    
    bindTaskEvents() {
        document.querySelectorAll('.task-checkbox input').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const id = e.target.closest('.task-item').dataset.id;
                this.toggleTask(id);
            });
        });
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
        
        if (Notification.permission === 'granted') {
            this.notificationsBtnText.textContent = 'Notifications Enabled ✓';
            this.enableNotificationsBtn.style.opacity = '0.7';
        } else if (Notification.permission === 'denied') {
            this.notificationsBtnText.textContent = 'Notifications Blocked';
            this.enableNotificationsBtn.style.opacity = '0.5';
        } else {
            this.notificationsBtnText.textContent = 'Enable Notifications';
        }
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
                await this.subscribeToPush();
                this.updateNotificationButtonState();
                
                // Show test notification
                if (this.swRegistration) {
                    this.swRegistration.showNotification('Notifications Enabled! 🎉', {
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

    handleSearchInput() {
        const query = this.searchInput.value.trim();

        // Show/hide clear button
        this.searchClear.style.display = query ? 'block' : 'none';

        // Debounce search
        clearTimeout(this.searchTimeout);

        if (!query) {
            this.searchResults.style.display = 'none';
            return;
        }

        this.searchTimeout = setTimeout(() => this.performSearch(query), 300);
    }

    async performSearch(query) {
        this.searchResults.style.display = 'block';
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

                // Close search and open task modal
                this.closeSearch();
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
        this.searchResults.style.display = 'none';
        this.searchInput.focus();
    }

    closeSearch() {
        this.searchResults.style.display = 'none';
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
