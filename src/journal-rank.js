/**
 * easyScholar API 集成
 * 获取期刊影响因子和等级信息
 */

const EASYSCHOLAR_API = 'https://www.easyscholar.cc/open/getPublicationRank';
const SECRET_KEY = process.env.EASYSCHOLAR_KEY || '';

// 请求限流：每秒最多2次
let lastRequestTime = 0;
const MIN_INTERVAL = 550; // 550ms 间隔

/**
 * 获取期刊等级信息
 * @param {string} journalName - 期刊名称
 * @returns {Promise<Object|null>}
 */
export async function getJournalRank(journalName) {
  if (!journalName) return null;
  if (!SECRET_KEY) {
    console.warn('[easyScholar] EASYSCHOLAR_KEY 未配置，跳过期刊查询');
    return null;
  }
  
  // 限流
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
  
  try {
    const url = `${EASYSCHOLAR_API}?secretKey=${SECRET_KEY}&publicationName=${encodeURIComponent(journalName)}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.code !== 200 || !data.data) {
      return null;
    }
    
    return parseJournalRank(data.data, journalName);
  } catch (error) {
    console.error(`[easyScholar] 查询失败: ${journalName}`, error.message);
    return null;
  }
}

/**
 * 解析期刊等级信息
 */
function parseJournalRank(data, journalName) {
  const result = {
    journal: journalName,
    impactFactor: null,
    jcr: null,        // JCR 分区
    cas: null,        // 中科院分区
    ccf: null,        // CCF 等级
    sci: null,        // SCI 影响因子
    ssci: null,       // SSCI 影响因子
    ei: null,         // EI 收录
    top: false        // 是否 TOP 期刊
  };
  
  // 解析官方数据集
  if (data.officialRank?.all) {
    const all = data.officialRank.all;
    
    // SCI 影响因子
    if (all.sci) {
      result.sci = all.sci;
      result.impactFactor = all.sci;
    }
    
    // SSCI 影响因子
    if (all.ssci) {
      result.ssci = all.ssci;
    }
    
    // JCR 分区
    if (all.jcr) {
      result.jcr = all.jcr;
    }
    
    // 中科院分区
    if (all.cas) {
      result.cas = all.cas;
    }
    
    // CCF 等级
    if (all.ccf) {
      result.ccf = all.ccf;
    }
    
    // EI 收录
    if (all.ei) {
      result.ei = all.ei;
    }
    
    // AJG (ABS) 等级
    if (all.ajg) {
      result.ajg = all.ajg;
    }
    
    // UT DALLAS 等级
    if (all.utd24) {
      result.utd24 = all.utd24;
    }
    
    // FT50
    if (all.ft50) {
      result.ft50 = all.ft50;
    }
  }
  
  // 判断是否 TOP 期刊
  if (result.cas && ['1', '1区', '一区'].includes(result.cas)) {
    result.top = true;
  }
  if (result.jcr && ['Q1', '1'].includes(result.jcr)) {
    result.top = true;
  }
  
  return result;
}

/**
 * 批量获取期刊等级（带缓存）
 */
const cache = new Map();

export async function getJournalRanks(journals) {
  const results = new Map();
  
  for (const journal of journals) {
    // 检查缓存
    if (cache.has(journal)) {
      results.set(journal, cache.get(journal));
      continue;
    }
    
    const rank = await getJournalRank(journal);
    if (rank) {
      cache.set(journal, rank);
      results.set(journal, rank);
    }
    
    // 限流
    await new Promise(r => setTimeout(r, 550));
  }
  
  return results;
}

/**
 * 格式化期刊信息用于邮件显示
 */
export function formatJournalInfo(rankInfo) {
  if (!rankInfo) return '';
  
  const parts = [];
  
  // 影响因子
  if (rankInfo.impactFactor) {
    parts.push(`IF: ${rankInfo.impactFactor}`);
  }
  
  // 中科院分区
  if (rankInfo.cas) {
    parts.push(`中科院 ${rankInfo.cas}`);
  }
  
  // JCR 分区
  if (rankInfo.jcr) {
    parts.push(`JCR ${rankInfo.jcr}`);
  }
  
  // CCF
  if (rankInfo.ccf) {
    parts.push(`CCF ${rankInfo.ccf}`);
  }
  
  // TOP 标记
  if (rankInfo.top) {
    parts.push('🔥 TOP');
  }
  
  return parts.join(' | ');
}
