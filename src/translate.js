import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载配置
const config = JSON.parse(readFileSync(join(__dirname, '../config/config.json'), 'utf-8'));

/**
 * 使用智谱 GLM 进行翻译
 */
async function translateWithGLM(text) {
  if (!text) return '';
  
  const textStr = String(text).trim();
  if (textStr.length === 0) return '';
  
  try {
    const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm.apiKey}`
      },
      body: JSON.stringify({
        model: config.llm.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的学术翻译，将英文翻译成中文。保持学术准确性，使用专业的医学术语。直接输出翻译结果，不要解释。'
          },
          {
            role: 'user',
            content: `将以下英文翻译成中文：\n\n${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });
    
    const data = await res.json();
    return data.choices?.[0]?.message?.content || text;
  } catch (error) {
    console.error('[GLM翻译] 失败:', error.message);
    return text;
  }
}

/**
 * 翻译文本（使用 GLM）
 */
export async function translateText(text, sourceLang = 'en', targetLang = 'zh-CN') {
  if (!text) return '';
  
  // 确保是字符串
  const textStr = String(text).trim();
  if (textStr.length === 0) return '';
  
  // 使用 GLM 翻译（无字符限制，质量更高）
  return await translateWithGLM(textStr);
}

/**
 * 翻译论文信息
 */
export async function translatePaper(paper) {
  console.log(`[翻译] 正在翻译: ${paper.title.slice(0, 50)}...`);
  
  try {
    // 一次性翻译标题和摘要（更高效）
    const combinedText = `标题：${paper.title}\n\n摘要：${paper.abstract}`;
    const translatedCombined = await translateText(combinedText);
    
    // 解析翻译结果
    let titleZh = paper.title;
    let abstractZh = paper.abstract;
    
    if (translatedCombined !== combinedText) {
      const titleMatch = translatedCombined.match(/标题[：:]\s*(.+?)(?=\n\n摘要[：:]|摘要[：:])/s);
      const abstractMatch = translatedCombined.match(/摘要[：:]\s*(.+)/s);
      
      if (titleMatch) titleZh = titleMatch[1].trim();
      if (abstractMatch) abstractZh = abstractMatch[1].trim();
    }
    
    // 翻译关键词
    const keywordsZh = [];
    for (const kw of paper.keywords.slice(0, 5)) {
      const translated = await translateText(kw);
      keywordsZh.push(translated);
      await new Promise(r => setTimeout(r, 100));
    }
    
    return {
      ...paper,
      titleZh,
      abstractZh,
      keywordsZh
    };
  } catch (error) {
    console.error(`[翻译] 论文翻译失败: ${paper.pmid}`, error.message);
    return {
      ...paper,
      titleZh: paper.title,
      abstractZh: paper.abstract,
      keywordsZh: paper.keywords
    };
  }
}

/**
 * 翻译所有论文
 */
export async function translateAllPapers(papers) {
  const translated = [];
  
  for (const paper of papers) {
    try {
      const translatedPaper = await translatePaper(paper);
      translated.push(translatedPaper);
      // 延迟避免 API 限流
      await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      console.error(`[翻译] 论文翻译失败: ${paper.pmid}`);
      translated.push({
        ...paper,
        titleZh: paper.title,
        abstractZh: paper.abstract,
        keywordsZh: paper.keywords
      });
    }
  }
  
  return translated;
}
