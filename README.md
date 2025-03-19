# CodeMagnet VSCode Extension

A simple VSCode extension that helps you track and manage TODO and FIXME comments in your codebase.

## Features

- Lists all TODO and FIXME comments found in your codebase
- Shows file path and line number for each todo item
- Click on a todo item to jump to its location in the code
- Mark todos as done through a context menu
- Automatic refresh when files change
- Supports multiple programming languages

## Implementation Steps

1. **Project Setup**
   - Created basic extension structure with package.json and tsconfig.json
   - Configured extension manifest with necessary contribution points
   - Set up WebView container in the activity bar

2. **Core Implementation**
   - Created main extension entry point (extension.ts)
   - Implemented TodoTreeProvider for managing the WebView
   - Added todo item search functionality across multiple file types

3. **UI Implementation**
   - Created WebView-based UI using HTML, CSS, and JavaScript
   - Implemented responsive todo list with file paths and line numbers
   - Added click-to-navigate functionality
   - Implemented todo item toggle feature

4. **Testing**
   - Basic extension activation test
   - Todo search functionality test
   - WebView interaction tests

## Development

1. Clone the repository
2. Run `npm install`
3. Press F5 to start debugging

## Testing

Run `npm test` to execute the test suite.

## Known Issues

- Performance might degrade with very large codebases
- Limited to specific file extensions
- No persistence of "done" status between sessions

## Future Improvements

- Add persistence for marked todos
- Implement filtering and sorting options
- Add support for custom comment markers
- Improve performance for large codebases
