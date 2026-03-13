# Papfast

Papfast 是一个用于论文订阅、翻译、分析和邮件推送的开源工具。

它的定位不是“论文数据库”，而是“把你关心的主题，按固定频率自动整理并推送到邮箱”。

支持的核心能力：
- 从 PubMed 抓取最新论文
- 可选抓取 bioRxiv / medRxiv 预印本
- 用 LLM 翻译标题和摘要
- 对论文做结构化分析
- 生成邮件日报
- 导出 JSON / Markdown 报告
- 记录已推送文献，避免重复发送

## 适合谁

适合这几类用户：
- 个人科研用户：想每天自动收到某个主题的新论文
- 课题组 / 团队：想把固定方向的文献自动推送给多人
- 信息整理型用户：想把文献结果进一步接入知识库、自动化流程或报告系统

## 两种使用方式

Papfast 推荐明确区分两种仓库角色。

### 1. Public 仓库

Public 仓库只负责这些内容：
- 开源代码
- 示例配置
- 文档
- 配置工具
- 同步脚本

它不应该存放你的真实订阅条件、真实收件人、真实运行状态。

### 2. Private 仓库

Private 仓库才是你自己的运行实例。

它应该存放：
- 真实订阅模块
- 真实收件人邮箱
- SMTP 凭证
- LLM API 配置
- 已推送状态文件 `data/sent-papers.json`
- 运行时报告

如果你只是想“自己用”，推荐直接从 public 拉代码，然后建立一个 private 仓库作为实际运行仓。

## 最简单的上手路径

如果你是第一次使用，最简单的流程是：

1. 从 public 仓库拉取代码
2. 打开可视化配置页 `tools/config-builder.html`
3. 填写 SMTP、LLM、多模块订阅条件
4. 如果本地运行：下载 `config.local.json`
5. 如果 GitHub 私有运行：复制 Base64 Secret 到 private 仓库
6. 运行一次任务，确认邮件能正常收到

## 可视化配置页

文件位置：
- [tools/config-builder.html](./tools/config-builder.html)

这是当前最推荐的配置方式。

它支持：
- 配置 SMTP
- 配置 LLM
- 添加多个订阅模块
- 每个模块单独设置关键词、收件人、是否启用预印本
- 生成本地 `config.local.json`
- 生成 GitHub Secret 用的 Base64 文本
- 在每个字段旁边提示“这个值去哪找、怎么填”

### 配置页输出的两种结果

#### 1. config.local.json

适用于：
- 本地运行
- 本地测试
- 本机 Windows 计划任务运行

#### 2. Base64 Secret

适用于：
- GitHub private 仓库运行
- 不想把真实配置提交到 git

Secret 名称固定为：
- `PAPFAST_CONFIG_JSON_BASE64`

## 本地运行模式

适合：
- 你想在自己的电脑上跑
- 你希望先调通 SMTP 和 LLM
- 你不想先配置 GitHub Actions

### 步骤 1：安装依赖

```bash
npm install
```

### 步骤 2：打开配置页

直接在浏览器打开：
- [tools/config-builder.html](./tools/config-builder.html)

填写完成后点击：
- `Download config.local.json`

把生成文件放到：
- `config/config.local.json`

说明：
- 这个文件默认不会提交到 git
- 程序运行时会优先读取它

### 步骤 3：检查配置是否被识别

```bash
node src/detect-subscriptions.js
```

如果输出里看到你的真实模块名，而不是“示例模块 A / B / C”，说明配置已经生效。

### 步骤 4：本地运行

```bash
node src/index.js
```

或者：

```bash
npm start
```

### 步骤 5：确认结果

你应该检查：
- 是否成功抓取到论文
- 是否成功调用翻译和分析接口
- 是否成功发送邮件
- 是否生成 `data/sent-papers.json`

## GitHub Private 仓库运行模式

适合：
- 想每天自动定时运行
- 不依赖本机开机
- 想把状态保存在 private 仓库里

### private 仓库需要配置什么

在 private 仓库里，你至少要配置下面两项：

#### Secret

路径：
- `Settings`
- `Secrets and variables`
- `Actions`
- `Secrets`

新增：
- `PAPFAST_CONFIG_JSON_BASE64`

值来源：
- 在配置页里点击 `Copy Base64 Secret`
- 把复制出的整段文本粘贴进去

#### Variable

路径：
- `Settings`
- `Secrets and variables`
- `Actions`
- `Variables`

新增：
- `PAPFAST_PERSIST_STATE`
- 值：`true`

作用：
- 允许 GitHub Actions 在每次运行后把 `data/sent-papers.json` 回写到 private 仓库
- 这是避免重复推送的关键配置之一

### private 仓库当前 workflow 的行为

workflow 文件在：
- [`.github/workflows/daily.yml`](./.github/workflows/daily.yml)

它现在会：
1. 安装 Node 依赖
2. 如果存在 `PAPFAST_CONFIG_JSON_BASE64`，先写出 `config/config.local.json`
3. 运行 Papfast 主流程
4. 如果 `PAPFAST_PERSIST_STATE=true`，把 `data/sent-papers.json` 提交回仓库

### 手动运行一次任务

路径：
- 打开 private 仓库
- 点击 `Actions`
- 选择 `Daily Paper Push`
- 点击 `Run workflow`

### 运行后要看什么

重点看两块：

#### 1. `Run Papfast`

如果这里出错，常见原因有：
- SMTP 授权码错误
- LLM API Key 错误
- 还在跑示例模块，说明真实配置没有注入成功

#### 2. `Persist sent-papers state`

如果这里成功，说明 private 仓库已经开始持久化去重状态。

你还可以去 private 仓库的提交记录里检查是否出现类似提交：
- `chore: persist sent papers state [skip ci]`

## 去重机制现在解决了什么问题

Papfast 现在修复的是“重复推送”和“状态丢失”这一类问题。

### 已修复的问题

#### 1. 定时任务每天重复推送同一批文献

原因通常是：
- 去重状态没有被保存
- 下一次运行时程序不知道哪些论文已经发过

现在通过 `data/sent-papers.json` 持久化解决。

#### 2. 同一篇文献在后续任务中反复出现

程序现在会记录已推送论文，并在后续抓取时过滤。

#### 3. 多模块之间互相影响的去重问题

去重逻辑已经调整，避免不同模块之间不合理地互相吞掉结果。

#### 4. 临时状态文件残留问题

`sent-papers.json.tmp` 的处理也做了修复，减少状态写入异常带来的重复发送风险。

## Public 更新后，如何同步到 Private

这是项目里另一个核心场景。

目标是：
- 让 private 跟上 public 的代码更新
- 但不要覆盖 private 自己的配置和状态文件

### 一键检查 private 是否落后于 public

脚本：
- [scripts/check-private-sync.ps1](./scripts/check-private-sync.ps1)

运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-private-sync.ps1
```

如果输出：

```text
UPDATE_NEEDED=true
```

说明 private 需要同步。

### 一键同步 public 到 private

脚本：
- [scripts/sync-private.ps1](./scripts/sync-private.ps1)

运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-private.ps1
```

这个脚本的设计目标是：
- 更新共享代码
- 尽量保留 private 的配置与状态

它会优先保留 private 里的：
- `config/config.json`
- `data/sent-papers.json`

适用前提：
- 当前仓库 remote 配置中已经存在：
  - `origin` -> public
  - `private` -> private

可以先执行：

```powershell
git remote -v
```

确认当前项目的 remote 指向正确。

## 示例配置和真实配置

项目里跟踪的是示例配置：
- [config/config.json](./config/config.json)

它的作用只是：
- 告诉用户结构长什么样
- 作为 public 仓库模板

真实使用时，推荐不要把真实订阅直接写进 public 仓库的 `config/config.json`。

推荐方案：
- 本地：用 `config/config.local.json`
- private GitHub：用 `PAPFAST_CONFIG_JSON_BASE64`

## 常见问题

### 1. 为什么日志里还在跑“示例模块 A / C”？

说明程序没有拿到你的真实配置。

优先检查：
- 本地是否真的存在 `config/config.local.json`
- private 仓库里是否已经设置 `PAPFAST_CONFIG_JSON_BASE64`
- Base64 是否是从最新配置页生成的

### 2. 为什么邮件发送失败，提示 `535 authentication failed`？

说明 SMTP 凭证不对。

通常需要检查：
- 你填的是不是邮箱授权码，而不是登录密码
- SMTP Host / Port / Secure 是否和邮箱服务商一致
- 发件人邮箱是否与 SMTP 用户匹配

### 3. 为什么 LLM 返回 `401`？

说明 LLM Key 无效，或者 Base URL / Model 配置不匹配。

### 4. 为什么 private 同步脚本失败？

常见原因：
- 当前工作区还有未提交改动
- 当前不在正确项目目录下
- `origin` / `private` remote 没配好
- 本机没有 private 仓库权限

### 5. Public 仓库里会不会暴露真实订阅？

按当前推荐用法不会。

正确做法是：
- public 只保留模板配置和代码
- private 才保存真实配置和运行状态

## 目录结构

```text
.github/workflows/              GitHub Actions workflow
config/config.json              示例配置
src/index.js                    主流程入口
src/fetch.js                    PubMed 抓取
src/fetch-preprint.js           预印本抓取
src/translate.js                翻译
src/analyze.js                  分析
src/email.js                    邮件生成与发送
src/report.js                   报告导出
src/sent-papers.js              去重状态管理
tools/config-builder.html       可视化配置页
scripts/check-private-sync.ps1  检查 private 是否落后于 public
scripts/sync-private.ps1        把 public 安全同步到 private
PRIVATE_SETUP.md                private 部署说明
```

## 推荐使用顺序

如果你是第一次使用，推荐按下面顺序：

### 本地用户
1. 打开 `tools/config-builder.html`
2. 填写配置
3. 下载 `config.local.json`
4. 本地运行测试
5. 确认邮件能发

### GitHub private 用户
1. 打开 `tools/config-builder.html`
2. 填写配置
3. 复制 Base64 Secret
4. 在 private 仓库设置 `PAPFAST_CONFIG_JSON_BASE64`
5. 设置 `PAPFAST_PERSIST_STATE=true`
6. 手动运行一次 workflow
7. 检查邮件发送和去重状态提交是否正常

## License

MIT
