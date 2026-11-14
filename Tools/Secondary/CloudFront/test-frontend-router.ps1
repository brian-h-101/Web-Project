[CmdletBinding(SupportsShouldProcess = $true)]
param()

. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')

$functionName = 'exodus-portfolio-frontend-router'
$eventPath = Get-ProjectPath 'Website/Systems/CloudFront/Functions/Events/about-request.json'
$reportPath = 'Website/Systems/CloudFront/Functions/Results/about-test-result.json'
$event = Read-ProjectJson $eventPath

if ($event.request.method -cne 'GET' -or $event.request.uri -cne '/about') {
    throw 'This test expects a GET /about event.'
}

if (-not $PSCmdlet.ShouldProcess($functionName, 'Test GET /about in DEVELOPMENT')) {
    return
}

Assert-ProjectAccount

$development = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'describe-function', '--name', $functionName,
    '--stage', 'DEVELOPMENT'
)
if (-not $development.ETag) {
    throw 'CloudFront did not return the development function ETag.'
}

$response = Invoke-ProjectAws -Arguments @(
    'cloudfront', 'test-function', '--name', $functionName,
    '--stage', 'DEVELOPMENT', '--if-match', $development.ETag,
    '--event-object', "fileb://$eventPath"
)

$result = $response.TestResult
if ($result.FunctionErrorMessage) {
    throw "Function execution failed: $($result.FunctionErrorMessage)"
}
if (-not $result.FunctionOutput) {
    throw 'CloudFront returned no function output.'
}

$decoded = $result.FunctionOutput | ConvertFrom-Json
$returnedRequest = if ($decoded.request) { $decoded.request } else { $decoded }

if ($returnedRequest.method -cne 'GET' -or $returnedRequest.uri -cne '/index.html') {
    throw 'The function did not return GET /index.html.'
}

$report = [pscustomobject]@{
    FunctionName = $functionName
    ETag = $development.ETag
    InputUri = $event.request.uri
    OutputUri = $returnedRequest.uri
    Passed = $true
    Response = $response
}
Write-ProjectJson -Path $reportPath -Value $report

$report | Select-Object FunctionName, InputUri, OutputUri, Passed, ETag |
    ConvertTo-Json