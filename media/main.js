(function() {
    const vscode = acquireVsCodeApi();
    
    function refreshData() {
      vscode.postMessage({ command: 'refresh' });
    }
    
    function showTreeView() {
      vscode.postMessage({ command: 'showTree' });
    }
    
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.command) {
        case 'update':
          renderList(message.data);
          break;
      }
    });
    
    function renderList(items) {
      const container = document.getElementById('todo-list');
      container.innerHTML = '';
      
      if (items.length === 0) {
        container.innerHTML = '<div class="empty">No tasks found</div>';
        return;
      }
      
      items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `todo-item ${item.type.toLowerCase()}`;
        
        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'item-checkbox';
        
        // Main content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'item-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'item-header';
        header.textContent = `${item.type} in ${getFileName(item.file)}:${item.line}`;
        
        // Description
        const description = document.createElement('div');
        description.className = 'item-description';
        description.textContent = item.text;
        
        // Dropdown button
        const dropdownBtn = document.createElement('button');
        dropdownBtn.className = 'dropdown-btn';
        dropdownBtn.innerHTML = '▼';
        dropdownBtn.onclick = (e) => {
          e.stopPropagation();
          showTreeView();
        };
        
        contentDiv.appendChild(header);
        contentDiv.appendChild(description);
        contentDiv.appendChild(dropdownBtn);
        
        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(contentDiv);
        itemDiv.addEventListener('click', () => {
          vscode.postMessage({
            command: 'openFile',
            file: item.file,
            line: item.line
          });
        });
        
        container.appendChild(itemDiv);
      });
    }
    
    function getFileName(filePath) {
      return filePath.split(/[\\/]/).pop();
    }
  })();