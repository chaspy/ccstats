# ccstats

Claude Code session statistics tool - View statistics for your Claude Code sessions

## Installation

```bash
npm install -g ccstats
# or use directly with npx
npx ccstats
```

## Usage

### View current session statistics
```bash
ccstats
```

### Analyze a specific session file
```bash
ccstats -f path/to/session.jsonl
```

## Features

- 📊 Session summary and metadata
- ⏱️ Session duration tracking
- 💬 Message count breakdown (user vs assistant)
- 🛠️ Tool usage statistics
- 🧠 Thinking blocks count

## Example Output

```
📊 Claude Code Session Statistics

Session Summary: Dotfiles Symlink Setup and Circular Reference Fix
Session ID: 80405e73-d77f-4430-a9ab-975b28c9d7dd
Version: 1.0.61
Git Branch: master
Working Directory: /Users/chaspy/go/src/github.com/chaspy/dotfiles

⏱️  Time Information:
  Start Time: 2025/7/27 19:35:05
  End Time: 2025/7/27 19:35:17
  Duration: 12s

💬 Message Statistics:
  Total Messages: 38
  User Messages: 14
  Assistant Messages: 23

🛠️  Tool Usage:
  Tool Invocations: 9
  Thinking Blocks: 7
```

## How it Works

ccstats reads Claude Code session files stored in `~/.claude/projects/` and analyzes the JSONL data to provide insights about your coding sessions.

For the current directory, it automatically finds the most recent session file. You can also specify a session file directly using the `-f` option.

## Output Formats

### Console (default)
```bash
ccstats
```

### JSON
```bash
ccstats -o json
ccstats -o json -s stats.json
```

### YAML
```bash
ccstats -o yaml
ccstats -o yaml -s stats.yaml
```

## Claude Code Integration

ccstats can be integrated with Claude Code as custom commands, subagents, or hooks.

### Custom Commands

Add to your `.claude/commands/` directory:

```markdown
# /stats
npx ccstats

# /stats-yaml
npx ccstats -o yaml

# /stats-save
npx ccstats -o yaml -s session-stats-$(date +%Y%m%d-%H%M%S).yaml
```

### Hooks

Add to your Claude Code settings.json:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "description": "Show stats every 50 tool uses",
        "matcher": {
          "tools": ["*"],
          "modulo": 50
        },
        "hooks": [
          {
            "type": "command",
            "command": "npx ccstats"
          }
        ]
      }
    ],
    "Stop": [
      {
        "description": "Save session stats on stop",
        "hooks": [
          {
            "type": "command",
            "command": "mkdir -p ~/.claude/session-stats && npx ccstats -o yaml -s ~/.claude/session-stats/$(date +%Y%m%d-%H%M%S).yaml"
          }
        ]
      }
    ]
  }
}
```

### Use Cases

1. **Monitor Long Sessions**: Use the PostToolUse hook to show statistics periodically
2. **Session Archives**: Use the Stop hook to automatically save session statistics
3. **Quick Stats**: Use custom commands like `/stats` for on-demand statistics
4. **Performance Analysis**: Export to YAML/JSON for further analysis

## License

MIT
