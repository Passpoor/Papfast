#!/usr/bin/env node
/**
 * Papfast - 多模块论文订阅工具
 * 
 * 支持多个检索模块，每个模块独立关键词和收件人
 * 支持数据源：PubMed, bioRxiv, medRxiv
 * 
 * 预印本处理：仅翻译标题和摘要，不执行深度分析
 * 
 * 去重机制：
 * 1. 查询阶段：filterUnsentPapers() 过滤已推送论文
 * 2. 发送前：preRecordPapers() 预先记录，确保不重复
 */

import { fetchFromPubMed, fetchFromPubMedSinceYear, filterPapersWithAbstract } from './fetch.js';
import { fetchPreprints, searchPreprintsByKeywords } from './fetch-preprint.js';
import { translateAllPapers } from './translate.js';
import { analyzeAllPapers } from './analyze.js';
import { sendPaperEmail } from './email.js';
import { getJournalRanks, formatJournalInfo } from './journal-rank.js';
import { filterUnsentPapers, preRecordPapers, recordSentPapers } from './sent-papers.js';
import { saveRunReport } from './report.js';
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
 * 去重论文（内部去重 + 已推送去重）
 */
function deduplicatePapers(papers, moduleName) {
  const uniquePapers = [];
  const seenKeys = new Set();
  
  for (const paper of papers) {
    // 生成唯一 key
    let key;
    if (paper.pmid) key = `pmid:${paper.pmid}`;
    else if (paper.doi) key = `doi:${paper.doi}`;
    else continue; // 跳过无标识符的
    
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniquePapers.push(paper);
    }
  }
  
  // 过滤已推送
  return filterUnsentPapers(uniquePapers, moduleName);
}

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
        
        // 去重（内部 + 已推送）
        papers = deduplicatePapers(papers, module.name);
        
        // 回退机制：只有去重后为空才触发
        if (papers.length === 0 && module.fallbackFromYear) {
          console.log(`[回退] 没有新论文，搜索 ${module.fallbackFromYear} 年以来的文献...`);
          const fetchLimit = (module.fallbackMaxResults || 10) * 3;
          papers = await fetchFromPubMedSinceYear(keyword, module.fallbackFromYear, fetchLimit);
          papers = deduplicatePapers(papers, module.name);
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
        preprints = deduplicatePapers(preprints, `${module.name}-preprint`);
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
    const papersWithAbstract = filterPapersWithAbstract(pubmedPapers);
    
    if (papersWithAbstract.length > 0) {
      console.log(`[PubMed] ${papersWithAbstract.length} 篇论文待处理`);
      
      try {
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
      } catch (error) {
        console.error(`[PubMed] 处理失败:`, error.message);
        // 即使处理失败，也保留已获取的论文（用于记录）
        analyzedPubmedPapers = papersWithAbstract;
      }
    }
  }
  
  // ========== 4. 处理预印本（仅翻译，不深度分析）==========
  let translatedPreprintPapers = [];
  
  if (preprintPapers.length > 0) {
    const preprintsWithAbstract = filterPapersWithAbstract(preprintPapers);
    
    if (preprintsWithAbstract.length > 0) {
      console.log(`[预印本] ${preprintsWithAbstract.length} 篇预印本待处理（仅翻译）`);
      
      try {
        console.log(`[预印本] 翻译标题和摘要...`);
        translatedPreprintPapers = await translateAllPapers(preprintsWithAbstract);
      } catch (error) {
        console.error(`[预印本] 翻译失败:`, error.message);
        translatedPreprintPapers = preprintsWithAbstract;
      }
    }
  }
  
  // ========== 5. 合并、预记录、发送邮件 ==========
  const allPapers = [...analyzedPubmedPapers, ...translatedPreprintPapers];
  
  if (allPapers.length === 0) {
    console.log(`[跳过] ${module.name} 没有有效论文`);
    return;
  }
  
  // ★ 关键：发送前预先记录，确保即使发送失败也不会重复推送
  const papersToSend = preRecordPapers(allPapers, module.name);
  
  if (papersToSend.length === 0) {
    console.log(`[跳过] ${module.name} 所有论文已推送过`);
    return;
  }
  
  console.log(`\n[发送] ${module.name}: ${papersToSend.filter(p => !p.isPreprint).length} 篇论文 + ${papersToSend.filter(p => p.isPreprint).length} 篇预印本`);

  // 导出本次运行报告（JSON + Markdown），便于后续复盘或二次使用
  const now = new Date();
  await saveRunReport({
    moduleName: module.name,
    date: now,
    papers: papersToSend,
    isFallback,
    fallbackYear
  });

  try {
    await sendPaperEmail(papersToSend, module.name, module.recipients, isFallback, fallbackYear);
    console.log(`\n[完成] ${module.name} 处理完毕`);
  } catch (error) {
    console.error(`[邮件] ${module.name} 发送失败:`, error.message);
    // 注意：即使邮件发送失败，论文已被记录，不会重复推送
    // 这是预期行为，避免重复发送
  }
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
      console.error(error.stack);
    }
  }
  
  console.log('\n========================================');
  console.log('  全部模块处理完成！');
  console.log('========================================');
}

main();
