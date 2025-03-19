const vscode = acquireVsCodeApi();
let todos = [];
let currentFilter = 'ALL'; // 'ALL', 'TODO', or 'FIXME'

// Try to load state that was persisted from previous session
const previousState = vscode.getState();
if (previousState) {
    todos = previousState.todos || [];
    currentFilter = previousState.currentFilter || 'ALL';
    updateTodoList();
}

function getFileIcon(file) {
    const ext = file.split('.').pop().toLowerCase();
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
         return 'file-code';
    } else if (['css', 'scss', 'less'].includes(ext)) {
         return 'symbol-color';
    } else if (['json'].includes(ext)) {
         return 'file-code';
    } else {
         return 'file';
    }
}

// Create filter buttons
const filterButtons = document.createElement('div');
filterButtons.className = 'filter-buttons';
filterButtons.innerHTML = `
    <button class="filter-button ${currentFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All</button>
    <button class="filter-button ${currentFilter === 'TODO' ? 'active' : ''}" data-filter="TODO">TODO</button>
    <button class="filter-button ${currentFilter === 'FIXME' ? 'active' : ''}" data-filter="FIXME">FIXME</button>
`;

document.body.insertBefore(filterButtons, document.getElementById('todo-list'));

// Add click handlers for filter buttons
filterButtons.addEventListener('click', (e) => {
    const button = e.target.closest('.filter-button');
    if (button) {
        currentFilter = button.dataset.filter;
        // Update active state
        filterButtons.querySelectorAll('.filter-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === currentFilter);
        });
        // Save state
        vscode.setState({ todos, currentFilter });
        updateTodoList();
    }
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'updateTodos':
            todos = message.todos;
            // Save state
            vscode.setState({ todos, currentFilter });
            updateTodoList();
            break;
    }
});

function updateTodoList() {
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = '';

    // Filter todos based on current filter
    const filteredTodos = todos.filter(todo => {
        if (currentFilter === 'ALL') return true;
        return todo.type === currentFilter;
    });

    filteredTodos.forEach(todo => {
        const todoElement = document.createElement('div');
        todoElement.className = `todo-item ${todo.isDone ? 'done' : ''}`;
        todoElement.innerHTML = `
            <div class="todo-header">
                <div class="file-path">
                    <span class="file-icon codicon codicon-${getFileIcon(todo.file)}"></span>
                    ${todo.file}:${todo.line + 1} ${todo.isDone ? '<span class="done-label">done</span>' : ''}
                </div>
                <div class="todo-menu">
                    <i class="codicon codicon-kebab-vertical"></i>
                    <div class="context-menu">
                        <div class="context-menu-item">
                            Mark as ${todo.isDone ? 'not done' : 'done'}
                        </div>
                    </div>
                </div>
            </div>
            <div class="todo-text">${todo.text}</div>
        `;

        // Handle context menu
        const menuButton = todoElement.querySelector('.todo-menu');
        const contextMenu = todoElement.querySelector('.context-menu');
        
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other context menus
            document.querySelectorAll('.context-menu.active').forEach(menu => {
                if (menu !== contextMenu) {
                    menu.classList.remove('active');
                }
            });
            contextMenu.classList.toggle('active');
        });

        // Close context menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuButton.contains(e.target)) {
                contextMenu.classList.remove('active');
            }
        });

        // Handle context menu item click
        todoElement.querySelector('.context-menu-item').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTodo(todo.id);
            contextMenu.classList.remove('active');
        });

        todoElement.addEventListener('click', () => {
            vscode.postMessage({
                type: 'openFile',
                file: todo.file,
                line: todo.line
            });
        });

        todoList.appendChild(todoElement);
    });
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        const newIsDone = !todo.isDone;
        vscode.postMessage({
            type: 'markDoneInFile',
            file: todo.file,
            line: todo.line,
            isDone: newIsDone
        });
        vscode.postMessage({
            type: 'toggleTodo',
            id: id
        });
    }
}

// Notify the extension that the webview is ready
vscode.postMessage({ type: 'webviewLoaded' });
