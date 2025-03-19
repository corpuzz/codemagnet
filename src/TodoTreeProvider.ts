import * as vscode from 'vscode';
import * as path from 'path';

interface TodoItem {
    id: string;
    file: string;
    line: number;
    text: string;
    type: 'TODO' | 'FIXME';
    isDone: boolean;
    iconPath: string;
}

export class TodoTreeProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private todos: TodoItem[] = [];
    private refreshTimeout: NodeJS.Timeout | undefined;
    private context: vscode.ExtensionContext;
    private currentDecoration?: vscode.TextEditorDecorationType;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
    ) {
        this.context = context;
        // Create the decoration type once
        this.currentDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
            isWholeLine: true
        });
    }

    private getFileIcon(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.ts':
                return 'typescript';
            case '.js':
                return 'javascript';
            case '.py':
                return 'python';
            case '.java':
                return 'java';
            case '.cpp':
            case '.c':
            case '.h':
            case '.hpp':
                return 'cpp';
            case '.cs':
                return 'csharp';
            case '.go':
                return 'go';
            case '.rb':
                return 'ruby';
            case '.php':
                return 'php';
            case '.json':
                return 'json';
            case '.md':
                return 'markdown';
            case '.html':
                return 'html';
            case '.css':
            case '.scss':
            case '.less':
                return 'css';
            case '.xml':
                return 'xml';
            case '.yaml':
            case '.yml':
                return 'yaml';
            default:
                return 'file';
        }
    }

    public async refresh() {
        // Clear any pending refresh
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        // Debounce the refresh operation
        this.refreshTimeout = setTimeout(async () => {
            if (this._view) {
                await this.findTodos();
            }
            this.refreshTimeout = undefined;
        }, 500); // Wait 500ms before refreshing
    }

    private clearHighlight() {
        // Clear highlight from all visible editors
        vscode.window.visibleTextEditors.forEach(editor => {
            if (this.currentDecoration) {
                editor.setDecorations(this.currentDecoration, []);
            }
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Load saved state
        this.loadPersistedTodos();

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'toggleTodo':
                    const todo = this.todos.find(t => t.id === data.id);
                    if (todo) {
                        todo.isDone = !todo.isDone;
                        this.persistTodos(); // Save state after toggle
                        this._view?.webview.postMessage({ type: 'updateTodos', todos: this.todos });
                    }
                    break;
                case 'openFile':
                    try {
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (workspaceFolder) {
                            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, data.file);
                            const document = await vscode.workspace.openTextDocument(fileUri);
                            const editor = await vscode.window.showTextDocument(document);
                            
                            // Clear previous highlight
                            this.clearHighlight();
                            
                            // Find the containing function
                            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                                'vscode.executeDocumentSymbolProvider',
                                document.uri
                            );

                            const position = new vscode.Position(data.line, 0);
                            let functionRange: vscode.Range | undefined;

                            if (symbols) {
                                functionRange = this.findContainingFunction(symbols, position);
                            }

                            // If we found a containing function, highlight it
                            if (functionRange && this.currentDecoration) {
                                editor.setDecorations(this.currentDecoration, [functionRange]);

                                // Reveal the function
                                editor.revealRange(
                                    functionRange,
                                    vscode.TextEditorRevealType.InCenter
                                );
                            }

                            // Set cursor to the TODO line
                            editor.selection = new vscode.Selection(position, position);
                        }
                    } catch (error) {
                        console.error('Error opening file:', error);
                    }
                    break;
                case 'markDoneInFile':
                    try {
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (workspaceFolder) {
                            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, data.file);
                            const document = await vscode.workspace.openTextDocument(fileUri);
                            const edit = new vscode.WorkspaceEdit();
                            const line = document.lineAt(data.line);
                            const text = line.text;
                            
                            // Add or remove @done tag
                            let newText;
                            if (data.isDone) {
                                // Add @done after TODO or FIXME
                                newText = text.replace(/(TODO|FIXME)(:?)/, '$1@done$2');
                            } else {
                                // Remove @done
                                newText = text.replace(/(TODO|FIXME)@done(:?)/, '$1$2');
                            }
                            
                            if (newText !== text) {
                                edit.replace(document.uri, line.range, newText);
                                await vscode.workspace.applyEdit(edit);
                            }
                        }
                    } catch (error) {
                        console.error('Error marking done in file:', error);
                    }
                    break;
                case 'refresh':
                    await this.findTodos();
                    break;
                case 'webviewLoaded':
                    // When webview is loaded/reloaded, send the current todos
                    this._view?.webview.postMessage({ type: 'updateTodos', todos: this.todos });
                    break;
            }
        });

        // Initial load of todos if we don't have any
        if (this.todos.length === 0) {
            this.findTodos();
        }
    }

    private findContainingFunction(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.Range | undefined {
        for (const symbol of symbols) {
            // Check if this symbol contains the position
            if (symbol.range.contains(position)) {
                // If it's a function/method/constructor
                if (symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Method ||
                    symbol.kind === vscode.SymbolKind.Constructor) {
                    return symbol.range;
                }

                // Recursively check children
                if (symbol.children.length > 0) {
                    const childResult = this.findContainingFunction(symbol.children, position);
                    if (childResult) {
                        return childResult;
                    }
                }

                // If no function found in children but this is a class/module/namespace
                // return its range as fallback
                if (symbol.kind === vscode.SymbolKind.Class ||
                    symbol.kind === vscode.SymbolKind.Module ||
                    symbol.kind === vscode.SymbolKind.Namespace) {
                    return symbol.range;
                }
            }
        }
        return undefined;
    }

    private async findTodos() {
        const newTodos: TodoItem[] = [];
        const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java,cpp,c,h,hpp,cs,go,rb,php}');

        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();
            const lines = text.split('\n');
            const iconPath = this.getFileIcon(file.fsPath);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('TODO') || line.includes('FIXME')) {
                    const type = line.includes('TODO') ? 'TODO' : 'FIXME';
                    newTodos.push({
                        id: `${file.fsPath}-${i}`,
                        file: vscode.workspace.asRelativePath(file),
                        line: i,
                        text: line.trim(),
                        type,
                        isDone: false,
                        iconPath
                    });
                }
            }
        }

        this.todos = newTodos;

        // After finding todos, restore their done states from persistence
        await this.loadPersistedTodos();

        if (this._view) {
            this._view.webview.postMessage({ type: 'updateTodos', todos: this.todos });
        }
    }

    private async persistTodos() {
        // Only persist the done states to avoid stale data
        const doneStates = this.todos.reduce((acc, todo) => {
            if (todo.isDone) {
                acc[todo.id] = true;
            }
            return acc;
        }, {} as Record<string, boolean>);

        await this.context.workspaceState.update('codeMagnetTodoDoneStates', doneStates);
    }

    private async loadPersistedTodos() {
        const doneStates = this.context.workspaceState.get<Record<string, boolean>>('codeMagnetTodoDoneStates', {});
        
        // Apply persisted done states to current todos
        this.todos.forEach(todo => {
            todo.isDone = doneStates[todo.id] || false;
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'media', 'todoList.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'media', 'todoList.css'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

        return /*html*/`<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${codiconsUri}" rel="stylesheet" />
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            <div id="todo-list"></div>
            <script src="${scriptUri}"></script>
            <script>
                window.addEventListener('load', () => {
                    vscode.postMessage({ type: 'webviewLoaded' });
                });
            </script>
        </body>
        </html>`;
    }

    public dispose() {
        // Clean up the decoration type
        if (this.currentDecoration) {
            this.currentDecoration.dispose();
        }
    }
}
