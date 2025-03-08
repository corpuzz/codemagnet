import * as vscode from 'vscode';
import * as path from 'path';

interface TodoItem {
  fileUri: vscode.Uri;
  line: number;
  text: string;
  type: 'TODO' | 'FIXME';
}

export class TodoProvider {
  async getChildren(): Promise<TodoItem[]> {
    const todos: TodoItem[] = [];
    const config = vscode.workspace.getConfiguration('codemagnet');
    const excludePatterns = config.get<string[]>('exclude', []);
    const files = await vscode.workspace.findFiles('**/*', `{${excludePatterns.join(',')}}`);

    for (const file of files) {
      try {
        const content = await vscode.workspace.fs.readFile(file);
        const lines = content.toString().split('\n');

        lines.forEach((line, index) => {
          const cleanLine = line.trim().replace(/\r$/, ''); // Handle CRLF

          // Check for TODO
          const todoMatch = cleanLine.match(/\/\/\s*TODO:?/i);
          if (todoMatch) {
            todos.push({
              fileUri: file,
              line: index,
              text: cleanLine.replace(/\/\/\s*TODO:?/i, '').trim(),
              type: 'TODO'
            });
          }

          // Check for FIXME
          const fixmeMatch = cleanLine.match(/\/\/\s*FIXME:?/i);
          if (fixmeMatch) {
            todos.push({
              fileUri: file,
              line: index,
              text: cleanLine.replace(/\/\/\s*FIXME:?/i, '').trim(),
              type: 'FIXME'
            });
          }
        });
      } catch (error) {
        console.error(`Error reading ${file.fsPath}: ${error}`);
      }
    }

    return todos;
  }
}