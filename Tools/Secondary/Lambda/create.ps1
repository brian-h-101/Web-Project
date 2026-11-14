[CmdletBinding(SupportsShouldProcess = $true)]
param()
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
. (Join-Path $PSScriptRoot '..\Shared\Lambda.ps1')
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Lambda.Name, 'Create or reuse the Lambda function')) { return }
Assert-ProjectAccount
$functionArn = Get-GreetingFunctionArn
$existing = Invoke-ProjectAws -AllowNotFound -Arguments @(
    'lambda', 'get-function-configuration', '--function-name', $functionArn
)
if ($null -ne $existing) {
    Assert-GreetingFunction $existing
    Write-Output "Reusing $functionArn. Use Tools/Primary/Lambda/update.ps1 to deploy source changes."
    return
}
$package = New-GreetingPackage
$created = Invoke-ProjectAws -Arguments @(
    'lambda', 'create-function', '--function-name', $ProjectConfig.Lambda.Name,
    '--runtime', $ProjectConfig.Lambda.Runtime, '--role', (Get-GreetingRoleArn),
    '--handler', $ProjectConfig.Lambda.Handler, '--zip-file', "fileb://$package",
    '--architectures', 'x86_64', '--timeout', '5', '--memory-size', '128'
)
$null = Invoke-ProjectAws -Arguments @(
    'lambda', 'wait', 'function-active-v2', '--function-name', $functionArn
)
$created | Select-Object FunctionName, FunctionArn, Runtime, Handler
