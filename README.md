# Papfast - 学术论文订阅工具

每日从 PubMed 抓取论文，翻译并邮件推送。

## 部署到 GitHub Actions（免费）

### 步骤 1：创建 GitHub 仓库

1. 在 GitHub 创建新仓库（可以是私有仓库）
2. 推送代码：

```bash
cd D:\2026_project\Papfast
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/Papfast.git
git push -u origin main
```

### 步骤 2：配置 GitHub Secrets

在仓库页面：**Settings → Secrets and variables → Actions → New repository secret**

添加以下 Secrets：

| Secret Name | Value |
|-------------|-------|
| `SMTP_HOST` | `smtp.163.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `xseq_fastfreee@163.com` |
| `SMTP_PASS` | `AFddnCpyYN72kQh5` |
| `LLM_API_KEY` | `3440be3219d04a3aa31f2c10630f58d5.ASToYwQmgd8x0oCC` |
| `EASYSCHOLAR_KEY` | `5b3999c870c042d6a4aacbd6ba13f100` |

### 步骤 3：验证

1. 进入 **Actions** 标签页
2. 选择 **Daily Paper Push**
3. 点击 **Run workflow** 手动测试
4. 检查运行日志

## 本地运行

```bash
npm install
npm start
```

## 模块配置

编辑 `config/config.json` 添加新的订阅模块。

## 定时任务

- GitHub Actions：每天北京时间 7:00 自动执行
- 支持手动触发
