# Papfast - 学术论文订阅工具

开发者：上海交通大学药学院 - 乔宇（Yu Qiao; Shanghai Jiaotong University），联系方式：xseq_fastfreee@163.com

每天自动从 PubMed（可选预印本源）抓取论文，使用 LLM 进行翻译与结构化分析，并以“公众号风格”邮件推送给指定收件人。

---

## 功能概览

- 🔍 **智能检索**：支持复杂 PubMed 检索语法，自定义关键词和时间范围。
- 🌐 **自动翻译**：通过 LLM 将标题/摘要翻译成中文，保留医学术语。
- 📊 **深度分析**：内置“科研论文标题摘要预判系统”，输出结构化分析结果。
- 📧 **邮件推送**：生成微信公众号风格 HTML 邮件，可配置多收件人。
- ⏰ **定时执行**：
  - GitHub Actions 定时任务（云端自动跑，不依赖本地开机）
  - 或本地 Windows 计划任务（`setup-schedule.ps1`）
- 🔄 **去重与回退机制**：
  - 使用本地 `data/sent-papers.json` 记录已推送论文，按 PMID/DOI 去重
  - 近几天无新文时自动回退搜索“自某年起”的高质量历史文献
- 🗂️ **报告导出**：每次运行为每个模块生成 JSON 和 Markdown 报告，方便二次分析与接入其他系统。

---

## 快速开始（GitHub Actions，推荐）

### 1. Fork 本仓库

- 在 GitHub 上点击 `Fork`，创建你自己的副本（建议为 **私有仓库**，以保护你的订阅主题与运行数据）。

### 2. 配置 Secrets

在你的仓库中进入：`Settings → Secrets and variables → Actions → New repository secret`，添加：

| Secret            | 说明                       |
|-------------------|----------------------------|
| `SMTP_HOST`       | SMTP 服务器地址           |
| `SMTP_PORT`       | SMTP 端口（如 `465`）     |
| `SMTP_USER`       | 发件邮箱                   |
| `SMTP_PASS`       | 邮箱授权码                 |
| `LLM_API_KEY`     | LLM API 密钥              |
| `EASYSCHOLAR_KEY` | easyScholar API 密钥（可选，不配就不查期刊等级） |

GitHub Actions 会在运行时将这些值注入环境变量，代码通过 `config/config.json` 中的占位符（`${LLM_API_KEY}` 等）读取。

### 3. 配置订阅模块

打开你仓库中的 `config/config.json`，按你的研究主题修改 `modules` 数组，例如：

```json
{
  "name": "模块名称",
  "keywords": ["your pubmed search string here"],
  "recipients": ["example1@example.com"],
  "maxResults": 15,
  "daysBack": 7,
  "fallbackFromYear": 2020,
  "fallbackMaxResults": 10,
  "enabled": true
}
```

### 4. 启用并测试 Workflow

- 在仓库页点击 `Actions`；
- 找到 `Daily Paper Push` workflow，点击“Enable”；
- 右上角点击 `Run workflow` 手动运行一遍：
  - 检查 Actions 日志是否无报错；
  - 检查收件箱是否收到测试日报邮件。

> 默认定时执行时间在 `.github/workflows/daily.yml` 中配置为：  
> `0 23 * * *`（UTC 23:00 ≈ 北京时间 7:00）。可按需修改。

---

## 本地运行（调试与自用）

### 1. 安装依赖

```bash
npm install
```

### 2. 准备本地配置（不会被提交）

`config/config.local.json` 已加入 `.gitignore`，你可以在本地创建它，写入 **真实邮箱与 Key**，例如：

```json
{
  "email": {
    "smtp": {
      "host": "smtp.example.com",
      "port": 465,
      "secure": true,
      "user": "your_email@example.com",
      "pass": "your_smtp_password"
    },
    "from": "your_email@example.com"
  },
  "llm": {
    "enabled": true,
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "apiKey": "your-llm-api-key",
    "model": "glm-4-plus"
  },
  "modules": [
    // 与 config.json 结构相同，可为本地测试单独配置
  ]
}
```

代码会优先加载 `config.local.json`；若不存在，则回退到 `config.json`。

### 3. 手动运行

```bash
npm start
```

如需在 Windows 上每天定时跑，可使用 `setup-schedule.ps1` 创建计划任务，该脚本会创建一个名为 `Papfast-Daily` 的任务，每天早上 7 点执行 `node src/index.js`。

---

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
