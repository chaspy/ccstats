# Claude Code Custom Commands

## /stats
Shows current session statistics
```bash
npx ccstats
```

## /stats-yaml
Output session statistics in YAML format
```bash
npx ccstats -o yaml
```

## /stats-save
Save session statistics to a file
```bash
npx ccstats -o yaml -s session-stats-$(date +%Y%m%d-%H%M%S).yaml
```