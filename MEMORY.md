# Papfast 项目记忆

## 项目概述
学术论文订阅工具，每日从 PubMed 抓取论文，翻译并邮件推送。

## 2026-02-22 更新

### 已推送论文去重机制
- 新增 `src/sent-papers.js` 管理已推送论文记录
- 记录存储在 `data/sent-papers.json`
- 回退搜索时自动过滤已推送的 PMID
- 默认保留 30 天记录，自动清理过期数据
- 解决了连续多天无新论文时重复推送相同论文的问题

## 2026-02-21 更新

### 邮件回退模式说明
- 当近7天无新论文时，邮件标题改为 `📚 论文精选`
- 摘要显示: "近 7 天无新论文，已从 2020 年以来的文献中精选 X 篇高质量论文"
- 修改文件: `src/email.js`, `src/index.js`

### 翻译功能升级
- 从 MyMemory API 改为 **智谱 GLM-4-Plus** 翻译
- 无字符限制，专业学术术语，质量更高
- 文件：`src/translate.js`

### 回退机制
- 肺泡巨噬细胞模块：7天无新论文 → 自动搜索 2020 年以来文献
- 最多 10 篇，按日期倒序

### 模块状态
- 肺泡巨噬细胞：启用，收件人 persist2021@163.com
- 抗体偶联药物与肺癌：**已禁用** (`enabled: false`)

## Critical Context

- **项目路径**: `D:\2026_project\Papfast`
- **项目结构**:
  ```
  Papfast/
  ├── config/config.json      # 配置文件（邮箱、LLM、模块配置）
  ├── src/
  │   ├── index.js            # 主程序
  │   ├── fetch.js            # PubMed 抓取 + 回退机制
  │   ├── translate.js        # GLM 翻译
  │   ├── analyze.js          # LLM 深度分析
  │   ├── email.js            # 邮件发送
  │   └── wechat-style.js     # 公众号风格格式化
  ├── setup-schedule.ps1      # 定时任务脚本
  └── memory/
  ```
- **邮箱配置**:
  - 发件: xseq_fastfreee@163.com
  - 授权码: AFddnCpyYN72kQh5
- **LLM配置**: 智谱 GLM-4-Plus
- **定时任务**: Windows Task Scheduler "Papfast-Daily"，每天 7:00 AM

## 定时任务管理命令

- 查看: `Get-ScheduledTask -TaskName 'Papfast-Daily'`
- 手动运行: `Start-ScheduledTask -TaskName 'Papfast-Daily'`
- 禁用: `Disable-ScheduledTask -TaskName 'Papfast-Daily'`
- 删除: `Unregister-ScheduledTask -TaskName 'Papfast-Daily'`
