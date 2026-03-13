# Private Deployment

This repository is intended to stay public and generic.

For personal or lab use, deploy Papfast from a separate private repository.

## Recommended setup

1. Create a private repository, for example `Papfast-private`
2. Mirror or copy the current code into that private repository
3. Keep your real subscription settings only in `config/config.local.json` or in the GitHub secret `PAPFAST_CONFIG_JSON_BASE64`
4. Store secrets only in GitHub Actions Secrets
5. In the private repository, create an Actions variable:
   - `PAPFAST_PERSIST_STATE=true`
6. Seed the private repository with `data/sent-papers.json` if you want to preserve dedup history

## One-click sync from public to private

Use this script locally when public code is updated and you want to sync it into the private repo without overwriting private config/state:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-private.ps1
```

What it does:
- fetches `origin/main` and `private/main`
- resets local `main` to the latest public code
- rebases onto `private/main`
- keeps private versions of:
  - `config/config.json`
  - `data/sent-papers.json`
- keeps updated code/workflow files from public
- pushes the result to `private/main`

If you only want to check whether private is behind public, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-private-sync.ps1
```

If output contains `UPDATE_NEEDED=true`, run the sync script.

## What stays public

- Source code
- Example config in `config/config.json`
- Documentation

## What must stay private

- `config/config.local.json`
- Real recipients
- Real subscription queries
- SMTP credentials
- LLM API keys
- `data/sent-papers.json`
- `data/reports/`

## Private GitHub Actions checklist

Set these repository secrets in the private repo if you do not inject a full config JSON:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `LLM_API_KEY`
- `EASYSCHOLAR_KEY` (optional)

Or set this secret with the generated Base64 config:

- `PAPFAST_CONFIG_JSON_BASE64`

Set this repository variable in the private repo:

- `PAPFAST_PERSIST_STATE=true`

## Notes

- Without `PAPFAST_PERSIST_STATE=true`, scheduled runs will still send emails, but dedup state will not be committed back to the repository.
- Public repositories should normally leave this variable unset.
