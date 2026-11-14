[CmdletBinding(SupportsShouldProcess = $true)]
param()
. (Join-Path $PSScriptRoot '..\..\Secondary\Shared\Project.ps1')
. (Join-Path $PSScriptRoot '..\..\Secondary\Shared\Lambda.ps1')
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Lambda.Name, 'Package and deploy the Lambda code')) { return }
Assert-ProjectAccount
$functionArn = Get-GreetingFunctionArn
$existing = Invoke-ProjectAws -Arguments @(
    'lambda', 'get-function-configuration', '--function-name', $functionArn
)
Assert-GreetingFunction $existing
$package = New-GreetingPackage
$null = Invoke-ProjectAws -Arguments @(
    'lambda', 'update-function-code', '--function-name', $functionArn,
    '--zip-file', "fileb://$package"
)
$null = Invoke-ProjectAws -Arguments @(
    'lambda', 'wait', 'function-updated-v2', '--function-name', $functionArn
)
Invoke-ProjectAws -Arguments @(
    'lambda', 'get-function-configuration', '--function-name', $functionArn
) | Select-Object FunctionName, FunctionArn, Runtime, Handler, LastUpdateStatus
