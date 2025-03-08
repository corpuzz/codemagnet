import * as vscode from 'vscode';
import { TodoProvider } from './todoProvider';
import { TodoTreeDataProvider } from './todoTreeDataProvider';
import * as path from 'path';

let webViewPanel: vscode.WebviewPanel | undefined;
let treeView: vscode.TreeView<any>;

export function activate(context: vscode.ExtensionContext) {
  const todoProvider = new TodoProvider();
  const treeDataProvider = new TodoTreeDataProvider(todoProvider); // Shared provider

  // WebView Panel
  const showPanelCommand = vscode.commands.registerCommand('codemagnet.showPanel', () => {
    if (webViewPanel) {
      webViewPanel.reveal();
      return;
    }

    webViewPanel = vscode.window.createWebviewPanel(
      'codemagnet',
      'CodeMagnet',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    webViewPanel.webview.html = getWebviewContent(context, webViewPanel.webview);
    webViewPanel.onDidDispose(() => webViewPanel = undefined);

    webViewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'refresh':
          updateWebView(webViewPanel!, todoProvider);
          break;
        case 'openFile':
          openFile(message.file, message.line);
          break;
        case 'showTree':
          vscode.commands.executeCommand('codemagnet.showTree');
          break;
      }
    });

    updateWebView(webViewPanel, todoProvider);
  });

  // TreeView
  treeView = vscode.window.createTreeView('codemagnetTree', {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true
  });

  const showTreeCommand = vscode.commands.registerCommand('codemagnet.showTree', () => {
    treeView.reveal(undefined, { focus: true, expand: true }); // Fixed root reference
  });

  // Refresh command
  const refreshCommand = vscode.commands.registerCommand('codemagnet.refresh', () => {
    treeDataProvider.refresh();
    webViewPanel && updateWebView(webViewPanel, todoProvider);
  });

  // File watcher
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidChange(() => {
    treeDataProvider.refresh();
    webViewPanel && updateWebView(webViewPanel, todoProvider);
  });
  watcher.onDidCreate(() => {
    treeDataProvider.refresh();
    webViewPanel && updateWebView(webViewPanel, todoProvider);
  });
  watcher.onDidDelete(() => {
    treeDataProvider.refresh();
    webViewPanel && updateWebView(webViewPanel, todoProvider);
  });

  context.subscriptions.push(
    showPanelCommand,
    showTreeCommand,
    refreshCommand,
    watcher,
    treeView
  );
}

async function updateWebView(panel: vscode.WebviewPanel, provider: TodoProvider) {
  const items = await provider.getChildren();
  panel.webview.postMessage({
    command: 'update',
    data: items.map(item => ({
      ...item,
      file: item.fileUri.fsPath,
      line: item.line + 1
    }))
  });
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'main.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'style.css'));
  const codemagnetIcon = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'codemagnet-icon.svg'));

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeMagnet</title>
    <link href="${styleUri}" rel="stylesheet">
  </head>
  <body>
    <div class="header">
      <img src="${codemagnetIcon}" class="logo" />
      <h1>CodeMagnet</h1>
      <div class="actions">
        <button class="tree-btn" onclick="showTreeView()">Tree View</button>
        <button class="refresh-btn" onclick="refreshData()">⟳</button>
      </div>
    </div>
    <div id="todo-list" class="list-container"></div>
    <script src="${scriptUri}"></script>
  </body>
  </html>`;
}

function openFile(filePath: string, line: number) {
  const uri = vscode.Uri.file(filePath);
  const position = new vscode.Position(line - 1, 0);
  vscode.commands.executeCommand('vscode.open', uri, {
    selection: new vscode.Range(position, position)
  });
}