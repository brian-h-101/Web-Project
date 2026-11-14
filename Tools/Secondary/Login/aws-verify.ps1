[CmdletBinding(SupportsShouldProcess = $true)]
param()
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Aws.Profile, 'Verify the AWS account')) { return }
Assert-ProjectAccount
Write-Output "Verified Exodus account $($ProjectConfig.Aws.AccountId)."
