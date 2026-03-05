#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const localPath = join(__dirname, '../config/config.local.json');
const defaultPath = join(__dirname, '../config/config.json');

function resolveConfig(configStr) {
  return configStr.replace(/\$\{([^}]+)\}/g, (match, key) => process.env[key] || match);
}

function readConfig() {
  const activePath = existsSync(localPath) ? localPath : defaultPath;
  const config = JSON.parse(resolveConfig(readFileSync(activePath, 'utf-8')));
  return { activePath, config };
}

function writeLocalConfig(config) {
  writeFileSync(localPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[key] = value;
    if (value !== true) i += 1;
  }
  return args;
}

function splitByComma(text = '') {
  return text
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function buildModule({ name, keywords, recipients, maxResults, daysBack }) {
  return {
    name,
    keywords,
    recipients,
    maxResults: Number(maxResults) || 15,
    daysBack: Number(daysBack) || 7,
    fallbackFromYear: 2020,
    fallbackMaxResults: 10,
    enabled: true
  };
}

async function interactiveMode(baseConfig) {
  const rl = createInterface({ input, output });
  try {
    const name = (await rl.question('模块名称: ')).trim();
    const keywordsRaw = await rl.question('检索式（多个用逗号分隔）: ');
    const recipientsRaw = await rl.question('收件人邮箱（多个用逗号分隔）: ');
    const maxResults = await rl.question('每个检索式最大返回数（默认 15）: ');
    const daysBack = await rl.question('检索最近天数（默认 7）: ');

    if (!name) {
      throw new Error('模块名称不能为空');
    }

    const keywords = splitByComma(keywordsRaw);
    const recipients = splitByComma(recipientsRaw);
    if (keywords.length === 0) {
      throw new Error('至少需要 1 条检索式');
    }
    if (recipients.length === 0) {
      throw new Error('至少需要 1 个收件人邮箱');
    }

    const modules = ensureArray(baseConfig.modules, []);
    modules.push(buildModule({ name, keywords, recipients, maxResults, daysBack }));
    baseConfig.modules = modules;
    return baseConfig;
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { activePath, config } = readConfig();

  let nextConfig = config;
  if (args.name && args.keywords && args.recipients) {
    const modules = ensureArray(config.modules, []);
    modules.push(
      buildModule({
        name: String(args.name).trim(),
        keywords: splitByComma(String(args.keywords)),
        recipients: splitByComma(String(args.recipients)),
        maxResults: args.maxResults,
        daysBack: args.daysBack
      })
    );
    nextConfig.modules = modules;
  } else {
    console.log('进入交互式配置模式（也可用 --name --keywords --recipients 走命令模式）');
    nextConfig = await interactiveMode(config);
  }

  writeLocalConfig(nextConfig);
  console.log('\n✅ 已写入 config/config.local.json');
  console.log(`基于配置: ${activePath.endsWith('config.local.json') ? 'config.local.json' : 'config.json'}`);
  console.log(`当前模块总数: ${(nextConfig.modules || []).length}`);
  console.log('可继续执行: npm run detect:subscriptions');
}

main().catch(error => {
  console.error(`❌ 配置失败: ${error.message}`);
  process.exit(1);
});
