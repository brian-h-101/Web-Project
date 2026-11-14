[CmdletBinding(SupportsShouldProcess = $true)]
param()
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Aws.Profile, 'Sign in to AWS and verify the account')) { return }
& aws login --profile $ProjectConfig.Aws.Profile --region $ProjectConfig.Aws.Region
if ($LASTEXITCODE -ne 0) { throw 'AWS login did not complete successfully.' }
Assert-ProjectAccount
Write-Output "Authenticated Exodus account $($ProjectConfig.Aws.AccountId)."
