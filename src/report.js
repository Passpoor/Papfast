/**
 * 报告导出模块
 * 将每次运行的论文结果导出为 JSON 和 Markdown，便于复盘与二次利用
 *
 * 设计目标：
 * - 不影响现有邮件推送主流程
 * - 每个模块、每天一份独立报告文件
 * - 兼容 PubMed 论文与预印本
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPORT_ROOT = join(__dirname, '../data/reports');

function ensureReportDir() {
  if (!existsSync(REPORT_ROOT)) {
    mkdirSync(REPORT_ROOT, { recursive: true });
  }
}

/**
 * 将模块名转为适合作为文件名的 slug
 * 例：'肺泡巨噬细胞-预印本' -> 'module'
 * 实际上保留中文在 Windows/Unix 都是可行的，但为了稳妥加入简单降噪
 */
function slugifyModuleName(name) {
  if (!name) return 'module';
  // 优先提取 ASCII 字符，若为空则退回使用原始字符串中的非空白字符
  const ascii = name.replace(/[^\x00-\x7F]+/g, '').trim();
  const base = ascii.length > 0 ? ascii : name;
  return base
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'module';
}

function formatDateForFile(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildJsonReport({ date, moduleName, papers, isFallback, fallbackYear }) {
  return {
    date: date.toISOString(),
    module: moduleName,
    isFallback: !!isFallback,
    fallbackFromYear: fallbackYear || null,
    total: papers.length,
    stats: {
      pubmed: papers.filter(p => !p.isPreprint).length,
      preprints: papers.filter(p => p.isPreprint).length
    },
    papers: papers.map((p, index) => ({
      index: index + 1,
      pmid: p.pmid || null,
      doi: p.doi || null,
      isPreprint: !!p.isPreprint,
      source: p.isPreprint ? (p.server || p.journalAbbr || 'preprint') : 'pubmed',
      title: typeof p.title === 'string' ? p.title : String(p.title || ''),
      titleZh: p.titleZh || null,
      abstract: p.abstract || null,
      abstractZh: p.abstractZh || null,
      journal: p.journal || null,
      journalAbbr: p.journalAbbr || null,
      journalInfo: p.journalInfo || null,
      journalInfoText: p.journalInfoText || null,
      url: p.url || null,
      keywords: p.keywords || [],
      keywordsZh: p.keywordsZh || [],
      deepAnalysis: p.deepAnalysis || null
    }))
  };
}

function truncate(text, maxLen) {
  if (!text) return '';
  const str = String(text);
  return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str;
}

function buildMarkdownReport({ date, moduleName, papers, isFallback, fallbackYear }) {
  const dateStr = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const pubmedCount = papers.filter(p => !p.isPreprint).length;
  const preprintCount = papers.filter(p => p.isPreprint).length;

  const headerLines = [];
  headerLines.push(`# ${moduleName} - 论文日报`);
  headerLines.push('');
  headerLines.push(`- 日期：${dateStr}`);
  headerLines.push(`- 总数：${papers.length} 篇（PubMed: ${pubmedCount}，预印本: ${preprintCount}）`);
  if (isFallback && fallbackYear) {
    headerLines.push(`- 模式：回退模式（自 ${fallbackYear} 年以来筛选历史高质量文献）`);
  } else {
    headerLines.push(`- 模式：最近文献（日回顾）`);
  }
  headerLines.push('');

  const paperBlocks = papers.map((p, index) => {
    const lines = [];
    const title = typeof p.title === 'string' ? p.title : String(p.title || '');
    lines.push(`## ${index + 1}. ${title}`);
    if (p.titleZh) {
      lines.push('');
      lines.push(`**中文标题**：${p.titleZh}`);
    }
    const parts = [];
    if (p.pmid) parts.push(`PMID: ${p.pmid}`);
    if (p.doi) parts.push(`DOI: ${p.doi}`);
    if (p.isPreprint) parts.push('预印本');
    if (parts.length > 0) {
      lines.push('');
      lines.push(`> ${parts.join(' | ')}`);
    }

    if (p.journal) {
      const info = p.journalInfoText ? `（${p.journalInfoText}）` : '';
      lines.push('');
      lines.push(`- 期刊：${p.journal}${info}`);
    }
    if (Array.isArray(p.authors) && p.authors.length > 0) {
      const mainAuthors = p.authors.slice(0, 5).join(', ') + (p.authors.length > 5 ? ' 等' : '');
      lines.push(`- 作者：${mainAuthors}`);
    }
    if (Array.isArray(p.keywordsZh) && p.keywordsZh.length > 0) {
      lines.push(`- 关键词（中）：${p.keywordsZh.slice(0, 5).join(', ')}`);
    } else if (Array.isArray(p.keywords) && p.keywords.length > 0) {
      lines.push(`- 关键词：${p.keywords.slice(0, 5).join(', ')}`);
    }

    if (p.abstractZh) {
      lines.push('');
      lines.push(`**摘要（中文）**：`);
      lines.push('');
      lines.push(truncate(p.abstractZh, 800));
    } else if (p.abstract) {
      lines.push('');
      lines.push(`**摘要（英文）**：`);
      lines.push('');
      lines.push(truncate(p.abstract, 800));
    }

    if (p.deepAnalysis) {
      lines.push('');
      lines.push(`**预判分析（节选）**：`);
      lines.push('');
      lines.push(truncate(p.deepAnalysis, 800));
    }

    if (p.url) {
      lines.push('');
      lines.push(`[查看原文](${p.url})`);
    }

    lines.push('');
    return lines.join('\n');
  });

  return [...headerLines, ...paperBlocks].join('\n');
}

/**
 * 保存一次运行的报告（JSON + Markdown）
 */
export async function saveRunReport({ moduleName, date, papers, isFallback = false, fallbackYear = null }) {
  if (!papers || papers.length === 0) return;

  const runDate = date instanceof Date ? date : new Date(date);
  const dateForFile = formatDateForFile(runDate);
  const slug = slugifyModuleName(moduleName);

  ensureReportDir();

  const baseName = `${dateForFile}__${slug || 'module'}`;
  const jsonPath = join(REPORT_ROOT, `${baseName}.json`);
  const mdPath = join(REPORT_ROOT, `${baseName}.md`);

  const jsonReport = buildJsonReport({ date: runDate, moduleName, papers, isFallback, fallbackYear });
  const mdReport = buildMarkdownReport({ date: runDate, moduleName, papers, isFallback, fallbackYear });

  try {
    writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
    writeFileSync(mdPath, mdReport, 'utf-8');
    console.log(`[报告] 已导出报告: ${baseName}.json / ${baseName}.md`);
  } catch (error) {
    console.error('[报告] 保存报告失败:', error.message);
  }
}

