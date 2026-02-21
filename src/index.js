#!/usr/bin/env node
/**
 * Papfast - 多模块论文订阅工具
 * 
 * 支持多个检索模块，每个模块独立关键词和收件人
 */

import { fetchFromPubMed, fetchFromPubMedSinceYear, filterPapersWithAbstract } from './fetch.js';
import { translateAllPapers } from './translate.js';
import { analyzeAllPapers } from './analyze.js';
import { sendPaperEmail } from './email.js';
import { getJournalRanks, formatJournalInfo } from './journal-rank.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 替换配置中的环境变量占位符
 */
function resolveConfig(configStr) {
  return configStr.replace(/\$\{([^}]+)\}/g, (match, key) => {
    const value = process.env[key];
    if (!value) {
      console.warn(`[警告] 环境变量 ${key} 未设置`);
      return match;
    }
    return value;
  });
}

// 加载配置：优先使用 config.local.json（本地测试），否则使用 config.json（GitHub Actions）
let configPath = join(__dirname, '../config/config.json');
if (existsSync(join(__dirname, '../config/config.local.json'))) {
  configPath = join(__dirname, '../config/config.local.json');
  console.log('[本地] 使用 config.local.json');
}

const configText = readFileSync(configPath, 'utf-8');
const config = JSON.parse(resolveConfig(configText));

async function processModule(module) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  模块: ${module.name}`);
  console.log(`  关键词: ${module.keywords.length} 个`);
  console.log(`  收件人: ${module.recipients.join(', ')}`);
  console.log(`${'='.repeat(50)}\n`);
  
  const allPapers = [];
  let isFallback = false;
  let fallbackYear = null;
  
  // 获取每个关键词的论文（优先最近7天）
  for (const keyword of module.keywords) {
    try {
      // 先搜索最近7天
      let papers = await fetchFromPubMed(keyword, module.daysBack || 7, module.maxResults || 15);
      
      // 如果没有新论文，搜索2020年以来的（仅对特定模块启用回退机制）
      if (papers.length === 0 && module.fallbackFromYear) {
        console.log(`[回退] 没有新论文，搜索 ${module.fallbackFromYear} 年以来的文献...`);
        papers = await fetchFromPubMedSinceYear(keyword, module.fallbackFromYear, module.fallbackMaxResults || 10);
        isFallback = true;
        fallbackYear = module.fallbackFromYear;
      }
      
      allPapers.push(...papers);
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(`[PubMed] 获取失败: ${keyword}`, error.message);
    }
  }
  
  // 去重
  const uniquePapers = [];
  const seenIds = new Set();
  for (const paper of allPapers) {
    if (!seenIds.has(paper.pmid)) {
      seenIds.add(paper.pmid);
      uniquePapers.push(paper);
    }
  }
  
  console.log(`[总计] 获取 ${uniquePapers.length} 篇唯一论文`);
  
  // 过滤无摘要论文
  const papersWithAbstract = filterPapersWithAbstract(uniquePapers);
  
  if (papersWithAbstract.length === 0) {
    console.log(`[跳过] ${module.name} 没有有效论文（全部无摘要）`);
    return;
  }
  
  // 翻译
  console.log(`\n[步骤 1/4] 翻译论文...`);
  const translatedPapers = await translateAllPapers(papersWithAbstract);
  
  // 获取期刊等级信息
  console.log(`\n[步骤 2/4] 获取期刊等级信息...`);
  const journals = [...new Set(translatedPapers.map(p => p.journal).filter(Boolean))];
  const journalRanks = await getJournalRanks(journals);
  
  // 添加期刊信息到论文
  const papersWithJournalInfo = translatedPapers.map(paper => ({
    ...paper,
    journalInfo: journalRanks.get(paper.journal) || null,
    journalInfoText: formatJournalInfo(journalRanks.get(paper.journal))
  }));
  
  // 深度分析
  console.log(`\n[步骤 3/4] 深度分析论文...`);
  const analyzedPapers = await analyzeAllPapers(papersWithJournalInfo);
  
  // 发送邮件
  console.log(`\n[步骤 4/4] 发送邮件...`);
  await sendPaperEmail(analyzedPapers, module.name, module.recipients, isFallback, fallbackYear);
  
  console.log(`\n[完成] ${module.name} 处理完毕，共 ${papersWithAbstract.length} 篇论文`);
}

async function main() {
  console.log('\n========================================');
  console.log('  Papfast - 多模块论文订阅');
  console.log('  时间:', new Date().toLocaleString('zh-CN'));
  console.log(`  模块数: ${config.modules.filter(m => m.enabled !== false).length}`);
  console.log('========================================');
  
  for (const module of config.modules) {
    // 跳过禁用的模块
    if (module.enabled === false) {
      console.log(`\n[跳过] ${module.name} (已禁用)`);
      continue;
    }
    
    try {
      await processModule(module);
    } catch (error) {
      console.error(`\n[错误] ${module.name} 处理失败:`, error.message);
    }
  }
  
  console.log('\n========================================');
  console.log('  全部模块处理完成！');
  console.log('========================================');
}

main();
