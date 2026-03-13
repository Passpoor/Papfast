/**
 * 已推送论文记录管理
 *
 * 关键修复：
 * 1. 去重按“模块 + 论文标识”生效，避免多个订阅模块互相吞文献
 * 2. 兼容旧版全局 key，避免升级后把历史已发文献重新推送一遍
 * 3. 使用临时文件 + rename 进行真正的原子替换
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SENT_PAPERS_FILE = join(__dirname, '../data/sent-papers.json');
const DEFAULT_RETENTION_DAYS = 60;

function getPaperBaseKey(paper) {
  if (paper.pmid) return `pmid:${paper.pmid}`;
  if (paper.doi) return `doi:${paper.doi}`;
  if (paper.title && typeof paper.title === 'string') {
    return `title:${paper.title.slice(0, 50).toLowerCase().replace(/\s+/g, '')}`;
  }
  return null;
}

function normalizeModuleName(moduleName = '') {
  return String(moduleName || '').trim().toLowerCase();
}

function getPaperScopedKey(paper, moduleName = '') {
  const baseKey = getPaperBaseKey(paper);
  if (!baseKey) return null;

  const normalizedModule = normalizeModuleName(moduleName);
  return normalizedModule ? `${normalizedModule}::${baseKey}` : baseKey;
}

function getPaperLookupKeys(paper, moduleName = '') {
  const baseKey = getPaperBaseKey(paper);
  if (!baseKey) return [];

  const scopedKey = getPaperScopedKey(paper, moduleName);
  return scopedKey && scopedKey !== baseKey ? [scopedKey, baseKey] : [baseKey];
}

function hasRecordedPaper(sentPapers, paper, moduleName = '') {
  return getPaperLookupKeys(paper, moduleName).some(key => sentPapers.has(key));
}

function ensureDataDir() {
  const dataDir = join(__dirname, '../data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export function loadSentPapers() {
  if (!existsSync(SENT_PAPERS_FILE)) {
    return new Map();
  }

  try {
    const data = JSON.parse(readFileSync(SENT_PAPERS_FILE, 'utf-8'));
    const map = new Map();

    for (const record of data.papers || []) {
      let key = record.key;

      if (!key) {
        const modulePrefix = normalizeModuleName(record.module);
        const baseKey = record.pmid ? `pmid:${record.pmid}` : record.doi ? `doi:${record.doi}` : null;
        if (baseKey) {
          key = modulePrefix ? `${modulePrefix}::${baseKey}` : baseKey;
        }
      }

      if (!key) continue;

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

    return map;
  } catch (error) {
    console.error('[记录] 加载已推送论文失败:', error.message);
    try {
      const backupPath = SENT_PAPERS_FILE + '.backup.' + Date.now();
      const data = readFileSync(SENT_PAPERS_FILE, 'utf-8');
      ensureDataDir();
      writeFileSync(backupPath, data);
      console.log(`[记录] 已备份损坏文件到 ${backupPath}`);
    } catch {}
    return new Map();
  }
}

export function saveSentPapersImmediately(sentPapersMap) {
  ensureDataDir();

  const papers = Array.from(sentPapersMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
  const data = {
    lastUpdated: new Date().toISOString(),
    totalRecords: papers.length,
    papers
  };

  const tempFile = SENT_PAPERS_FILE + '.tmp';
  writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tempFile, SENT_PAPERS_FILE);

  console.log(`[记录] 已保存 ${papers.length} 条推送记录`);
}

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
      cleaned += 1;
    }
  }

  if (cleaned > 0) {
    console.log(`[记录] 清理 ${cleaned} 条过期记录（保留 ${retentionDays} 天）`);
  }

  return newMap;
}

export function preRecordPapers(papers, moduleName) {
  const sentPapers = loadSentPapers();
  const today = new Date().toISOString().slice(0, 10);

  const papersToSend = [];
  let alreadyRecorded = 0;

  for (const paper of papers) {
    const key = getPaperScopedKey(paper, moduleName);

    if (!key) {
      console.warn(`[记录] 跳过无标识符的论文: ${paper.title?.slice(0, 50)}...`);
      continue;
    }

    if (hasRecordedPaper(sentPapers, paper, moduleName)) {
      alreadyRecorded += 1;
      continue;
    }

    let titleStr = '';
    if (paper.title) {
      titleStr = typeof paper.title === 'string'
        ? paper.title
        : (typeof paper.title === 'object' ? JSON.stringify(paper.title) : String(paper.title));
      titleStr = titleStr.slice(0, 100);
    }

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

  const cleanedMap = cleanOldRecords(sentPapers);
  saveSentPapersImmediately(cleanedMap);

  return papersToSend;
}

export function recordSentPapers(papers, moduleName) {
  preRecordPapers(papers, moduleName);
}

export function filterUnsentPapers(papers, moduleName = '') {
  const sentPapers = loadSentPapers();
  const unsent = [];
  let skipped = 0;

  for (const paper of papers) {
    if (hasRecordedPaper(sentPapers, paper, moduleName)) {
      skipped += 1;
    } else {
      unsent.push(paper);
    }
  }

  if (skipped > 0) {
    console.log(`[去重] ${moduleName} 跳过 ${skipped} 篇已推送论文`);
  }

  return unsent;
}

export function isPaperSent(paper) {
  const sentPapers = loadSentPapers();
  return hasRecordedPaper(sentPapers, paper);
}

export function getSentPapersStats() {
  const sentPapers = loadSentPapers();
  const modules = {};
  let preprints = 0;

  for (const record of sentPapers.values()) {
    modules[record.module] = (modules[record.module] || 0) + 1;
    if (record.isPreprint) preprints += 1;
  }

  return {
    total: sentPapers.size,
    preprints,
    byModule: modules
  };
}

export function cleanupSentPapersTempFile() {
  const tempFile = SENT_PAPERS_FILE + '.tmp';
  if (!existsSync(tempFile)) return false;

  try {
    unlinkSync(tempFile);
    return true;
  } catch (error) {
    console.warn('[记录] 清理临时文件失败:', error.message);
    return false;
  }
}
