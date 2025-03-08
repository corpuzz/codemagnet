(function() {
    const vscode = acquireVsCodeApi();
    
    function refreshData() {
      vscode.postMessage({ command: 'refresh' });
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
        
        const header = document.createElement('div');
        header.className = 'item-header';
        header.textContent = `${item.type} in ${getFileName(item.file)}:${item.line}`;
        
        const content = document.createElement('div');
        content.className = 'item-content';
        content.textContent = item.text;
        
        itemDiv.appendChild(header);
        itemDiv.appendChild(content);
        itemDiv.addEventListener('click', () => {
          vscode.postMessage({
            command: 'openFile',
            file: item.file,
            line: item.line - 1 // Convert to zero-based index
          });
        });
        
        container.appendChild(itemDiv);
      });
    }
    
    function getFileName(filePath) {
      return filePath.split(/[\\/]/).pop();
    }
  })();