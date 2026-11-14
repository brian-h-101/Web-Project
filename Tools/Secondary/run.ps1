[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('help', 'login', 'verify', 'role-create', 'lambda-package',
        'lambda-create', 'lambda-update', 'lambda-invoke', 'api-create',
        'api-test', 'website-api-test', 'frontend-build', 'frontend-update', 'cloudfront-snapshot',
        'cloudfront-plan', 'cloudfront-update', 'budget-create')]
    [string]$Task = 'help',
    [string]$Name = 'Brian',
    [string]$EventPath,
    [string]$Email
)
$toolsRoot = Split-Path -Parent $PSScriptRoot
$tasks = @{
    'login' = 'Secondary/Login/aws-login.ps1'
    'verify' = 'Secondary/Login/aws-verify.ps1'
    'role-create' = 'Secondary/IAM/create-greeting-role.ps1'
    'lambda-package' = 'Secondary/Lambda/package.ps1'
    'lambda-create' = 'Secondary/Lambda/create.ps1'
    'lambda-update' = 'Primary/Lambda/update.ps1'
    'lambda-invoke' = 'Secondary/Lambda/invoke.ps1'
    'api-create' = 'Secondary/HTTP-API-Endpoint/create.ps1'
    'api-test' = 'Secondary/HTTP-API-Endpoint/test.ps1'
    'website-api-test' = 'Secondary/HTTP-API-Endpoint/test.ps1'
    'frontend-build' = 'Primary/Frontend/build.ps1'
    'frontend-update' = 'Primary/Frontend/update.ps1'
    'cloudfront-snapshot' = 'Secondary/CloudFront/get-config.ps1'
    'cloudfront-plan' = 'Secondary/CloudFront/get-config.ps1'
    'cloudfront-update' = 'Primary/CloudFront/update.ps1'
    'budget-create' = 'Secondary/Budgets/create.ps1'
}
if ($Task -eq 'help') {
    Get-Content -LiteralPath (Join-Path $toolsRoot 'README.txt')
    return
}
$parameters = @{}
if ($WhatIfPreference) { $parameters.WhatIf = $true }
if ($PSBoundParameters.ContainsKey('Confirm')) { $parameters.Confirm = $PSBoundParameters.Confirm }
if ($Task -in @('api-test', 'website-api-test')) { $parameters.Name = $Name }
if ($Task -eq 'website-api-test') { $parameters.ThroughWebsite = $true }
if ($Task -eq 'lambda-invoke' -and $EventPath) { $parameters.EventPath = $EventPath }
if ($Task -eq 'budget-create' -and $Email) { $parameters.Email = $Email }
if ($Task -eq 'cloudfront-plan') { $parameters.PrepareUpdate = $true }
& (Join-Path $toolsRoot $tasks[$Task]) @parameters
