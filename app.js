// Task Manager Application
class TaskManager {
    constructor() {
        this.lists = [];
        this.currentListId = null;
        this.currentTaskId = null;
        this.currentPriority = 'none';
        this.currentSort = 'newest';
        this.editingListId = null;
        
        this.storageKey = 'taskManager_data';
        this.themeKey = 'taskManager_theme';
        
        // DOM Elements
        this.newTaskInput = document.getElementById('new-task-input');
        this.activeTasksList = document.getElementById('active-tasks');
        this.completedTasksList = document.getElementById('completed-tasks');
        this.activeCount = document.getElementById('active-count');
        this.completedCount = document.getElementById('completed-count');
        this.completedSection = document.getElementById('completed-section');
        this.completedHeader = document.getElementById('completed-header');
        this.collapseBtn = document.getElementById('collapse-btn');
        this.documentTitle = document.querySelector('.document-title');
        this.listTabs = document.getElementById('list-tabs');
        
        // Theme toggle
        this.themeToggle = document.getElementById('theme-toggle');
        
        // Sort controls
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
        
        // List Modal
        this.listModal = document.getElementById('list-modal');
        this.listModalClose = document.getElementById('list-modal-close');
        this.listModalTitle = document.getElementById('list-modal-title');
        this.listNameInput = document.getElementById('list-name-input');
        this.listDelete = document.getElementById('list-delete');
        this.listSave = document.getElementById('list-save');
        
        this.init();
    }
    
    init() {
        this.loadTheme();
        this.loadData();
        this.bindEvents();
        this.renderTabs();
        this.render();
    }
    
    // Theme Management
    loadTheme() {
        const savedTheme = localStorage.getItem(this.themeKey);
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            // Check system preference
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
        }
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(this.themeKey, newTheme);
    }
    
    bindEvents() {
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Sort dropdown
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
        
        // Close sort menu when clicking outside
        document.addEventListener('click', () => {
            this.sortMenu.classList.remove('open');
        });
        
        // New task input
        this.newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.newTaskInput.value.trim()) {
                this.addTask(this.newTaskInput.value.trim());
                this.newTaskInput.value = '';
            }
        });
        
        // Collapse completed section
        this.completedHeader.addEventListener('click', (e) => {
            if (e.target.closest('.collapse-btn') || e.target === this.completedHeader) {
                this.toggleCompleted();
            }
        });
        
        // Save title on change
        this.documentTitle.addEventListener('blur', () => {
            this.saveTitle();
        });
        
        this.documentTitle.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.documentTitle.blur();
            }
        });
        
        // Task Modal events
        this.modalClose.addEventListener('click', () => this.closeTaskModal());
        this.taskModal.addEventListener('click', (e) => {
            if (e.target === this.taskModal) this.closeTaskModal();
        });
        this.modalSave.addEventListener('click', () => this.saveTaskChanges());
        this.modalDelete.addEventListener('click', () => this.deleteCurrentTask());
        this.modalCheckbox.addEventListener('change', () => this.toggleCurrentTask());
        
        // Priority flag buttons
        document.querySelectorAll('.priority-flag').forEach(btn => {
            btn.addEventListener('click', () => this.setModalPriority(btn.dataset.priority));
        });
        
        // List Modal events
        this.listModalClose.addEventListener('click', () => this.closeListModal());
        this.listModal.addEventListener('click', (e) => {
            if (e.target === this.listModal) this.closeListModal();
        });
        this.listSave.addEventListener('click', () => this.saveListChanges());
        this.listDelete.addEventListener('click', () => this.deleteCurrentList());
        this.listNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveListChanges();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTaskModal();
                this.closeListModal();
            }
        });
    }
    
    // Data Management
    loadData() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            const data = JSON.parse(stored);
            this.lists = data.lists || [];
            this.currentListId = data.currentListId;
        }
        
        // Create default list if none exist
        if (this.lists.length === 0) {
            const defaultList = {
                id: this.generateId(),
                name: 'My Tasks',
                tasks: []
            };
            this.lists.push(defaultList);
            this.currentListId = defaultList.id;
            this.saveData();
        }
        
        // Ensure currentListId is valid
        if (!this.lists.find(l => l.id === this.currentListId)) {
            this.currentListId = this.lists[0].id;
        }
        
        // Update document title
        const currentList = this.getCurrentList();
        if (currentList) {
            this.documentTitle.textContent = currentList.name;
            document.title = currentList.name;
        }
    }
    
    saveData() {
        const data = {
            lists: this.lists,
            currentListId: this.currentListId
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }
    
    getCurrentList() {
        return this.lists.find(l => l.id === this.currentListId);
    }
    
    // List Management
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
    
    saveListChanges() {
        const name = this.listNameInput.value.trim();
        if (!name) return;
        
        if (this.editingListId) {
            // Edit existing list
            const list = this.lists.find(l => l.id === this.editingListId);
            if (list) {
                list.name = name;
                if (this.editingListId === this.currentListId) {
                    this.documentTitle.textContent = name;
                    document.title = name;
                }
            }
        } else {
            // Create new list
            const newList = {
                id: this.generateId(),
                name: name,
                tasks: []
            };
            this.lists.push(newList);
            this.currentListId = newList.id;
            this.documentTitle.textContent = name;
            document.title = name;
        }
        
        this.saveData();
        this.renderTabs();
        this.render();
        this.closeListModal();
    }
    
    deleteCurrentList() {
        if (this.lists.length <= 1) return;
        
        const index = this.lists.findIndex(l => l.id === this.editingListId);
        if (index > -1) {
            this.lists.splice(index, 1);
            
            // Switch to another list
            if (this.currentListId === this.editingListId) {
                this.currentListId = this.lists[0].id;
                const newList = this.getCurrentList();
                this.documentTitle.textContent = newList.name;
                document.title = newList.name;
            }
            
            this.saveData();
            this.renderTabs();
            this.render();
        }
        
        this.closeListModal();
    }
    
    switchList(listId) {
        if (listId === this.currentListId) return;
        
        this.currentListId = listId;
        const list = this.getCurrentList();
        this.documentTitle.textContent = list.name;
        document.title = list.name;
        
        this.saveData();
        this.renderTabs();
        this.render();
    }
    
    saveTitle() {
        const title = this.documentTitle.textContent.trim();
        const list = this.getCurrentList();
        if (list && title) {
            list.name = title;
            document.title = title;
            this.saveData();
            this.renderTabs();
        }
    }
    
    renderTabs() {
        const tabsHTML = this.lists.map(list => `
            <button class="list-tab ${list.id === this.currentListId ? 'active' : ''}" data-list-id="${list.id}">
                <span class="list-tab-name">${this.escapeHTML(list.name)}</span>
                <svg class="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" data-edit="${list.id}">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </button>
        `).join('');
        
        this.listTabs.innerHTML = tabsHTML + `
            <button class="add-list-btn" id="add-list-btn" title="Add new list">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>
        `;
        
        // Bind tab events
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
    
    // Task CRUD Operations
    addTask(text) {
        const list = this.getCurrentList();
        if (!list) return;
        
        const task = {
            id: this.generateId(),
            text: text,
            notes: '',
            priority: 'none',
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        
        list.tasks.unshift(task);
        this.saveData();
        this.render();
        
        // Focus back on input for quick entry
        this.newTaskInput.focus();
    }
    
    toggleTask(id) {
        const list = this.getCurrentList();
        if (!list) return;
        
        const task = list.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            this.saveData();
            this.render();
        }
    }
    
    deleteTask(id) {
        const list = this.getCurrentList();
        if (!list) return;
        
        list.tasks = list.tasks.filter(t => t.id !== id);
        this.saveData();
        this.render();
    }
    
    // Task Modal
    openTaskModal(taskId) {
        const list = this.getCurrentList();
        if (!list) return;
        
        const task = list.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        this.currentTaskId = taskId;
        
        // Populate modal
        this.modalCheckbox.checked = task.completed;
        this.modalTaskText.value = task.text;
        this.modalNotes.value = task.notes || '';
        
        // Set priority selection
        this.setModalPriority(task.priority || 'none');
        
        // Render timestamps
        this.modalMeta.innerHTML = `
            <div class="modal-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Created: <strong>${this.formatDateFull(task.createdAt)}</strong></span>
            </div>
            ${task.completedAt ? `
            <div class="modal-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Completed: <strong>${this.formatDateFull(task.completedAt)}</strong></span>
            </div>
            ` : ''}
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
    
    saveTaskChanges() {
        if (!this.currentTaskId) return;
        
        const list = this.getCurrentList();
        if (!list) return;
        
        const task = list.tasks.find(t => t.id === this.currentTaskId);
        if (task) {
            task.text = this.modalTaskText.value.trim() || task.text;
            task.notes = this.modalNotes.value.trim();
            task.priority = this.currentPriority || 'none';
            this.saveData();
            this.render();
        }
        
        this.closeTaskModal();
    }
    
    setModalPriority(priority) {
        this.currentPriority = priority;
        document.querySelectorAll('.priority-flag').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.priority === priority);
        });
    }
    
    deleteCurrentTask() {
        if (this.currentTaskId) {
            this.deleteTask(this.currentTaskId);
            this.closeTaskModal();
        }
    }
    
    toggleCurrentTask() {
        if (!this.currentTaskId) return;
        
        const list = this.getCurrentList();
        if (!list) return;
        
        const task = list.tasks.find(t => t.id === this.currentTaskId);
        if (task) {
            task.completed = this.modalCheckbox.checked;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            // Update meta display
            this.modalMeta.innerHTML = `
                <div class="modal-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>Created: <strong>${this.formatDateFull(task.createdAt)}</strong></span>
                </div>
                ${task.completedAt ? `
                <div class="modal-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>Completed: <strong>${this.formatDateFull(task.completedAt)}</strong></span>
                </div>
                ` : ''}
            `;
            
            this.saveData();
        }
    }
    
    // List Modal
    openListModal() {
        this.listModal.classList.add('open');
        this.listNameInput.focus();
    }
    
    closeListModal() {
        this.listModal.classList.remove('open');
        this.editingListId = null;
    }
    
    // Rendering
    render() {
        const list = this.getCurrentList();
        if (!list) return;
        
        let activeTasks = list.tasks.filter(t => !t.completed);
        let completedTasks = list.tasks.filter(t => t.completed);
        
        // Sort active tasks based on current sort setting
        activeTasks = this.sortTasks(activeTasks);
        // Completed tasks always sorted by completion date (newest first)
        completedTasks.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        
        // Render active tasks
        this.activeTasksList.innerHTML = activeTasks.length 
            ? activeTasks.map(task => this.createTaskHTML(task)).join('')
            : '<li class="empty-state">No tasks yet. Add one above!</li>';
        
        // Render completed tasks
        this.completedTasksList.innerHTML = completedTasks.length
            ? completedTasks.map(task => this.createTaskHTML(task)).join('')
            : '<li class="empty-state">Completed tasks will appear here</li>';
        
        // Update counts
        this.activeCount.textContent = activeTasks.length;
        this.completedCount.textContent = completedTasks.length;
        
        // Show/hide completed section
        this.completedSection.style.display = completedTasks.length > 0 ? 'block' : 'none';
        
        // Bind task events
        this.bindTaskEvents();
    }
    
    createTaskHTML(task) {
        const hasNotes = task.notes && task.notes.trim().length > 0;
        const notesPreview = hasNotes ? task.notes.trim().substring(0, 60) + (task.notes.length > 60 ? '...' : '') : '';
        const priority = task.priority || 'none';
        
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </span>
                </label>
                <button type="button" class="task-content" aria-label="View task details" onclick="window.taskManager.openTaskModal('${task.id}')">
                    <p class="task-text">${this.escapeHTML(task.text)}</p>
                    ${hasNotes ? `<p class="task-notes-preview">${this.escapeHTML(notesPreview)}</p>` : ''}
                </button>
                ${priorityFlag}
            </li>
        `;
    }
    
    bindTaskEvents() {
        // Checkbox toggles (with stopPropagation already in HTML)
        document.querySelectorAll('.task-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const taskItem = e.target.closest('.task-item');
                const id = taskItem.dataset.id;
                this.toggleTask(id);
            });
        });
        // Task content click handled via inline onclick in createTaskHTML
    }
    
    toggleCompleted() {
        this.completedSection.classList.toggle('collapsed');
    }
    
    setSort(sortType) {
        this.currentSort = sortType;
        const labels = { newest: 'Newest', oldest: 'Oldest', priority: 'Priority' };
        this.sortLabel.textContent = labels[sortType];
        
        // Update active state
        document.querySelectorAll('.sort-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === sortType);
        });
        
        this.render();
    }
    
    sortTasks(tasks) {
        const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 };
        
        switch (this.currentSort) {
            case 'oldest':
                return tasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            case 'priority':
                return tasks.sort((a, b) => {
                    const pA = priorityOrder[a.priority || 'none'];
                    const pB = priorityOrder[b.priority || 'none'];
                    if (pA !== pB) return pA - pB;
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });
            case 'newest':
            default:
                return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
    }
    
    // Utilities
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    formatDateFull(isoString) {
        const date = new Date(isoString);
        const options = { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }
    
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.taskManager = new TaskManager();
});
