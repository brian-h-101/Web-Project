[CmdletBinding(SupportsShouldProcess = $true)]
param()
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
. (Join-Path $PSScriptRoot '..\Shared\Lambda.ps1')
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Lambda.Package, 'Build the greeting ZIP locally')) { return }
New-GreetingPackage
