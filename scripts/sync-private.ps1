param(
  [string]$PublicRemote = 'origin',
  [string]$PrivateRemote = 'private',
  [string]$BaseBranch = 'main',
  [string]$SyncBranch = 'codex/sync-private-auto'
)

$ErrorActionPreference = 'Stop'

function Run-Git([string]$Command) {
  Write-Host "> git $Command" -ForegroundColor Cyan
  & git ($Command -split ' ')
  if ($LASTEXITCODE -ne 0) {
    throw "git $Command failed"
  }
}

function Resolve-KnownConflicts {
  $conflicts = git diff --name-only --diff-filter=U
  if (-not $conflicts) { return }

  $conflictList = $conflicts -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  foreach ($file in $conflictList) {
    switch ($file) {
      'config/config.json' {
        Write-Host "Keeping private version for $file" -ForegroundColor Yellow
        & git checkout --ours -- $file
        & git add $file
      }
      '.github/workflows/daily.yml' {
        Write-Host "Keeping rebased workflow version for $file" -ForegroundColor Yellow
        & git checkout --theirs -- $file
        & git add $file
      }
      '.gitignore' {
        Write-Host "Keeping rebased ignore rules for $file" -ForegroundColor Yellow
        & git checkout --theirs -- $file
        & git add $file
      }
      'data/sent-papers.json' {
        Write-Host "Keeping private state file for $file" -ForegroundColor Yellow
        & git checkout --ours -- $file
        & git add $file
      }
      default {
        throw "Unhandled conflict: $file"
      }
    }
  }
}

$currentBranch = (git branch --show-current).Trim()
if (-not $currentBranch) {
  throw 'Could not determine current branch.'
}

try {
  Run-Git "fetch $PublicRemote"
  Run-Git "fetch $PrivateRemote"

  Run-Git "checkout $BaseBranch"
  Run-Git "reset --hard $PublicRemote/$BaseBranch"
  Run-Git "checkout -B $SyncBranch"

  & git rebase "$PrivateRemote/$BaseBranch"
  if ($LASTEXITCODE -ne 0) {
    Resolve-KnownConflicts
    & git rebase --continue
    if ($LASTEXITCODE -ne 0) {
      throw 'Rebase needs manual resolution.'
    }
  }

  Run-Git "push $PrivateRemote HEAD:$BaseBranch"
  Write-Host 'Private repository is now synced with public code while keeping private config/state.' -ForegroundColor Green
}
finally {
  if ($currentBranch) {
    & git checkout $currentBranch | Out-Null
  }
}
