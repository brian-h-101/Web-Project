[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$PrepareUpdate)
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
$snapshotPath = 'Website/Systems/CloudFront/Snapshots/cloudfront-current.json'
$planPath = 'Website/Systems/CloudFront/Updates/cloudfront-update.json'
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Website.DistributionId, 'Fetch and save the CloudFront configuration')) { return }
if ($PrepareUpdate -and (Test-Path -LiteralPath (Get-ProjectPath $planPath))) {
    throw "An editable plan already exists at $planPath. Preserve or move it before preparing another."
}
Assert-ProjectAccount
$snapshot = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'get-distribution-config', '--id', $ProjectConfig.Website.DistributionId
)
if (-not $snapshot.ETag -or -not $snapshot.DistributionConfig) {
    throw 'CloudFront did not return a configuration and ETag.'
}
Write-ProjectJson -Path $snapshotPath -Value $snapshot
if ($PrepareUpdate) {
    $plan = @{
        DistributionId = $ProjectConfig.Website.DistributionId
        ETag = $snapshot.ETag
        DistributionConfig = $snapshot.DistributionConfig
    }
    Write-ProjectJson -Path $planPath -Value $plan
    Write-Host "Editable plan: $(Get-ProjectPath $planPath)"
}
[pscustomobject]@{
    Snapshot = Get-ProjectPath $snapshotPath
    DefaultOrigin = $snapshot.DistributionConfig.DefaultCacheBehavior.TargetOriginId
    Origins = $snapshot.DistributionConfig.Origins
    CacheBehaviors = $snapshot.DistributionConfig.CacheBehaviors
} | ConvertTo-Json -Depth 15
