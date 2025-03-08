import * as vscode from 'vscode';
import { TodoProvider } from './todoProvider';
import * as path from 'path';

let webViewPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  const todoProvider = new TodoProvider();

  // Command to show WebView panel
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

    // Handle messages from WebView
    webViewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'refresh':
          updateWebView(webViewPanel!, todoProvider);
          break;
        case 'openFile':
          const uri = vscode.Uri.file(message.file);
          const position = new vscode.Position(message.line, 0);
          await vscode.commands.executeCommand('vscode.open', uri, {
            selection: new vscode.Range(position, position)
          });
          break;
      }
    });

    // Initial data load
    updateWebView(webViewPanel, todoProvider);
  });

  // Refresh command
  const refreshCommand = vscode.commands.registerCommand('codemagnet.refresh', () => {
    if (webViewPanel) {
      updateWebView(webViewPanel, todoProvider);
    }
  });

  // File watcher
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidChange(() => webViewPanel && updateWebView(webViewPanel, todoProvider));
  watcher.onDidCreate(() => webViewPanel && updateWebView(webViewPanel, todoProvider));
  watcher.onDidDelete(() => webViewPanel && updateWebView(webViewPanel, todoProvider));

  context.subscriptions.push(showPanelCommand, refreshCommand, watcher);
}

async function updateWebView(panel: vscode.WebviewPanel, provider: TodoProvider) {
  try {
    const items = await provider.getChildren();
    panel.webview.postMessage({
      command: 'update',
      data: items.map(item => ({
        text: item.text,
        file: item.fileUri.fsPath,
        line: item.line + 1,
        type: item.type
      }))
    });
  } catch (error) {
    vscode.window.showErrorMessage(`CodeMagnet update failed: ${error}`);
  }
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'main.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'style.css')
  );
  const codemagnetIcon = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'codemagnet-icon.svg')
  );

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
      <button class="refresh-btn" onclick="refreshData()">⟳</button>
    </div>
    <div id="todo-list" class="list-container"></div>
    <script src="${scriptUri}"></script>
  </body>
  </html>`;
}