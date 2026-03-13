# Papfast

Papfast is an open-source paper subscription tool for PubMed and preprint sources.

It can:
- fetch recent papers from PubMed
- optionally fetch preprints from bioRxiv or medRxiv
- translate titles and abstracts with an LLM
- generate structured analysis
- send email digests to subscribers
- export JSON and Markdown reports

## Public vs Private Usage

This public repository is the open-source template.

Use a separate private repository for real subscriptions, recipients, secrets, and runtime state.

Read [PRIVATE_SETUP.md](./PRIVATE_SETUP.md) before deploying a personal or lab instance.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Create local private config

Create `config/config.local.json` locally. This file is gitignored and should contain your real settings.

Example:

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
    {
      "name": "My Topic",
      "keywords": ["your pubmed query here"],
      "recipients": ["you@example.com"],
      "maxResults": 15,
      "daysBack": 7,
      "fallbackFromYear": 2020,
      "fallbackMaxResults": 10,
      "enabled": true
    }
  ]
}
```

### 3. Detect active subscriptions

```bash
node src/detect-subscriptions.js
```

### 4. Run manually

```bash
node src/index.js
```

## GitHub Actions

Scheduled runs are defined in [`.github/workflows/daily.yml`](./.github/workflows/daily.yml).

Important:
- this public repository should not store personal runtime state
- private deployments should enable `PAPFAST_PERSIST_STATE=true`
- private deployments should keep `data/sent-papers.json` private

## Configuration

The tracked example config lives in [`config/config.json`](./config/config.json).

Real usage should prefer `config/config.local.json`, which overrides the example config when present.

Each module supports:
- `name`
- `keywords`
- `recipients`
- `maxResults`
- `daysBack`
- `fallbackFromYear`
- `fallbackMaxResults`
- `enabled`
- optional `sources`
- optional `preprint`

## Repository Layout

```text
.github/workflows/    GitHub Actions workflow
config/config.json    example config
src/index.js          main pipeline
src/fetch.js          PubMed fetcher
src/fetch-preprint.js preprint fetcher
src/translate.js      translation
src/analyze.js        analysis
src/email.js          email generation and sending
src/report.js         report export
src/sent-papers.js    dedup state management
PRIVATE_SETUP.md      private deployment guide
```

## Privacy Model

Public repository:
- source code
- example config
- docs

Private repository:
- real subscriptions
- real recipients
- SMTP secrets
- API keys
- dedup state
- reports

## License

MIT
