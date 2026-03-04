# Papfast - 学术论文订阅工具

每日自动从 PubMed 抓取高质量论文，使用 LLM 进行深度分析翻译，以公众号风格邮件推送。

## 功能特点

- 🔍 **智能检索**：基于关键词和高质量期刊列表筛选论文
- 🌐 **自动翻译**：使用智谱 GLM-4-Plus 进行学术翻译
- 📊 **深度分析**：LLM 驱动的"标题摘要预判系统"
- 📧 **邮件推送**：公众号风格排版，支持多收件人
- ⏰ **定时执行**：GitHub Actions 云端自动运行，无需本地设备
- 🔄 **回退机制**：无新论文时自动搜索历史高质量文献
 - 🗂️ **报告导出**：每个模块每日自动生成 JSON 和 Markdown 报告，方便二次分析与对接其他系统

## 部署方式

### GitHub Actions（推荐）

1. **Fork 或克隆本仓库**

2. **配置 GitHub Secrets**

   在 `Settings → Secrets and variables → Actions` 中添加：

   | Secret | 说明 |
   |--------|------|
   | `SMTP_HOST` | SMTP 服务器地址 |
   | `SMTP_PORT` | SMTP 端口 |
   | `SMTP_USER` | 发件邮箱 |
   | `SMTP_PASS` | 邮箱授权码 |
   | `LLM_API_KEY` | LLM API 密钥 |
   | `EASYSCHOLAR_KEY` | easyScholar API 密钥（可选） |

3. **启用 Workflow**

   - 进入 Actions 页面
   - 启用 `Daily Paper Push` workflow
   - 可手动触发测试

4. **自动执行**

   - 每天北京时间 7:00 自动运行
   - 无需任何设备开机

### 本地运行

```bash
# 安装依赖
npm install

# 配置 config/config.json（参考 config.local.json 模板）

# 运行
npm start
```

## 模块配置

编辑 `config/config.json` 添加订阅模块：

```json
{
  "name": "模块名称",
  "keywords": ["PubMed 检索关键词"],
  "recipients": ["收件人邮箱"],
  "maxResults": 15,
  "daysBack": 7,
  "fallbackFromYear": 2020,
  "fallbackMaxResults": 10,
  "enabled": true
}
```

### 配置说明

| 字段 | 说明 |
|------|------|
| `keywords` | PubMed 检索语法，支持多个关键词 |
| `recipients` | 收件人邮箱列表 |
| `maxResults` | 最大返回论文数 |
| `daysBack` | 搜索最近 N 天的论文 |
| `fallbackFromYear` | 无新论文时回退搜索起始年份 |
| `fallbackMaxResults` | 回退模式最大返回数 |
| `enabled` | 是否启用（默认 true） |

## 示例模块（自行替换为你的主题）

> 出于隐私考虑，本仓库不再展示任何真实订阅主题。下面只是示例配置，实际使用时请根据自己的研究方向修改。

| 模块 | 状态 | 说明 |
|------|------|------|
| 免疫学高影响因子期刊 | ✅ 启用 | 订阅免疫学领域顶级期刊的最新研究 |
| 呼吸系统综述排除例 | ✅ 启用 | 示例：使用复杂 PubMed 语法进行排除检索 |
| 某专项主题备选 | ❌ 禁用 | 示例：暂时关闭的备选主题模块 |

## 论文分析系统

采用"科研论文标题摘要预判系统"进行深度分析：

1. **标题因果强度预判** - 评估标题中的因果关系强度
2. **核心命题提取** - 提取论文核心研究问题
3. **摘要数据类型分类** - 识别实验数据类型
4. **因果等级预判** - 评估证据支持的因果等级
5. **证据需求清单** - 列出验证核心结论所需证据
6. **逻辑断点预警** - 识别推理链条中的潜在缺陷
7. **贝叶斯阅读建议** - 提供阅读前的先验概率调整
8. **深读优先级** - 推荐是否值得深入阅读

## 技术栈

- **运行时**：Node.js 20+
- **数据源**：NCBI PubMed E-utilities API
- **翻译/分析**：智谱 GLM-4-Plus
- **期刊信息**：easyScholar API
- **邮件服务**：Nodemailer
- **定时任务**：GitHub Actions

## 目录结构

```
Papfast/
├── .github/workflows/
│   └── daily.yml          # GitHub Actions 配置
├── config/
│   └── config.json        # 模块配置（环境变量占位符）
├── src/
│   ├── index.js           # 主程序入口
│   ├── fetch.js           # PubMed 数据抓取
│   ├── fetch-preprint.js  # 预印本抓取 (bioRxiv / medRxiv)
│   ├── translate.js       # 论文翻译
│   ├── analyze.js         # LLM 深度分析
│   ├── email.js           # 邮件发送
│   ├── wechat-style.js    # 公众号风格格式化
│   ├── journal-rank.js    # 期刊等级查询
│   ├── report.js          # JSON / Markdown 报告导出
│   └── prompts/
│       └── literature-analysis.js  # 分析提示词
├── data/
│   ├── sent-papers.json   # 已推送论文记录（去重使用）
│   └── reports/           # 每日导出的 JSON / Markdown 报告
├── memory/                # 项目记忆（可选）
├── package.json
└── README.md
```

### 报告导出说明

- 每次模块成功生成推送列表后，会在 `data/reports/` 下生成两类文件：
  - `YYYY-MM-DD__<module>.json`：结构化结果（包括标题、翻译、期刊信息、深度分析等），适合程序消费
  - `YYYY-MM-DD__<module>.md`：人类可读的 Markdown 日报，便于复盘或同步到知识库
- 文件名中的 `<module>` 由模块名称转换而来（空格与特殊字符会被标准化处理）。

## 费用说明

- **GitHub Actions**：私有仓库 2000 分钟/月（本项目约用 60 分钟/月）
- **PubMed API**：免费
- **智谱 GLM**：按量计费
- **easyScholar**：免费额度

## 常见问题

### 如何添加新收件人？

修改 `config/config.json` 中对应模块的 `recipients` 数组，然后推送代码。

### 如何添加新主题模块？

在 `config/config.json` 的 `modules` 数组中添加新对象，包含 `name`、`keywords`、`recipients` 等字段。

### 论文分析失败怎么办？

检查 `LLM_API_KEY` 是否正确配置，API 额度是否充足。系统会在 LLM 不可用时发送简化版邮件。

### 如何修改执行时间？

编辑 `.github/workflows/daily.yml` 中的 cron 表达式：
```yaml
schedule:
  - cron: '0 23 * * *'  # UTC 23:00 = 北京时间 7:00
```

## License

MIT
