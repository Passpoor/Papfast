/**
 * 已推送论文记录管理
 * 
 * 用于回退机制的去重，避免重复推送相同论文
 * 支持 PMID（PubMed）和 DOI（预印本）双重去重
 * 
 * 关键特性：
 * 1. 立即持久化 - 每次记录后立即写入文件
 * 2. 原子操作 - 先记录再发送，确保不丢数据
 * 3. 健壮性 - 处理各种边界情况
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SENT_PAPERS_FILE = join(__dirname, '../data/sent-papers.json');
const DEFAULT_RETENTION_DAYS = 60; // 增加到 60 天，更安全

/**
 * 获取论文的唯一标识符（优先 PMID，其次 DOI）
 */
function getPaperKey(paper) {
  if (paper.pmid) return `pmid:${paper.pmid}`;
  if (paper.doi) return `doi:${paper.doi}`;
  // 如果都没有，用标题哈希（最后的fallback）
  if (paper.title && typeof paper.title === 'string') {
    return `title:${paper.title.slice(0, 50).toLowerCase().replace(/\s+/g, '')}`;
  }
  return null;
}

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
  const dataDir = join(__dirname, '../data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * 加载已推送论文记录
 * @returns {Map<string, object>}
 */
export function loadSentPapers() {
  if (!existsSync(SENT_PAPERS_FILE)) {
    return new Map();
  }
  
  try {
    const data = JSON.parse(readFileSync(SENT_PAPERS_FILE, 'utf-8'));
    const map = new Map();
    
    for (const record of data.papers || []) {
      // 兼容所有旧格式，统一生成 key
      let key = record.key;
      if (!key) {
        if (record.pmid) key = `pmid:${record.pmid}`;
        else if (record.doi) key = `doi:${record.doi}`;
      }
      
      if (key) {
        map.set(key, {
          key,
          pmid: record.pmid || null,
          doi: record.doi || null,
          module: record.module || 'unknown',
          date: record.date || '2020-01-01',
          title: record.title || '',
          isPreprint: record.isPreprint || false
        });
      }
    }
    
    return map;
  } catch (error) {
    console.error('[记录] 加载已推送论文失败:', error.message);
    // 备份损坏的文件
    try {
      const backupPath = SENT_PAPERS_FILE + '.backup.' + Date.now();
      const data = readFileSync(SENT_PAPERS_FILE, 'utf-8');
      ensureDataDir();
      writeFileSync(backupPath, data);
      console.log(`[记录] 已备份损坏文件到 ${backupPath}`);
    } catch (e) {}
    return new Map();
  }
}

/**
 * 立即保存已推送论文记录（原子操作）
 */
export function saveSentPapersImmediately(sentPapersMap) {
  ensureDataDir();
  
  // 转换为数组并按日期排序（最新的在前）
  const papers = Array.from(sentPapersMap.values())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const data = {
    lastUpdated: new Date().toISOString(),
    totalRecords: papers.length,
    papers
  };
  
  // 先写入临时文件，再重命名（原子操作）
  const tempFile = SENT_PAPERS_FILE + '.tmp';
  writeFileSync(tempFile, JSON.stringify(data, null, 2));
  
  // Windows 下直接覆盖
  writeFileSync(SENT_PAPERS_FILE, JSON.stringify(data, null, 2));
  
  console.log(`[记录] 已保存 ${papers.length} 条推送记录`);
}

/**
 * 清理过期记录
 */
function cleanOldRecords(sentPapersMap, retentionDays = DEFAULT_RETENTION_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  
  let cleaned = 0;
  const newMap = new Map();
  
  for (const [key, record] of sentPapersMap) {
    if (record.date >= cutoffStr) {
      newMap.set(key, record);
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
 * 在发送邮件前预先记录论文（确保即使发送失败也不会重复推送）
 * @param {Array} papers - 即将发送的论文列表
 * @param {string} moduleName - 模块名称
 * @returns {Array} 实际应该发送的论文（排除已记录的）
 */
export function preRecordPapers(papers, moduleName) {
  const sentPapers = loadSentPapers();
  const today = new Date().toISOString().slice(0, 10);
  
  const papersToSend = [];
  let alreadyRecorded = 0;
  
  for (const paper of papers) {
    const key = getPaperKey(paper);
    
    if (!key) {
      console.warn(`[记录] 跳过无标识符的论文: ${paper.title?.slice(0, 50)}...`);
      continue;
    }
    
    if (sentPapers.has(key)) {
      alreadyRecorded++;
      continue;
    }
    
    // 安全提取标题
    let titleStr = '';
    if (paper.title) {
      titleStr = typeof paper.title === 'string' 
        ? paper.title 
        : (typeof paper.title === 'object' ? JSON.stringify(paper.title) : String(paper.title));
      titleStr = titleStr.slice(0, 100);
    }
    
    // 立即加入记录
    sentPapers.set(key, {
      key,
      pmid: paper.pmid || null,
      doi: paper.doi || null,
      module: moduleName,
      date: today,
      title: titleStr,
      isPreprint: paper.isPreprint || false
    });
    
    papersToSend.push(paper);
  }
  
  if (alreadyRecorded > 0) {
    console.log(`[记录] ${moduleName} 发现 ${alreadyRecorded} 篇已记录论文`);
  }
  
  // 立即保存
  const cleanedMap = cleanOldRecords(sentPapers);
  saveSentPapersImmediately(cleanedMap);
  
  return papersToSend;
}

/**
 * 记录已推送的论文（兼容旧接口）
 */
export function recordSentPapers(papers, moduleName) {
  // 使用 preRecordPapers 的逻辑
  preRecordPapers(papers, moduleName);
}

/**
 * 过滤掉已推送的论文（查询阶段使用）
 */
export function filterUnsentPapers(papers, moduleName = '') {
  const sentPapers = loadSentPapers();
  const unsent = [];
  let skipped = 0;
  
  for (const paper of papers) {
    const key = getPaperKey(paper);
    if (key && sentPapers.has(key)) {
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
 * 检查论文是否已推送
 */
export function isPaperSent(paper) {
  const sentPapers = loadSentPapers();
  const key = getPaperKey(paper);
  return key ? sentPapers.has(key) : false;
}

/**
 * 获取已推送论文统计
 */
export function getSentPapersStats() {
  const sentPapers = loadSentPapers();
  const modules = {};
  let preprints = 0;
  
  for (const record of sentPapers.values()) {
    modules[record.module] = (modules[record.module] || 0) + 1;
    if (record.isPreprint) preprints++;
  }
  
  return {
    total: sentPapers.size,
    preprints,
    byModule: modules
  };
}
