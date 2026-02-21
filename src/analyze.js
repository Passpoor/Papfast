/**
 * 论文深度分析模块
 * 使用 LLM 进行科研文献结构拆解
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SYSTEM_PROMPT, generateAnalysisPrompt } from './prompts/literature-analysis.js';

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

// 加载配置，支持环境变量替换
const configText = readFileSync(join(__dirname, '../config/config.json'), 'utf-8');
const config = JSON.parse(resolveConfig(configText));

// 调试：检查 LLM 配置
if (config.llm?.apiKey?.includes('${')) {
  console.error('[错误] LLM_API_KEY 环境变量未设置，请检查 GitHub Secrets');
}

/**
 * 调用 LLM API 进行分析
 * 支持多种后端：OpenAI、智谱、本地模型等
 */
export async function callLLM(prompt, options = {}) {
  // 检查是否配置了 LLM
  if (!config.llm?.enabled) {
    console.log('[LLM] 未配置 LLM，使用简化分析');
    return generateSimpleAnalysis(prompt);
  }

  const { baseUrl, apiKey, model } = config.llm;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'glm-4-plus',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT.slice(0, 8000) },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!res.ok) {
      throw new Error(`LLM API 错误: ${res.status}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('[LLM] 调用失败:', error.message);
    return generateSimpleAnalysis(prompt);
  }
}

/**
 * 简化分析（无 LLM 时使用）
 */
function generateSimpleAnalysis(prompt) {
  // 提取论文信息
  const titleMatch = prompt.match(/\*\*标题\*\*:\s*(.+)/);
  const abstractMatch = prompt.match(/\*\*摘要.*?\*\*:\n([\s\S]+?)(?=\n\*\*|$)/);
  
  const title = titleMatch ? titleMatch[1] : '未知标题';
  const abstract = abstractMatch ? abstractMatch[1].trim() : '';
  
  return `
# 📚 科研文献结构拆解

## 论文标题
${title}

## ⚠️ 深度分析说明
当前未配置 LLM API，无法进行完整的科研文献结构拆解。
如需启用完整分析，请在配置文件中添加 LLM 配置：

\`\`\`json
{
  "llm": {
    "enabled": true,
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "your-api-key",
    "model": "gpt-4"
  }
}
\`\`\`

## 简要内容
${abstract.slice(0, 500)}${abstract.length > 500 ? '...' : ''}

## 建议
1. 配置 OpenAI / 智谱 / DeepSeek 等 LLM API
2. 或手动将论文内容发送给 AI 助手进行分析
`;
}

/**
 * 深度分析论文
 */
export async function analyzePaper(paper) {
  console.log(`[分析] 正在深度分析: ${paper.title.slice(0, 50)}...`);
  
  const prompt = generateAnalysisPrompt(paper);
  const analysis = await callLLM(prompt);
  
  return {
    ...paper,
    deepAnalysis: analysis
  };
}

/**
 * 批量分析论文
 */
export async function analyzeAllPapers(papers) {
  const analyzed = [];
  
  for (const paper of papers) {
    try {
      const result = await analyzePaper(paper);
      analyzed.push(result);
      // 避免请求过快
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error(`[分析] 论文分析失败: ${paper.pmid}`);
      analyzed.push(paper);
    }
  }
  
  return analyzed;
}
