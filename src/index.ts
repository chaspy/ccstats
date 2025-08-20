#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const version = packageJson.version;

interface SessionEntry {
  type: string;
  timestamp?: string;
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  version?: string;
  gitBranch?: string;
  cwd?: string;
  message?: any;
  summary?: string;
  leafUuid?: string;
}

interface SessionStats {
  sessionId: string;
  summary: string;
  startTime: Date;
  endTime: Date;
  duration: string;
  activeDuration: string;
  waitingDuration: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolUsageCount: number;
  thinkingCount: number;
  toolBreakdown: Record<string, number>;
  cacheEvents: number;
  totalCacheCreated: number;
  totalCacheRead: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  version: string;
  gitBranch: string;
  workingDirectory: string;
}

function parseJSONL(content: string): SessionEntry[] {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.warn(`Failed to parse line: ${line}`);
        return null;
      }
    })
    .filter(Boolean) as SessionEntry[];
}

interface SessionFileResult {
  path: string | null;
  searchedPath: string;
  directoryExists: boolean;
  fileCount: number;
}

function getGitRoot(debugMode: boolean = false): string | null {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { 
      encoding: 'utf-8' as const 
    }).trim();
    return gitRoot;
  } catch (error) {
    if (debugMode) {
      console.log(chalk.gray(`Git command failed: ${error}`));
    }
    return null;
  }
}

function getActiveSessionFile(useGitRoot: boolean = true, debugMode: boolean = false): SessionFileResult {
  const claudeDir = join(homedir(), '.claude');
  const projectsDir = join(claudeDir, 'projects');
  
  // Get the directory to use for searching
  let searchDir = process.cwd();
  if (useGitRoot) {
    const gitRoot = getGitRoot(debugMode);
    if (gitRoot) {
      searchDir = gitRoot;
      if (debugMode) {
        console.log(chalk.gray(`Using git root: ${gitRoot}`));
      }
    } else {
      if (debugMode) {
        console.log(chalk.gray('Not a git repository, using current directory'));
      }
    }
  } else {
    if (debugMode) {
      console.log(chalk.gray('Git root detection disabled, using current directory'));
    }
  }
  
  // Find the project directory that matches the search directory
  // Replace all slashes, dots, and underscores with hyphens
  const projectDirName = searchDir.replace(/[\/\._]/g, '-');
  const projectPath = join(projectsDir, projectDirName);
  
  if (existsSync(projectPath)) {
    // Find the most recent .jsonl file
    const files = readdirSync(projectPath)
      .filter((f: string) => f.endsWith('.jsonl'))
      .map((f: string) => ({
        name: f,
        path: join(projectPath, f),
        mtime: statSync(join(projectPath, f)).mtime
      }))
      .sort((a: any, b: any) => b.mtime.getTime() - a.mtime.getTime());
    
    if (files.length > 0) {
      return { 
        path: files[0].path, 
        searchedPath: projectPath,
        directoryExists: true,
        fileCount: files.length
      };
    }
    
    return { 
      path: null, 
      searchedPath: projectPath,
      directoryExists: true,
      fileCount: 0
    };
  }
  
  return { 
    path: null, 
    searchedPath: projectPath,
    directoryExists: false,
    fileCount: 0
  };
}

function calculateSessionStats(entries: SessionEntry[]): SessionStats | null {
  if (entries.length === 0) return null;
  
  const summaryEntry = entries.find(e => e.type === 'summary');
  const summary = summaryEntry?.summary || 'No summary available';
  
  const timestamps = entries
    .filter(e => e.timestamp)
    .map(e => new Date(e.timestamp!));
  
  if (timestamps.length === 0) return null;
  
  const startTime = new Date(Math.min(...timestamps.map(t => t.getTime())));
  const endTime = new Date(Math.max(...timestamps.map(t => t.getTime())));
  
  const durationMs = endTime.getTime() - startTime.getTime();
  const duration = formatDuration(durationMs);
  
  const userMessages = entries.filter(e => e.type === 'user');
  const assistantMessages = entries.filter(e => e.type === 'assistant');
  
  const toolUsageCount = assistantMessages.filter(e => 
    e.message?.content?.some((c: any) => c.type === 'tool_use')
  ).length;
  
  const thinkingCount = assistantMessages.filter(e => 
    e.message?.content?.some((c: any) => c.type === 'thinking')
  ).length;
  
  // Tool breakdown
  const toolBreakdown: Record<string, number> = {};
  assistantMessages.forEach(e => {
    if (e.message?.content) {
      e.message.content.forEach((c: any) => {
        if (c.type === 'tool_use' && c.name) {
          toolBreakdown[c.name] = (toolBreakdown[c.name] || 0) + 1;
        }
      });
    }
  });
  
  // Cache/compaction statistics
  let cacheEvents = 0;
  let totalCacheCreated = 0;
  let totalCacheRead = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  entries.forEach(e => {
    if (e.message?.usage?.cache_creation_input_tokens) {
      cacheEvents++;
      totalCacheCreated += e.message.usage.cache_creation_input_tokens;
    }
    if (e.message?.usage?.cache_read_input_tokens) {
      totalCacheRead += e.message.usage.cache_read_input_tokens;
    }
    if (e.message?.usage?.input_tokens) {
      totalInputTokens += e.message.usage.input_tokens;
    }
    if (e.message?.usage?.output_tokens) {
      totalOutputTokens += e.message.usage.output_tokens;
    }
  });
  
  const totalTokens = totalInputTokens + totalOutputTokens;
  
  // Calculate active vs waiting time
  let activeTimeMs = 0;
  let waitingTimeMs = 0;
  
  // Get entries with timestamps sorted by time
  const timedEntries = entries
    .filter(e => e.timestamp && (e.type === 'user' || e.type === 'assistant'))
    .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
  
  // Track conversation flow
  for (let i = 0; i < timedEntries.length - 1; i++) {
    const current = timedEntries[i];
    const next = timedEntries[i + 1];
    
    const currentTime = new Date(current.timestamp!).getTime();
    const nextTime = new Date(next.timestamp!).getTime();
    const timeDiff = nextTime - currentTime;
    
    // User -> Assistant = Active time (Claude processing)
    // Assistant -> User = Waiting time (user thinking/typing)
    if (current.type === 'user' && next.type === 'assistant') {
      activeTimeMs += timeDiff;
    } else if (current.type === 'assistant' && next.type === 'user') {
      waitingTimeMs += timeDiff;
    }
    // If same type messages, consider it as active time (Claude processing multiple responses)
    else if (current.type === 'assistant' && next.type === 'assistant') {
      activeTimeMs += timeDiff;
    }
  }
  
  const activeDuration = formatDuration(activeTimeMs);
  const waitingDuration = formatDuration(waitingTimeMs);
  
  const firstEntry = entries.find(e => e.sessionId);
  
  return {
    sessionId: firstEntry?.sessionId || 'unknown',
    summary,
    startTime,
    endTime,
    duration,
    activeDuration,
    waitingDuration,
    messageCount: entries.length,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
    toolUsageCount,
    thinkingCount,
    toolBreakdown,
    cacheEvents,
    totalCacheCreated,
    totalCacheRead,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    version: firstEntry?.version || 'unknown',
    gitBranch: firstEntry?.gitBranch || 'unknown',
    workingDirectory: firstEntry?.cwd || 'unknown',
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function displayStats(stats: SessionStats): void {
  console.log(chalk.bold.cyan('\n📊 Claude Code Session Statistics\n'));
  
  console.log(chalk.bold('Session Summary:'), chalk.yellow(stats.summary));
  console.log(chalk.bold('Session ID:'), stats.sessionId);
  console.log(chalk.bold('Version:'), stats.version);
  console.log(chalk.bold('Git Branch:'), stats.gitBranch);
  console.log(chalk.bold('Working Directory:'), stats.workingDirectory);
  
  console.log(chalk.bold('\n⏱️  Time Information:'));
  console.log(`  Start Time: ${stats.startTime.toLocaleString()}`);
  console.log(`  End Time: ${stats.endTime.toLocaleString()}`);
  console.log(`  Total Duration: ${chalk.green(stats.duration)}`);
  console.log(`  Active Time: ${chalk.cyan(stats.activeDuration)} (Claude working)`);
  console.log(`  Waiting Time: ${chalk.gray(stats.waitingDuration)} (User thinking/typing)`);
  
  console.log(chalk.bold('\n💬 Message Statistics:'));
  console.log(`  Total Messages: ${chalk.blue(stats.messageCount)}`);
  console.log(`  User Messages: ${chalk.magenta(stats.userMessageCount)}`);
  console.log(`  Assistant Messages: ${chalk.yellow(stats.assistantMessageCount)}`);
  
  console.log(chalk.bold('\n🛠️  Tool Usage:'));
  console.log(`  Tool Invocations: ${chalk.cyan(stats.toolUsageCount)}`);
  console.log(`  Thinking Blocks: ${chalk.gray(stats.thinkingCount)}`);
  
  if (Object.keys(stats.toolBreakdown).length > 0) {
    console.log(chalk.bold('\n📊 Tool Breakdown:'));
    Object.entries(stats.toolBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([tool, count]) => {
        console.log(`  ${tool}: ${chalk.blue(count)}`);
      });
  }
  
  console.log(chalk.bold('\n🪙 Token Usage:'));
  console.log(`  Input Tokens: ${chalk.green(stats.totalInputTokens.toLocaleString())}`);
  console.log(`  Output Tokens: ${chalk.yellow(stats.totalOutputTokens.toLocaleString())}`);
  console.log(`  Total Tokens: ${chalk.red(stats.totalTokens.toLocaleString())}`);
  
  if (stats.cacheEvents > 0) {
    console.log(chalk.bold('\n📦 Cache Statistics:'));
    console.log(`  Cache Events: ${chalk.cyan(stats.cacheEvents)}`);
    console.log(`  Tokens Cached: ${chalk.green(stats.totalCacheCreated.toLocaleString())}`);
    console.log(`  Tokens Read from Cache: ${chalk.blue(stats.totalCacheRead.toLocaleString())}`);
  }
  
  console.log();
}

program
  .name('ccstats')
  .description('Claude Code session statistics tool')
  .version(version)
  .option('-f, --file <path>', 'specify a session file to analyze')
  .option('-o, --output <format>', 'output format (json, yaml)', 'console')
  .option('-s, --save <path>', 'save output to file')
  .option('--no-git-root', 'disable automatic git repository root detection')
  .option('-d, --debug', 'show debug information')
  .parse();

const options = program.opts();

async function main() {
  let sessionFile: string | null = null;
  let searchedPath: string | null = null;
  
  if (options.file) {
    sessionFile = options.file;
  } else {
    const result = getActiveSessionFile(options.gitRoot !== false, options.debug);
    sessionFile = result.path;
    searchedPath = result.searchedPath;
    
    if (!sessionFile) {
      if (!result.directoryExists) {
        console.error(chalk.red('❌ No Claude Code session found yet'));
        console.error(chalk.gray('   Session files are created after first tool use'));
      } else {
        console.error(chalk.red('❌ Could not find session file'));
      }
      
      if (options.debug) {
        console.error(chalk.gray(`\nDebug: searched in ${searchedPath}`));
      }
      
      process.exit(1);
    }
  }
  
  if (!sessionFile || !existsSync(sessionFile)) {
    console.error(chalk.red(`❌ File not found: ${sessionFile}`));
    process.exit(1);
  }
  
  // Only show debug message in console mode or when explicitly debugging
  if (options.output === 'console') {
    console.log(chalk.gray(`Reading session file: ${sessionFile}`));
  } else if (options.debug) {
    // For non-console output with debug flag, use stderr to avoid polluting output
    console.error(chalk.gray(`[DEBUG] Reading session file: ${sessionFile}`));
  }
  
  try {
    const content = readFileSync(sessionFile, 'utf-8');
    const entries = parseJSONL(content);
    
    const stats = calculateSessionStats(entries);
    if (!stats) {
      console.error(chalk.red('❌ Could not calculate statistics from session file'));
      process.exit(1);
    }
    
    // Prepare output data
    const outputData = {
      ...stats,
      startTime: stats.startTime.toISOString(),
      endTime: stats.endTime.toISOString(),
    };
    
    // Handle different output formats
    let output: string = '';
    
    switch (options.output) {
      case 'json':
        output = JSON.stringify(outputData, null, 2);
        break;
      case 'yaml':
        output = yaml.dump(outputData, { indent: 2 });
        break;
      default:
        displayStats(stats);
    }
    
    // Save to file if requested
    if (options.save && output) {
      writeFileSync(options.save, output);
      // Show save confirmation (not to stdout to avoid mixing with piped output)
      console.log(chalk.green(`✅ Statistics saved to ${options.save}`));
    } else if (output) {
      // Direct output for json/yaml
      console.log(output);
    }
  } catch (error) {
    console.error(chalk.red('❌ Error reading session file:'), error);
    process.exit(1);
  }
}

main().catch(console.error);