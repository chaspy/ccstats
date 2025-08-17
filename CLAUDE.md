# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
このファイルはClaude Codeがこのリポジトリで作業する際のガイドラインです。

## Repository Overview

ccstats is a TypeScript CLI tool for analyzing Claude Code session statistics. It reads JSONL session files and provides detailed analytics about coding sessions including time tracking, message counts, tool usage, and token statistics.

## Development Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Run in development mode (directly from TypeScript)
npm run dev

# Run compiled version
npm run start

# Install dependencies
npm install

# Publish to npm (builds automatically)
npm publish
```

## Architecture

### Core Components

The entire application logic is in a single file: `src/index.ts`

Key architectural decisions:
- **Session File Discovery**: Automatically locates Claude Code session files in `~/.claude/projects/` by matching the current working directory with encoded project paths
- **JSONL Processing**: Parses streaming JSON Lines format, handling each entry independently for robustness
- **Statistics Calculation**: Aggregates session data into comprehensive statistics including duration, message counts, tool usage, and token metrics
- **Output Flexibility**: Supports console (default), JSON, and YAML output formats with optional file saving

### Key Interfaces

- `SessionEntry`: Represents individual JSONL entries from session files
- `SessionStats`: Comprehensive statistics object returned by analysis

### Tool Usage Tracking

The tool categorizes Claude Code tools:
- File operations: Read, Write, Edit, MultiEdit
- Search operations: Grep, Glob, LS
- System operations: Bash, Task
- Web operations: WebSearch, WebFetch
- Other specialized tools

## Release Process / リリースプロセス

**CRITICAL**: Never publish to npm without user approval. Follow this exact flow:
**重要**: npm publishする前に必ず以下のフローに従ってください。

### English

1. **Branch Work**: Create feature/fix branches for changes
   - `git checkout -b feature/xxx` or `git checkout -b fix/xxx`

2. **Testing**: Test all output formats and edge cases
   - Test redirections with `-o yaml > output.yaml`
   - Test both direct execution and npx

3. **Pull Request**: Create PR with `gh pr create`
   - Include test results in PR description
   - Reference related issues

4. **User Approval**: Wait for PR review and merge
   - **NEVER run npm publish before approval**
   - User must explicitly approve the PR

5. **Release**: Only publish from main branch after merge
   - Switch to main branch
   - Pull latest changes
   - Run `npm publish`

### 日本語

1. **ブランチで作業**
   - 修正や機能追加は別ブランチで行う
   - `git checkout -b feature/xxx` または `git checkout -b fix/xxx`

2. **テスト実施**
   - 修正後は必ずテストを実行
   - リダイレクトを含む各種出力形式をテスト

3. **コミット作成**
   - 変更内容を明確にコミット
   - コミットメッセージは変更内容を簡潔に説明

4. **Pull Request作成**
   - `gh pr create` でPRを作成
   - 変更内容とテスト結果を記載

5. **ユーザー承認待ち**
   - ユーザーがPRをレビューし承認するまで待つ
   - **承認前にnpm publishしない**

6. **マージ後リリース**
   - PRがマージされた後にmainブランチで作業
   - `npm publish` でリリース

### Emergency / 緊急時の対応

For emergency unpublish / もし誤ってリリースしてしまった場合:
- `npm unpublish package@version` で即座に取り消し
- 正しいフローで再度進める

## Session File Locations

Claude Code stores session files in:
- `~/.claude/projects/[encoded-project-name]/sessions/[session-id].jsonl`
- Project names are encoded by replacing `/` with `_` and removing special characters
- Files are created after first tool use in a session

## Testing Approach

Manual testing using:
- `sample.jsonl` - Example session file for testing
- Development mode: `npm run dev` for rapid iteration
- Various session files from actual Claude Code usage

## Integration Points

### Claude Code Hooks
- PostToolUse: Show stats periodically during long sessions
- Stop: Automatically save session statistics on exit

### Custom Commands
- `/stats` - Display current session statistics
- `/stats-yaml` - Output in YAML format
- `/stats-save` - Save statistics to timestamped file

## Common Development Tasks

### Adding New Statistics
1. Update `SessionStats` interface in `src/index.ts`
2. Modify `calculateSessionStats()` function to compute new metrics
3. Update display logic in main output formatting section

### Debugging Session Discovery
The `getActiveSessionFile()` function includes debug output (with --debug flag) showing:
- Discovered project directories
- Directory name transformations
- Session file timestamps and selection logic

### Handling Edge Cases
- Empty session files: Gracefully handled with default statistics
- Malformed JSONL: Individual lines are skipped, processing continues
- Missing session files: Clear error messages with guidance