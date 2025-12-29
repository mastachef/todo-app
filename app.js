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
        
        // Use Render backend if on Netlify, otherwise use current origin
        const isNetlify = window.location.hostname.includes('netlify.app') || 
                         window.location.hostname.includes('netlify.com');
        this.API_BASE = isNetlify 
            ? 'https://todo-app-yyrd.onrender.com'  // Your Render backend URL
            : window.location.origin;
        
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
        this.resendVerification = document.getElementById('resend-verification');
        this.resendBtn = document.getElementById('resend-btn');
        this.pendingEmail = null;
        
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
        this.enableNotifications = document.getElementById('enable-notifications');
        
        // Sort
        this.sortBtn = document.getElementById('sort-btn');
        this.sortMenu = document.getElementById('sort-menu');
        this.sortLabel = document.getElementById('sort-label');
        
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
        this.checkUrlParams();
        await this.checkAuth();
        this.bindEvents();
        this.registerServiceWorker();
    }
    
    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('verified') === '1') {
            this.authSuccess.textContent = 'Email verified! You can now sign in.';
            window.history.replaceState({}, '', '/');
        }
        if (params.get('error') === 'invalid-token') {
            this.authError.textContent = 'Invalid or expired verification link.';
            window.history.replaceState({}, '', '/');
        }
    }
    
    // ============ AUTH ============
    
    async checkAuth() {
        try {
            const res = await fetch(`${this.API_BASE}/auth/me`, { credentials: 'include' });
            const data = await res.json();
            
            if (data.user) {
                this.user = data.user;
                this.isOnline = true;
                this.showApp();
                await this.loadFromServer();
            } else {
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
        this.resendVerification.style.display = 'none';
        
        try {
            const res = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                this.user = data.user;
                this.isOnline = true;
                this.showApp();
                await this.loadFromServer();
            } else {
                this.authError.textContent = data.error || 'Login failed';
                if (data.needsVerification) {
                    this.pendingEmail = email;
                    this.resendVerification.style.display = 'block';
                }
            }
        } catch (e) {
            this.authError.textContent = 'Server unavailable';
        }
    }
    
    async register(email, password, name) {
        this.authError.textContent = '';
        this.authSuccess.textContent = '';
        
        try {
            const res = await fetch(`${this.API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, name })
            });
            const data = await res.json();
            
            if (res.ok) {
                if (data.user) {
                    // Auto-verified (dev mode)
                    this.user = data.user;
                    this.isOnline = true;
                    this.showApp();
                    await this.loadFromServer();
                } else {
                    // Email verification required
                    this.authSuccess.textContent = data.message;
                    this.pendingEmail = email;
                    this.resendVerification.style.display = 'block';
                    // Switch to login tab
                    this.authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'login'));
                    this.loginForm.style.display = 'flex';
                    this.registerForm.style.display = 'none';
                }
            } else {
                this.authError.textContent = data.error || 'Registration failed';
            }
        } catch (e) {
            this.authError.textContent = 'Server unavailable';
        }
    }
    
    async resendVerificationEmail() {
        if (!this.pendingEmail) return;
        
        try {
            const res = await fetch(`${this.API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.pendingEmail })
            });
            const data = await res.json();
            this.authSuccess.textContent = 'Verification email sent!';
        } catch (e) {
            this.authError.textContent = 'Failed to send email';
        }
    }
    
    async logout() {
        try {
            await fetch(`${this.API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch (e) {}
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
                fetch(`${this.API_BASE}/api/lists`, { credentials: 'include' }),
                fetch(`${this.API_BASE}/api/tasks`, { credentials: 'include' })
            ]);
            
            if (!listsRes.ok || !tasksRes.ok) {
                // If 401, user session expired
                if (listsRes.status === 401 || tasksRes.status === 401) {
                    console.log('Session expired, switching to offline mode');
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
            
            // Normalize completed field from integer (0/1) to boolean
            // Also normalize list_id to number for consistent comparison
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
            // Ensure tasks is an array before loading from localStorage
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
        
        if (!this.lists.find(l => l.id === this.currentListId)) {
            this.currentListId = Number(this.lists[0].id);
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
        this.resendBtn.addEventListener('click', () => this.resendVerificationEmail());
        
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
        
        // Notifications
        this.enableNotifications.addEventListener('click', () => this.requestNotificationPermission());
        
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
            }
        });
    }
    
    // ============ LISTS ============
    
    async createList(name) {
        if (this.isOnline) {
            const res = await fetch(`${this.API_BASE}/api/lists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
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
            await fetch(`${this.API_BASE}/api/lists/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name })
            });
        }
        const list = this.lists.find(l => l.id === id);
        if (list) list.name = name;
        if (!this.isOnline) this.saveToLocalStorage();
    }
    
    async deleteList(id) {
        if (this.isOnline) {
            await fetch(`${this.API_BASE}/api/lists/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        }
        this.lists = this.lists.filter(l => l.id !== id);
        this.tasks = this.tasks.filter(t => t.list_id !== id);
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
        const list = this.lists.find(l => l.id === listId);
        if (!list) return;
        this.editingListId = listId;
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
            if (this.editingListId === this.currentListId) {
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
        
        if (this.currentListId === this.editingListId) {
            this.currentListId = Number(this.lists[0].id);
            this.updateTitle();
        }
        
        this.renderTabs();
        this.render();
        this.closeListModal();
    }
    
    switchList(listId) {
        // Normalize listId to number for consistent comparison
        const normalizedId = Number(listId);
        if (normalizedId === Number(this.currentListId)) return;
        this.currentListId = normalizedId;
        this.updateTitle();
        if (!this.isOnline) this.saveToLocalStorage();
        this.renderTabs();
        this.render();
    }
    
    updateTitle() {
        const list = this.lists.find(l => l.id === this.currentListId);
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
            <button class="list-tab ${list.id === this.currentListId ? 'active' : ''}" data-list-id="${list.id}">
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
            // Normalize both to numbers for comparison
            const taskListId = Number(t.list_id);
            const currentListIdNum = Number(this.currentListId);
            const matches = taskListId === currentListIdNum || t.list_id == this.currentListId;
            if (!matches && t.list_id !== undefined) {
                console.log('Task filtered out:', { 
                    taskId: t.id, 
                    taskListId: t.list_id, 
                    taskListIdType: typeof t.list_id,
                    currentListId: this.currentListId,
                    currentListIdType: typeof this.currentListId
                });
            }
            return matches;
        });
        return filtered;
    }
    
    async addTask(text) {
        const task = {
            list_id: this.currentListId,
            text,
            notes: '',
            priority: 'none',
            completed: 0,
            created_at: new Date().toISOString(),
            completed_at: null,
            reminder_time: null,
            reminder_repeat: null
        };
        
        // Ensure tasks is an array - check right before use
        if (!Array.isArray(this.tasks)) {
            console.warn('this.tasks was not an array, resetting...');
            this.tasks = [];
        }
        
        if (this.isOnline) {
            try {
                const res = await fetch(`${this.API_BASE}/api/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(task)
                });
                
                if (res.ok) {
                    const created = await res.json();
                    // Normalize completed field from integer (0/1) to boolean
                    created.completed = !!created.completed;
                    // Normalize list_id to match currentListId type
                    if (created.list_id !== undefined) {
                        created.list_id = Number(created.list_id);
                    }
                    // Ensure tasks is still an array before adding
                    if (!Array.isArray(this.tasks)) this.tasks = [];
                    this.tasks.unshift(created);
                    console.log('Task added:', created);
                    console.log('Current List ID:', this.currentListId, typeof this.currentListId);
                    console.log('Task List ID:', created.list_id, typeof created.list_id);
                    console.log('All tasks after add:', this.tasks.length);
                } else {
                    const errorText = await res.text();
                    console.error('Failed to create task:', res.status, errorText);
                    
                    // If 401, user is not authenticated - switch to offline mode
                    if (res.status === 401) {
                        console.log('Session expired, switching to offline mode');
                        this.isOnline = false;
                        this.user = null;
                        // Load from localStorage if available
                        this.loadFromLocalStorage();
                    }
                    
                    // Fallback to local storage on error
                    if (!Array.isArray(this.tasks)) this.tasks = [];
                    task.id = this.generateId();
                    task.completed = false; // Ensure boolean
                    this.tasks.unshift(task);
                    this.saveToLocalStorage();
                }
            } catch (e) {
                console.error('Error creating task:', e);
                // Fallback to local storage on network error
                this.isOnline = false;
                if (!Array.isArray(this.tasks)) this.tasks = [];
                task.id = this.generateId();
                task.completed = false; // Ensure boolean
                this.tasks.unshift(task);
                this.saveToLocalStorage();
            }
        } else {
            if (!Array.isArray(this.tasks)) this.tasks = [];
            task.id = this.generateId();
            task.completed = false; // Ensure boolean
            this.tasks.unshift(task);
            this.saveToLocalStorage();
        }
        
        this.render();
        this.newTaskInput.focus();
    }
    
    async updateTask(id, updates) {
        if (this.isOnline) {
            const res = await fetch(`${this.API_BASE}/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updates)
            });
            const updated = await res.json();
            // Normalize completed field from integer (0/1) to boolean
            updated.completed = !!updated.completed;
            const idx = this.tasks.findIndex(t => t.id === id);
            if (idx !== -1) this.tasks[idx] = updated;
        } else {
            const task = this.tasks.find(t => t.id === id);
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
            await fetch(`${this.API_BASE}/api/tasks/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        }
        this.tasks = this.tasks.filter(t => t.id !== id);
        if (!this.isOnline) this.saveToLocalStorage();
    }
    
    async toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            await this.updateTask(id, { completed: !task.completed });
            this.render();
        }
    }
    
    // ============ TASK MODAL ============
    
    openTaskModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        this.currentTaskId = taskId;
        this.modalCheckbox.checked = task.completed;
        this.modalTaskText.value = task.text;
        this.modalNotes.value = task.notes || '';
        this.setModalPriority(task.priority || 'none');
        
        // Reminder
        if (task.reminder_time) {
            const dt = new Date(task.reminder_time);
            this.reminderTime.value = dt.toISOString().slice(0, 16);
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
        
        console.log('Render - Current List ID:', this.currentListId, typeof this.currentListId);
        console.log('Render - All tasks:', this.tasks.length);
        console.log('Render - List tasks:', listTasks.length);
        console.log('Render - Active tasks:', activeTasks.length);
        if (this.tasks.length > 0) {
            console.log('Sample task list_ids:', this.tasks.slice(0, 3).map(t => ({ id: t.id, list_id: t.list_id, type: typeof t.list_id })));
        }
        
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
    
    // ============ NOTIFICATIONS ============
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
            } catch (e) {
                console.log('SW registration failed');
            }
        }
    }
    
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            alert('This browser does not support notifications');
            return;
        }
        
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await this.subscribeToPush();
            alert('Notifications enabled!');
        }
    }
    
    async subscribeToPush() {
        try {
            const reg = await navigator.serviceWorker.ready;
            const keyRes = await fetch(`${this.API_BASE}/api/push/vapid-public-key`);
            const { key } = await keyRes.json();
            
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(key)
            });
            
            await fetch(`${this.API_BASE}/api/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ subscription })
            });
        } catch (e) {
            console.error('Push subscription failed:', e);
        }
    }
    
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
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
