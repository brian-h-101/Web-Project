[CmdletBinding(SupportsShouldProcess = $true)]
param()

. (Join-Path $PSScriptRoot '..\..\Secondary\Shared\Project.ps1')

$functionName = 'exodus-portfolio-frontend-router'
$reportPath = 'Website/Systems/CloudFront/Functions/Results/about-test-result.json'
$livePath = 'Website/Systems/CloudFront/Functions/frontend-router-live.json'
$report = Read-ProjectJson $reportPath

$expectedArn = 'arn:aws:cloudfront::{0}:function/{1}' -f $ProjectConfig.Aws.AccountId, $functionName

if ($report.FunctionName -cne $functionName -or $report.Passed -ne $true -or
    -not $report.ETag -or $report.InputUri -cne '/about' -or
    $report.OutputUri -cne '/index.html' -or
    $report.Response.TestResult.FunctionSummary.FunctionMetadata.FunctionARN -cne $expectedArn) {
    throw 'A passing /about test report for this function and account is required.'
}

if (-not $PSCmdlet.ShouldProcess(
    "$functionName ($($report.ETag))",
    'Publish the tested CloudFront function to LIVE'
)) {
    return
}

Assert-ProjectAccount

$development = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'describe-function', '--name', $functionName,
    '--stage', 'DEVELOPMENT'
)

if ($development.ETag -cne $report.ETag) {
    throw 'The development function changed after testing. Run its test script again.'
}

$published = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'publish-function', '--name', $functionName,
    '--if-match', $report.ETag
)

$metadata = $published.FunctionSummary.FunctionMetadata

if ($metadata.Stage -cne 'LIVE' -or $metadata.FunctionARN -cne $expectedArn) {
    throw 'CloudFront did not return the expected LIVE function.'
}

Write-ProjectJson -Path $livePath -Value $published

[pscustomobject]@{
    Name = $published.FunctionSummary.Name
    Arn = $metadata.FunctionARN
    Stage = $metadata.Stage
    TestedETag = $report.ETag
} | ConvertTo-Json