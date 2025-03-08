import * as vscode from 'vscode';
import { TodoProvider } from './todoProvider';

export class TodoTreeDataProvider implements vscode.TreeDataProvider<TodoNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;
  
  constructor(private todoProvider: TodoProvider) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TodoNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TodoNode): Promise<TodoNode[]> {
    if (!element) {
      // Root level - group by file
      const items = await this.todoProvider.getChildren();
      const files = new Map<string, TodoNode>();
      
      items.forEach(item => {
        const key = item.fileUri.fsPath;
        if (!files.has(key)) {
          files.set(key, new TodoNode(
            key, // filePath
            vscode.TreeItemCollapsibleState.Collapsed,
            vscode.Uri.file(key).path,
            undefined, // line
            'file' // type
          ));
        }
      });
      
      return Array.from(files.values());
    }
    
    // Child level - show TODO/FIXME items
    const items = await this.todoProvider.getChildren();
    return items
      .filter(item => item.fileUri.fsPath === element.filePath)
      .map(item => new TodoNode(
        item.fileUri.fsPath,
        vscode.TreeItemCollapsibleState.None,
        item.text,
        item.line + 1,
        item.type
      ));
  }
}

class TodoNode extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    label: string,
    public readonly line?: number,
    public readonly type?: 'TODO' | 'FIXME' | 'file'
  ) {
    super(label, collapsibleState);
    
    this.tooltip = `${label}`;
    this.description = line ? `Line ${line}` : '';
    this.contextValue = type === 'TODO' ? 'todo-item' : type === 'FIXME' ? 'fixme-item' : 'file-node';
    
    if (type !== 'file') {
      this.command = {
        command: 'codemagnet.openFile',
        title: 'Open File',
        arguments: [filePath, line]
      };
    }
    
    // Set icons based on type
    if (type === 'TODO') {
      this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('codemagnet.todo.icon'));
    } else if (type === 'FIXME') {
      this.iconPath = new vscode.ThemeIcon('alert', new vscode.ThemeColor('codemagnet.fixme.icon'));
    } else {
      this.iconPath = vscode.ThemeIcon.File;
    }
  }
}