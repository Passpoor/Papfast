/**
 * 已推送论文记录管理
 * 
 * 用于回退机制的去重，避免重复推送相同论文
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SENT_PAPERS_FILE = join(__dirname, '../data/sent-papers.json');
const DEFAULT_RETENTION_DAYS = 30;

/**
 * 加载已推送论文记录
 * @returns {Map<string, {pmid: string, module: string, date: string}>}
 */
export function loadSentPapers() {
  if (!existsSync(SENT_PAPERS_FILE)) {
    return new Map();
  }
  
  try {
    const data = JSON.parse(readFileSync(SENT_PAPERS_FILE, 'utf-8'));
    const map = new Map();
    
    for (const record of data.papers || []) {
      map.set(record.pmid, record);
    }
    
    return map;
  } catch (error) {
    console.error('[记录] 加载已推送论文失败:', error.message);
    return new Map();
  }
}

/**
 * 保存已推送论文记录
 * @param {Map} sentPapersMap 
 */
export function saveSentPapers(sentPapersMap) {
  // 转换为数组并按日期排序（最新的在前）
  const papers = Array.from(sentPapersMap.values())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // 确保目录存在
  const dataDir = join(__dirname, '../data');
  if (!existsSync(dataDir)) {
    import('fs').then(fs => fs.mkdirSync(dataDir, { recursive: true }));
  }
  
  writeFileSync(SENT_PAPERS_FILE, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    totalRecords: papers.length,
    papers
  }, null, 2));
  
  console.log(`[记录] 已保存 ${papers.length} 条推送记录`);
}

/**
 * 清理过期记录（默认保留 30 天）
 * @param {Map} sentPapersMap 
 * @param {number} retentionDays 
 * @returns {Map} 清理后的 Map
 */
export function cleanOldRecords(sentPapersMap, retentionDays = DEFAULT_RETENTION_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  
  let cleaned = 0;
  const newMap = new Map();
  
  for (const [pmid, record] of sentPapersMap) {
    if (record.date >= cutoffStr) {
      newMap.set(pmid, record);
    } else {
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[记录] 清理 ${cleaned} 条过期记录（保留 ${retentionDays} 天）`);
  }
  
  return newMap;
}

/**
 * 记录已推送的论文
 * @param {Array} papers - 论文列表
 * @param {string} moduleName - 模块名称
 */
export function recordSentPapers(papers, moduleName) {
  const sentPapers = loadSentPapers();
  const today = new Date().toISOString().slice(0, 10);
  
  let added = 0;
  for (const paper of papers) {
    if (paper.pmid && !sentPapers.has(paper.pmid)) {
      sentPapers.set(paper.pmid, {
        pmid: paper.pmid,
        module: moduleName,
        date: today,
        title: paper.title?.slice(0, 100) // 只保留标题前100字符
      });
      added++;
    }
  }
  
  // 清理过期记录
  const cleanedMap = cleanOldRecords(sentPapers);
  saveSentPapers(cleanedMap);
  
  console.log(`[记录] 新增 ${added} 条推送记录`);
}

/**
 * 过滤掉已推送的论文
 * @param {Array} papers - 论文列表
 * @param {string} moduleName - 模块名称（可选，用于日志）
 * @returns {Array} 未推送过的论文
 */
export function filterUnsentPapers(papers, moduleName = '') {
  const sentPapers = loadSentPapers();
  const unsent = [];
  let skipped = 0;
  
  for (const paper of papers) {
    if (sentPapers.has(paper.pmid)) {
      skipped++;
    } else {
      unsent.push(paper);
    }
  }
  
  if (skipped > 0) {
    console.log(`[去重] ${moduleName} 跳过 ${skipped} 篇已推送论文`);
  }
  
  return unsent;
}

/**
 * 获取已推送论文统计
 */
export function getSentPapersStats() {
  const sentPapers = loadSentPapers();
  const modules = {};
  
  for (const record of sentPapers.values()) {
    modules[record.module] = (modules[record.module] || 0) + 1;
  }
  
  return {
    total: sentPapers.size,
    byModule: modules
  };
}
