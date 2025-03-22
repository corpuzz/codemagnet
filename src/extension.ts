import * as vscode from 'vscode';
import { TodoTreeProvider } from './TodoTreeProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new TodoTreeProvider(context.extensionUri, context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codemagnet.todoList', provider),
        provider // Add provider to subscriptions for proper disposal
    );

    // Watch for file changes - watch all files
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.*');
    
    // Refresh on file changes
    fileWatcher.onDidChange(() => provider.refresh());
    fileWatcher.onDidCreate(() => provider.refresh());
    fileWatcher.onDidDelete(() => provider.refresh());

    // Watch for text document changes
    vscode.workspace.onDidChangeTextDocument(() => provider.refresh());

    // Register refresh command
    let disposable = vscode.commands.registerCommand('codemagnet.refresh', () => {
        provider.refresh();
    });

    // Add disposables to context
    context.subscriptions.push(fileWatcher);
    context.subscriptions.push(disposable);
}

export function deactivate() {}
