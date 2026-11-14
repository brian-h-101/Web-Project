[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$PlanPath = 'Website/Systems/CloudFront/Updates/cloudfront-update.json')
. (Join-Path $PSScriptRoot '..\..\Secondary\Shared\Project.ps1')
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Website.DistributionId, "Apply CloudFront plan $PlanPath")) { return }
$plan = Read-ProjectJson $PlanPath
if ($plan.DistributionId -ne $ProjectConfig.Website.DistributionId -or
    -not $plan.ETag -or -not $plan.DistributionConfig.CallerReference) {
    throw 'The plan must contain the configured distribution ID, ETag, and full DistributionConfig.'
}
Assert-ProjectAccount
$current = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'get-distribution-config', '--id', $plan.DistributionId
)
if ($current.ETag -ne $plan.ETag -or
    $current.DistributionConfig.CallerReference -ne $plan.DistributionConfig.CallerReference) {
    throw 'The CloudFront plan is stale or targets a different configuration. Fetch and review a fresh plan.'
}
$requestPath = 'Website/Systems/CloudFront/Updates/cloudfront-request.json'
Write-ProjectJson -Path $requestPath -Value $plan.DistributionConfig
$null = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'update-distribution', '--id', $plan.DistributionId,
    '--if-match', $plan.ETag, '--distribution-config', "file://$(Get-ProjectPath $requestPath)"
)
$null = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'wait', 'distribution-deployed', '--id', $plan.DistributionId
)
Invoke-ProjectAws -Arguments @('cloudfront', 'get-distribution', '--id', $plan.DistributionId) |
    Select-Object -ExpandProperty Distribution |
    Select-Object Id, DomainName, Status
