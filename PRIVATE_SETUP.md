# Private Deployment

This repository is intended to stay public and generic.

For personal or lab use, deploy Papfast from a separate private repository.

## Recommended setup

1. Create a private repository, for example `Papfast-private`
2. Mirror or copy the current code into that private repository
3. Keep your real subscription settings only in `config/config.local.json`
4. Store secrets only in GitHub Actions Secrets
5. In the private repository, create an Actions variable:
   - `PAPFAST_PERSIST_STATE=true`
6. Seed the private repository with `data/sent-papers.json` if you want to preserve dedup history

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

Set these repository secrets in the private repo:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `LLM_API_KEY`
- `EASYSCHOLAR_KEY` (optional)

Set this repository variable in the private repo:

- `PAPFAST_PERSIST_STATE=true`

## Notes

- Without `PAPFAST_PERSIST_STATE=true`, scheduled runs will still send emails, but dedup state will not be committed back to the repository.
- Public repositories should normally leave this variable unset.
