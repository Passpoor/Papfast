param(
  [string]$PublicRemote = 'origin',
  [string]$PrivateRemote = 'private',
  [string]$BaseBranch = 'main'
)

$ErrorActionPreference = 'Stop'

& git fetch $PublicRemote
if ($LASTEXITCODE -ne 0) { throw 'git fetch public failed' }
& git fetch $PrivateRemote
if ($LASTEXITCODE -ne 0) { throw 'git fetch private failed' }

$behind = (& git rev-list --count "$PrivateRemote/$BaseBranch..$PublicRemote/$BaseBranch").Trim()
$ahead = (& git rev-list --count "$PublicRemote/$BaseBranch..$PrivateRemote/$BaseBranch").Trim()

Write-Output "public_ahead_by=$behind"
Write-Output "private_ahead_by=$ahead"

if ([int]$behind -gt 0) {
  Write-Output 'UPDATE_NEEDED=true'
} else {
  Write-Output 'UPDATE_NEEDED=false'
}
