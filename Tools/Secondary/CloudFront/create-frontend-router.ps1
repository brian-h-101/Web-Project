[CmdletBinding(SupportsShouldProcess = $true)]
param()

. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')

$functionName = 'exodus-portfolio-frontend-router'
$codePath = Get-ProjectPath 'Website/Backend/CloudFront/frontend-router.js'
$configPath = Get-ProjectPath 'Website/Systems/CloudFront/Functions/frontend-router-config.json'
$statePath = 'Website/Systems/CloudFront/Functions/frontend-router-development.json'

foreach ($path in @($codePath, $configPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file is missing: $path"
    }
}

if (-not $PSCmdlet.ShouldProcess($functionName, 'Create CloudFront function in DEVELOPMENT')) {
    return
}

Assert-ProjectAccount

$state = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'create-function',
    '--name', $functionName,
    '--function-config', "file://$configPath",
    '--function-code', "fileb://$codePath"
)

if (-not $state.ETag -or -not $state.FunctionSummary.FunctionMetadata.FunctionARN) {
    throw 'CloudFront did not return a function ARN and ETag.'
}

Write-ProjectJson -Path $statePath -Value $state

[pscustomobject]@{
    Name = $state.FunctionSummary.Name
    Arn = $state.FunctionSummary.FunctionMetadata.FunctionARN
    Stage = $state.FunctionSummary.FunctionMetadata.Stage
    ETag = $state.ETag
} | ConvertTo-Json