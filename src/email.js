import nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { formatDeepAnalysis, formatJournalBadge } from './wechat-style.js';

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
}

const configText = readFileSync(configPath, 'utf-8');
const config = JSON.parse(resolveConfig(configText));

// 创建邮件传输器
const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.secure,
  auth: {
    user: config.email.smtp.user,
    pass: config.email.smtp.pass
  }
});

/**
 * 生成邮件 HTML 内容
 */
function generateEmailHtml(papers, date, moduleName = '肺泡巨噬细胞', isFallback = false, fallbackYear = null) {
  const dateStr = date.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // 根据是否回退模式生成不同的摘要
  let summaryText = '';
  if (isFallback && fallbackYear) {
    summaryText = `<p style="margin: 0;"><strong>📚 追溯推送: ${papers.length} 篇精选论文</strong></p>
    <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">近 7 天无新论文，已从 ${fallbackYear} 年以来的文献中精选 ${papers.length} 篇高质量论文</p>`;
  } else {
    summaryText = `<p style="margin: 0;"><strong>今日新增论文: ${papers.length} 篇</strong></p>
    <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">共 ${papers.length} 篇论文</p>`;
  }
  
  const papersHtml = papers.map((paper, index) => {
    const authorsStr = paper.authors.slice(0, 5).join(', ') + (paper.authors.length > 5 ? ' 等' : '');
    const affiliationsStr = paper.affiliations.slice(0, 2).join('; ') + (paper.affiliations.length > 2 ? ' ...' : '');
    const keywordsStr = (paper.keywordsZh || paper.keywords || []).slice(0, 5).join(', ');
    
    // 期刊信息徽章
    const journalBadge = paper.journalInfo ? formatJournalBadge(paper.journalInfo) : '';
    const journalLine = paper.journal ? `<p style="margin: 5px 0; font-size: 13px;"><strong>期刊:</strong> ${paper.journal} ${journalBadge}</p>` : '';
    
    return `
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; background: #fafafa;">
      <h3 style="margin: 0 0 10px 0; color: #1565c0;">
        <a href="${paper.url}" style="color: #1565c0; text-decoration: none;">${index + 1}. ${paper.title}</a>
      </h3>
      ${paper.titleZh ? `<p style="color: #666; margin: 0 0 10px 0; font-size: 14px;"><strong>中文:</strong> ${paper.titleZh}</p>` : ''}
      
      ${journalLine}
      <p style="margin: 5px 0; font-size: 14px;"><strong>作者:</strong> ${authorsStr}</p>
      ${affiliationsStr ? `<p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>单位:</strong> ${affiliationsStr}</p>` : ''}
      <p style="margin: 5px 0; font-size: 12px; color: #888;"><strong>PMID:</strong> ${paper.pmid} | <strong>DOI:</strong> ${paper.doi || '无'}</p>
      
      ${paper.abstract ? `
      <div style="margin: 15px 0; padding: 10px; background: #fff; border-left: 3px solid #1565c0;">
        <p style="margin: 0; font-size: 13px; color: #333;"><strong>摘要 (英文):</strong></p>
        <p style="margin: 5px 0; font-size: 13px; color: #444; line-height: 1.6;">${paper.abstract.slice(0, 500)}${paper.abstract.length > 500 ? '...' : ''}</p>
      </div>
      ` : ''}
      
      ${paper.abstractZh ? `
      <div style="margin: 15px 0; padding: 10px; background: #fff; border-left: 3px solid #4caf50;">
        <p style="margin: 0; font-size: 13px; color: #333;"><strong>摘要 (中文翻译):</strong></p>
        <p style="margin: 5px 0; font-size: 13px; color: #444; line-height: 1.6;">${paper.abstractZh}</p>
      </div>
      ` : ''}
      
      ${paper.deepAnalysis ? formatDeepAnalysis(paper.deepAnalysis) : ''}
      
      ${keywordsStr ? `<p style="margin: 10px 0 0 0; font-size: 12px; color: #888;"><strong>关键词:</strong> ${keywordsStr}</p>` : ''}
      
      <p style="margin: 10px 0 0 0; font-size: 12px;">
        <a href="${paper.url}" style="color: #1565c0;">查看原文 →</a>
      </p>
    </div>
    `;
  }).join('');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1565c0; border-bottom: 2px solid #1565c0; padding-bottom: 10px; }
    .summary { background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <h1>📊 ${moduleName}论文日报</h1>
  <p style="color: #666;">${dateStr}</p>
  
  <div class="summary">
    ${summaryText}
  </div>
  
  ${papersHtml}
  
  <div class="footer">
    <p>本邮件由 Papfast 自动生成</p>
    <p>如需调整订阅关键词或频率，请联系管理员</p>
  </div>
</body>
</html>
  `;
}

/**
 * 发送论文邮件
 */
export async function sendPaperEmail(papers, moduleName = '论文', recipients = null, isFallback = false, fallbackYear = null) {
  if (papers.length === 0) {
    console.log('[邮件] 没有新论文，跳过发送');
    return false;
  }
  
  const date = new Date();
  const dateStr = date.toLocaleDateString('zh-CN');
  
  const to = recipients || config.email.to;
  
  // 邮件标题也区分模式
  const subjectPrefix = isFallback ? `📚 ${moduleName}论文精选` : `📊 ${moduleName}论文日报`;
  
  const mailOptions = {
    from: `"Papfast 论文订阅" <${config.email.from}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject: `${subjectPrefix} - ${dateStr} (${papers.length}篇)`,
    html: generateEmailHtml(papers, date, moduleName, isFallback, fallbackYear)
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[邮件] 发送成功: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[邮件] 发送失败:', error.message);
    throw error;
  }
}

/**
 * 发送测试邮件
 */
export async function sendTestEmail() {
  const mailOptions = {
    from: `"Papfast 论文订阅" <${config.email.from}>`,
    to: config.email.to,
    subject: '✅ Papfast 邮件配置测试',
    html: `
      <h1>邮件配置测试成功！</h1>
      <p>如果你收到这封邮件，说明 Papfast 的邮件配置已经正确设置。</p>
      <p>配置信息：</p>
      <ul>
        <li>SMTP 服务器: ${config.email.smtp.host}:${config.email.smtp.port}</li>
        <li>发件邮箱: ${config.email.from}</li>
        <li>收件邮箱: ${config.email.to}</li>
      </ul>
      <p>接下来将开始定期推送肺泡巨噬细胞相关论文。</p>
    `
  };
  
  const info = await transporter.sendMail(mailOptions);
  console.log(`[测试邮件] 发送成功: ${info.messageId}`);
  return info;
}
