#!/usr/bin/env node
/**
 * Papfast - 多模块论文订阅工具
 * 
 * 支持多个检索模块，每个模块独立关键词和收件人
 * 支持数据源：PubMed, bioRxiv, medRxiv
 * 
 * 预印本处理：仅翻译标题和摘要，不执行深度分析
 */

import { fetchFromPubMed, fetchFromPubMedSinceYear, filterPapersWithAbstract } from './fetch.js';
import { fetchPreprints, searchPreprintsByKeywords } from './fetch-preprint.js';
import { translateAllPapers } from './translate.js';
import { analyzeAllPapers } from './analyze.js';
import { sendPaperEmail } from './email.js';
import { getJournalRanks, formatJournalInfo } from './journal-rank.js';
import { filterUnsentPapers, recordSentPapers } from './sent-papers.js';
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

/**
 * 处理单个模块
 */
async function processModule(module) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  模块: ${module.name}`);
  console.log(`  关键词: ${module.keywords.length} 个`);
  console.log(`  收件人: ${module.recipients.join(', ')}`);
  if (module.preprint?.enabled) {
    console.log(`  预印本: ${module.preprint.server || 'biorxiv'} (仅翻译)`);
  }
  console.log(`${'='.repeat(50)}\n`);
  
  const pubmedPapers = [];
  const preprintPapers = [];
  let isFallback = false;
  let fallbackYear = null;
  
  // ========== 1. 获取 PubMed 论文 ==========
  if (module.sources?.includes('pubmed') || !module.sources) {
    for (const keyword of module.keywords) {
      try {
        let papers = await fetchFromPubMed(keyword, module.daysBack || 7, module.maxResults || 15);
        
        // 回退机制
        if (papers.length === 0 && module.fallbackFromYear) {
          console.log(`[回退] 没有新论文，搜索 ${module.fallbackFromYear} 年以来的文献...`);
          const fetchLimit = (module.fallbackMaxResults || 10) * 3;
          papers = await fetchFromPubMedSinceYear(keyword, module.fallbackFromYear, fetchLimit);
          papers = filterUnsentPapers(papers, module.name);
          papers = papers.slice(0, module.fallbackMaxResults || 10);
          isFallback = true;
          fallbackYear = module.fallbackFromYear;
        }
        
        pubmedPapers.push(...papers);
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        console.error(`[PubMed] 获取失败: ${keyword}`, error.message);
      }
    }
  }
  
  // ========== 2. 获取预印本 (bioRxiv / medRxiv) ==========
  if (module.preprint?.enabled) {
    const preprintConfig = module.preprint;
    const server = preprintConfig.server || 'biorxiv';
    const preprintDays = preprintConfig.daysBack || module.daysBack || 7;
    const preprintMax = preprintConfig.maxResults || 10;
    
    try {
      let preprints;
      
      if (preprintConfig.category) {
        preprints = await fetchPreprints({
          server,
          category: preprintConfig.category,
          daysBack: preprintDays,
          maxResults: preprintMax
        });
      } else if (module.keywords.length > 0) {
        preprints = await searchPreprintsByKeywords({
          server,
          keywords: module.keywords,
          daysBack: preprintDays,
          maxResults: preprintMax
        });
      }
      
      if (preprints && preprints.length > 0) {
        preprints = filterUnsentPapers(preprints, `${module.name}-preprint`);
        preprintPapers.push(...preprints);
      }
      
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`[预印本] ${server} 获取失败:`, error.message);
    }
  }
  
  // ========== 3. 处理 PubMed 论文（翻译 + 深度分析）==========
  let analyzedPubmedPapers = [];
  
  if (pubmedPapers.length > 0) {
    // 去重
    const uniquePapers = [];
    const seenIds = new Set();
    for (const paper of pubmedPapers) {
      if (paper.pmid && !seenIds.has(paper.pmid)) {
        seenIds.add(paper.pmid);
        uniquePapers.push(paper);
      }
    }
    
    const papersWithAbstract = filterPapersWithAbstract(uniquePapers);
    
    if (papersWithAbstract.length > 0) {
      console.log(`[PubMed] ${papersWithAbstract.length} 篇论文待处理`);
      
      // 翻译
      console.log(`\n[PubMed] 翻译论文...`);
      const translatedPapers = await translateAllPapers(papersWithAbstract);
      
      // 获取期刊等级
      console.log(`[PubMed] 获取期刊等级...`);
      const journals = [...new Set(translatedPapers.map(p => p.journal).filter(Boolean))];
      const journalRanks = await getJournalRanks(journals);
      
      const papersWithJournalInfo = translatedPapers.map(paper => ({
        ...paper,
        journalInfo: journalRanks.get(paper.journal) || null,
        journalInfoText: formatJournalInfo(journalRanks.get(paper.journal))
      }));
      
      // 深度分析
      console.log(`[PubMed] 深度分析...`);
      analyzedPubmedPapers = await analyzeAllPapers(papersWithJournalInfo);
    }
  }
  
  // ========== 4. 处理预印本（仅翻译，不深度分析）==========
  let translatedPreprintPapers = [];
  
  if (preprintPapers.length > 0) {
    // 去重
    const uniquePreprints = [];
    const seenDois = new Set();
    for (const paper of preprintPapers) {
      if (paper.doi && !seenDois.has(paper.doi)) {
        seenDois.add(paper.doi);
        uniquePreprints.push(paper);
      }
    }
    
    const preprintsWithAbstract = filterPapersWithAbstract(uniquePreprints);
    
    if (preprintsWithAbstract.length > 0) {
      console.log(`[预印本] ${preprintsWithAbstract.length} 篇预印本待处理（仅翻译）`);
      
      // 仅翻译，不进行深度分析
      console.log(`[预印本] 翻译标题和摘要...`);
      translatedPreprintPapers = await translateAllPapers(preprintsWithAbstract);
      
      // 预印本不需要期刊等级查询，已有默认标记
    }
  }
  
  // ========== 5. 合并发送邮件 ==========
  const allPapers = [...analyzedPubmedPapers, ...translatedPreprintPapers];
  
  if (allPapers.length === 0) {
    console.log(`[跳过] ${module.name} 没有有效论文`);
    return;
  }
  
  console.log(`\n[发送] ${module.name}: ${analyzedPubmedPapers.length} 篇论文 + ${translatedPreprintPapers.length} 篇预印本`);
  await sendPaperEmail(allPapers, module.name, module.recipients, isFallback, fallbackYear);
  
  // 记录已推送
  recordSentPapers(allPapers, module.name);
  
  console.log(`\n[完成] ${module.name} 处理完毕`);
}

async function main() {
  console.log('\n========================================');
  console.log('  Papfast - 多模块论文订阅');
  console.log('  时间:', new Date().toLocaleString('zh-CN'));
  console.log(`  模块数: ${config.modules.filter(m => m.enabled !== false).length}`);
  console.log('========================================');
  
  for (const module of config.modules) {
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
