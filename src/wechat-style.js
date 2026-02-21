/**
 * 公众号风格 HTML 格式化工具
 * 将 Markdown 分析结果转换为微信公众号风格
 */

/**
 * 格式化期刊信息徽章
 */
export function formatJournalBadge(journalInfo) {
  if (!journalInfo) return '';
  
  const badges = [];
  
  // 影响因子
  if (journalInfo.impactFactor) {
    badges.push(`<span style="display: inline-block; padding: 3px 8px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; font-size: 12px; font-weight: bold; border-radius: 4px; margin-right: 6px;">IF: ${journalInfo.impactFactor}</span>`);
  }
  
  // 中科院分区
  if (journalInfo.cas) {
    const casColors = {
      '1': '#dc2626', '1区': '#dc2626', '一区': '#dc2626',
      '2': '#ea580c', '2区': '#ea580c', '二区': '#ea580c',
      '3': '#16a34a', '3区': '#16a34a', '三区': '#16a34a',
      '4': '#2563eb', '4区': '#2563eb', '四区': '#2563eb'
    };
    const color = casColors[journalInfo.cas] || '#6b7280';
    badges.push(`<span style="display: inline-block; padding: 3px 8px; background: ${color}; color: white; font-size: 12px; font-weight: bold; border-radius: 4px; margin-right: 6px;">中科院 ${journalInfo.cas}</span>`);
  }
  
  // JCR 分区
  if (journalInfo.jcr) {
    const jcrColors = {
      'Q1': '#dc2626', 'Q2': '#ea580c', 'Q3': '#16a34a', 'Q4': '#2563eb',
      '1': '#dc2626', '2': '#ea580c', '3': '#16a34a', '4': '#2563eb'
    };
    const color = jcrColors[journalInfo.jcr] || '#6b7280';
    badges.push(`<span style="display: inline-block; padding: 3px 8px; background: ${color}; color: white; font-size: 12px; font-weight: bold; border-radius: 4px; margin-right: 6px;">JCR ${journalInfo.jcr}</span>`);
  }
  
  // TOP 标记
  if (journalInfo.top) {
    badges.push(`<span style="display: inline-block; padding: 3px 8px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; font-size: 12px; font-weight: bold; border-radius: 4px; margin-right: 6px;">🔥 TOP</span>`);
  }
  
  return badges.join('');
}

/**
 * 将 Markdown 转换为公众号风格 HTML
 */
export function markdownToWechatStyle(md) {
  if (!md) return '';
  
  let html = md
    // 转义 HTML
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // 标题
    .replace(/^### (.*$)/gm, '<h3 style="margin: 20px 0 10px 0; padding-left: 12px; border-left: 4px solid #3b82f6; font-size: 16px; font-weight: bold; color: #1f2937;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="margin: 25px 0 12px 0; padding: 10px 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 17px; font-weight: bold; border-radius: 6px;">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="margin: 0 0 20px 0; padding: 15px; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-size: 20px; font-weight: bold; border-radius: 8px; text-align: center;">$1</h1>')
    
    // 粗体
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1f2937;">$1</strong>')
    
    // 表格处理
    .replace(/\|(.+)\|/g, (match, content) => {
      const cells = content.split('|').map(c => c.trim());
      if (cells.every(c => c.match(/^-+$/))) {
        return ''; // 分隔线跳过
      }
      const cellHtml = cells.map(c => `<td style="padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 13px;">${c}</td>`).join('');
      return `<tr style="background: #f9fafb;">${cellHtml}</tr>`;
    })
    
    // 列表
    .replace(/^- (.*$)/gm, '<li style="margin: 6px 0; padding-left: 5px; font-size: 14px; color: #374151;">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li style="margin: 6px 0; padding-left: 5px; font-size: 14px; color: #374151;"><span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 50%; font-size: 12px; margin-right: 8px;">$1</span>$2</li>')
    
    // 引用块
    .replace(/^> (.*$)/gm, '<blockquote style="margin: 15px 0; padding: 12px 15px; background: #f0f9ff; border-left: 4px solid #3b82f6; color: #1e40af; font-size: 14px; font-style: italic;">$1</blockquote>')
    
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="margin: 15px 0; padding: 15px; background: #1f2937; color: #e5e7eb; border-radius: 8px; font-size: 13px; overflow-x: auto; font-family: monospace;"><code>$2</code></pre>')
    
    // 行内代码
    .replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #dc2626;">$1</code>')
    
    // 分隔线
    .replace(/^---$/gm, '<hr style="margin: 20px 0; border: none; border-top: 2px dashed #e5e7eb;">')
    
    // 段落
    .replace(/\n\n/g, '</p><p style="margin: 12px 0; font-size: 14px; line-height: 1.8; color: #374151;">')
    
    // emoji 保持
    .replace(/([📚🎯🧠🔷🔍🟢🟡🔵🔬🧩✅⚠️💡📝📊🔓📋📌⬇️→↓↑])/g, '<span style="font-size: 16px;">$1</span>');
  
  // 包装
  html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #374151;">
    <p style="margin: 12px 0; font-size: 14px; line-height: 1.8; color: #374151;">${html}</p>
  </div>`;
  
  // 清理多余空标签
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');
  html = html.replace(/<p[^>]*><br\s*\/?>\s*<\/p>/g, '');
  
  return html;
}

/**
 * 包装为公众号风格卡片
 */
export function wrapAsWechatCard(title, content) {
  return `
    <div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #3b82f6;">
        <span style="font-size: 20px; margin-right: 10px;">🔬</span>
        <span style="font-size: 16px; font-weight: bold; color: #1e40af;">${title}</span>
      </div>
      <div style="font-size: 14px; line-height: 1.9; color: #374151;">
        ${content}
      </div>
    </div>
  `;
}

/**
 * 处理深度分析内容为公众号风格
 */
export function formatDeepAnalysis(analysis) {
  if (!analysis) return '';
  
  const formatted = markdownToWechatStyle(analysis);
  return wrapAsWechatCard('📊 论文预判分析', formatted);
}
