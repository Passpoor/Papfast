/**
 * bioRxiv / medRxiv 预印本抓取模块
 * 
 * API 文档: https://api.biorxiv.org
 * 
 * 支持按日期范围和类别获取预印本
 */

import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const API_BASE = 'https://api.biorxiv.org/details';

/**
 * 从 bioRxiv/medRxiv 获取预印本
 * @param {Object} options - 配置选项
 * @param {string} options.server - 'biorxiv' 或 'medrxiv'
 * @param {string} options.category - 学科类别（可选）
 * @param {number} options.daysBack - 回溯天数
 * @param {number} options.maxResults - 最大结果数
 * @returns {Array} 预印本列表
 */
export async function fetchPreprints(options) {
  const { server = 'biorxiv', category, daysBack = 7, maxResults = 20 } = options;
  
  // 计算日期范围
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - daysBack);
  
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = today.toISOString().slice(0, 10);
  
  // 构建请求 URL
  // 格式: https://api.biorxiv.org/details/[server]/[start]/[end]
  let url = `${API_BASE}/${server}/${startDateStr}/${endDateStr}`;
  
  // 添加类别过滤（可选）
  if (category) {
    // 类别名中的空格用下划线替换
    const categoryParam = category.replace(/\s+/g, '_');
    url += `?category=${categoryParam}`;
  }
  
  console.log(`[预印本] ${server} ${startDateStr} ~ ${endDateStr}${category ? ` (${category})` : ''}`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.collection || data.collection.length === 0) {
      console.log(`[预印本] ${server} 无新预印本`);
      return [];
    }
    
    // 解析并格式化结果
    const preprints = data.collection
      .slice(0, maxResults)
      .map(item => parsePreprint(item, server));
    
    console.log(`[预印本] ${server} 找到 ${preprints.length} 篇预印本`);
    
    return preprints;
  } catch (error) {
    console.error(`[预印本] ${server} 获取失败:`, error.message);
    return [];
  }
}

/**
 * 按关键词搜索预印本（通过标题/摘要匹配）
 * bioRxiv API 不支持关键词搜索，需要获取后在本地过滤
 * 
 * @param {Object} options - 配置选项
 * @param {string} options.server - 'biorxiv' 或 'medrxiv'
 * @param {Array<string>} options.keywords - 关键词列表
 * @param {number} options.daysBack - 回溯天数
 * @param {number} options.maxResults - 最大结果数
 * @returns {Array} 匹配的预印本列表
 */
export async function searchPreprintsByKeywords(options) {
  const { server = 'biorxiv', keywords = [], daysBack = 7, maxResults = 20 } = options;
  
  // 计算日期范围 - 扩大搜索范围以确保有足够结果
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - daysBack);
  
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = today.toISOString().slice(0, 10);
  
  let url = `${API_BASE}/${server}/${startDateStr}/${endDateStr}`;
  
  console.log(`[预印本] ${server} 搜索关键词: ${keywords.join(', ')}`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.collection || data.collection.length === 0) {
      console.log(`[预印本] ${server} 无预印本`);
      return [];
    }
    
    // 本地过滤：匹配标题或摘要中的关键词
    const keywordsLower = keywords.map(k => k.toLowerCase());
    
    const matched = data.collection.filter(item => {
      const title = (item.title || '').toLowerCase();
      const abstract = (item.abstract || '').toLowerCase();
      const text = title + ' ' + abstract;
      
      // 任一关键词匹配即可
      return keywordsLower.some(kw => text.includes(kw));
    });
    
    // 格式化结果
    const preprints = matched
      .slice(0, maxResults)
      .map(item => parsePreprint(item, server));
    
    console.log(`[预印本] ${server} 匹配 ${preprints.length} 篇预印本`);
    
    return preprints;
  } catch (error) {
    console.error(`[预印本] ${server} 搜索失败:`, error.message);
    return [];
  }
}

/**
 * 解析预印本数据
 */
function parsePreprint(item, server) {
  // 作者列表
  const authors = (item.authors || '').split(';').map(a => a.trim()).filter(Boolean);
  
  // DOI 链接
  const doi = item.doi || '';
  const doiUrl = doi.startsWith('10.') 
    ? `https://doi.org/${doi}`
    : `https://www.${server}.org/content/${doi}`;
  
  return {
    doi,
    pmid: null, // 预印本没有 PMID
    title: item.title || '无标题',
    authors,
    affiliations: item.author_corresponding_institution ? [item.author_corresponding_institution] : [],
    abstract: item.abstract || '',
    hasAbstract: !!(item.abstract && item.abstract.trim()),
    keywords: item.category ? [item.category] : [],
    pubDate: item.date || '',
    journal: server === 'biorxiv' ? 'bioRxiv' : 'medRxiv',
    journalAbbr: server,
    journalInfo: {
      rank: 'preprint',
      impactFactor: null,
      note: '预印本 - 尚未经过同行评审'
    },
    journalInfoText: '预印本',
    category: item.category || '',
    server,
    license: item.license || '',
    version: item.version || '',
    url: doiUrl,
    isPreprint: true
  };
}

/**
 * 获取预印本的学科类别列表
 */
export const BIORXIV_CATEGORIES = [
  'animal behavior and cognition',
  'biochemistry',
  'bioinformatics',
  'biophysics',
  'cancer biology',
  'cell biology',
  'clinical trials',
  'developmental biology',
  'ecology',
  'epidemiology',
  'evolutionary biology',
  'genetics',
  'genomics',
  'immunology',
  'microbiology',
  'molecular biology',
  'neuroscience',
  'paleontology',
  'pathology',
  'pharmacology and toxicology',
  'physiology',
  'plant biology',
  'scientific communication and education',
  'synthetic biology',
  'systems biology',
  'zoology'
];

export const MEDRXIV_CATEGORIES = [
  'addiction medicine',
  'allergy and immunology',
  'anesthesiology',
  'cardiovascular medicine',
  'clinical trials',
  'critical care medicine',
  'dentistry and oral medicine',
  'dermatology',
  'emergency medicine',
  'endocrinology',
  'epidemiology',
  'forensic medicine',
  'gastroenterology',
  'genetic and genomic medicine',
  'geriatric medicine',
  'health economics',
  'health policy',
  'health systems and quality improvement',
  'hematology',
  'hepatology',
  'HIV/AIDS',
  'infectious diseases',
  'medical education',
  'medical imaging',
  'medical ethics',
  'nephrology',
  'neurology',
  'nursing',
  'nutrition',
  'obesity medicine',
  'obstetrics and gynecology',
  'occupational health',
  'oncology',
  'ophthalmology',
  'orthopedics',
  'otolaryngology',
  'pathology',
  'pediatrics',
  'pharmacology and therapeutics',
  'primary care research',
  'psychiatry and clinical psychology',
  'public and global health',
  'pulmonary medicine',
  'radiation medicine',
  'rehabilitation medicine and physical therapy',
  'reproductive health',
  'respiratory medicine',
  'rheumatology',
  'sexual and reproductive health',
  'sports medicine',
  'substance abuse',
  'surgery',
  'transplantation',
  'urology',
  'virology'
];

// 测试运行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 测试：获取最近 3 天的 bioRxiv 细胞生物学预印本
  fetchPreprints({ 
    server: 'biorxiv', 
    category: 'cell biology', 
    daysBack: 3, 
    maxResults: 5 
  }).then(papers => {
    console.log(JSON.stringify(papers, null, 2));
  });
}
