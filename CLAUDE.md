# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Release Process

**Important**: Follow this exact flow for npm releases

1. **Branch Work**: Create feature/fix branches for changes
2. **Testing**: Test all output formats and edge cases
3. **Pull Request**: Create PR with `gh pr create`
4. **User Approval**: Wait for PR review and merge
5. **Release**: Only publish from main branch after merge

For emergency unpublish: `npm unpublish ccstats@version`

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