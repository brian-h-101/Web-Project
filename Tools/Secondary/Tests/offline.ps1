[CmdletBinding()]
param([switch]$InternalWorker)
$ErrorActionPreference = 'Stop'
if (-not $InternalWorker) {
    # A direct invocation from VS Code must not leave fake commands in the terminal.
    $enginePath = (Get-Process -Id $PID).Path
    & $enginePath -NoProfile -File $PSCommandPath -InternalWorker
    if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed in the isolated worker.' }
    return
}
$OfflineWorkerActive = $true
$sourceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$testRoot = Join-Path $temporaryBase ('Exodus-offline-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$passed = 0
function Assert-Offline {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "FAILED: $Message" }
    $script:passed++
}
function Assert-OfflineThrows {
    param([scriptblock]$Action, [string]$Pattern)
    $caught = $false
    try { & $Action | Out-Null } catch {
        if ($_.Exception.Message -notmatch $Pattern) { throw }
        $caught = $true
    }
    Assert-Offline $caught "Expected error matching $Pattern"
}
try {
    # Isolate generated ZIPs, payloads, snapshots, and plans from the real project.
    Copy-Item -LiteralPath (Join-Path $sourceRoot 'Tools') -Destination (Join-Path $testRoot 'Tools') -Recurse
    $config = Get-Content -LiteralPath (Join-Path $sourceRoot 'Website\Systems\Configuration\project.json') -Raw | ConvertFrom-Json
    $files = @(
        'Website/Systems/Configuration/project.json', 'Website/Frontend/index.html',
        'Website/Frontend/package.json', 'Website/Frontend/dist/index.html',
        'Website/Systems/CloudFront/cloudfront-distribution.json',
        'Website/Backend/CloudFront/frontend-router.js',
        'Website/Systems/CloudFront/Functions/frontend-router-config.json',
        'Website/Systems/CloudFront/Functions/Events/about-request.json',
        'Website/Systems/CloudFront/Functions/Results/about-test-result.json',
        $config.Lambda.Source, $config.Lambda.Event, $config.Lambda.TrustPolicy, $config.HttpApi.State
    )
    foreach ($relativeFile in $files) {
        $destination = Join-Path $testRoot $relativeFile
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $sourceRoot $relativeFile) -Destination $destination
    }
    . (Join-Path $testRoot 'Tools\Secondary\Shared\Project.ps1')
    . (Join-Path $testRoot 'Tools\Secondary\Tests\Fakes.ps1')
    Reset-OfflineState
    $state = $global:OfflineAwsState
    Assert-Offline ((Get-Command aws).CommandType -eq 'Function') 'AWS must be replaced by the offline fake.'

    $scripts = @(Get-ChildItem -LiteralPath (Join-Path $testRoot 'Tools') -Filter '*.ps1' -Recurse -File)
    foreach ($scriptFile in $scripts) {
        $tokens = $null; $errors = $null
        $null = [System.Management.Automation.Language.Parser]::ParseFile($scriptFile.FullName, [ref]$tokens, [ref]$errors)
        Assert-Offline ($errors.Count -eq 0) "Syntax: $($scriptFile.Name)"
    }
    $tasks = @('login', 'verify', 'role-create', 'lambda-package', 'lambda-create',
        'lambda-update', 'lambda-invoke', 'api-create', 'api-test', 'website-api-test',
        'frontend-build', 'frontend-update', 'cloudfront-snapshot', 'cloudfront-plan', 'cloudfront-update', 'budget-create')
    foreach ($task in $tasks) { & (Join-Path $testRoot 'Tools\Secondary\run.ps1') -Task $task -WhatIf | Out-Null }
    foreach ($relative in @(
        'Tools/Secondary/CloudFront/create-frontend-router.ps1',
        'Tools/Secondary/CloudFront/test-frontend-router.ps1',
        'Tools/Primary/CloudFront/publish-frontend-router.ps1'
    )) { & (Join-Path $testRoot $relative) -WhatIf | Out-Null }
    Assert-Offline ($state.Calls.Count -eq 0 -and $state.HttpCalls -eq 0 -and $state.NpmCalls.Count -eq 0) 'WhatIf must make zero AWS/HTTP/npm calls.'

    $buildScript = Join-Path $testRoot 'Tools\Primary\Frontend\build.ps1'
    $callerDirectory = (Get-Location).Path
    & $buildScript | Out-Null
    Assert-Offline ($state.NpmCalls[0] -eq 'run build' -and $state.NpmLocations[0] -eq (Get-ProjectPath 'Website/Frontend')) 'Build uses npm in the frontend package.'
    Assert-Offline ((Get-Location).Path -eq $callerDirectory -and $state.Calls.Count -eq 0) 'A local build restores the terminal directory and makes no AWS calls.'
    $state.BuildExitCode = 1
    Assert-OfflineThrows { & $buildScript } 'React build failed'
    Assert-Offline ((Get-Location).Path -eq $callerDirectory) 'A failed build also restores the terminal directory.'
    $state.BuildExitCode = 0

    $apiScript = Join-Path $testRoot 'Tools\Secondary\HTTP-API-Endpoint\create.ps1'
    & $apiScript | Out-Null
    Assert-Offline ($state.Writes.Count -eq 5) 'First API setup creates exactly five missing components.'
    Assert-Offline ($state.HttpCalls -eq 2) 'First publication 404 is retried.'
    $writeCount = $state.Writes.Count
    & $apiScript | Out-Null
    Assert-Offline ($state.Writes.Count -eq $writeCount) 'Second API setup makes no resource mutations.'
    $originalUri = $state.Integration.IntegrationUri
    $state.Integration.IntegrationUri = 'arn:aws:apigateway:{0}:lambda:path/2015-03-31/functions/{1}/invocations' -f
        $ProjectConfig.Aws.Region, $originalUri
    & $apiScript | Out-Null
    Assert-Offline ($state.Writes.Count -eq $writeCount) 'The Lambda invocation URI representation is also reused.'
    $state.Integration.IntegrationUri = $originalUri
    $state.Route.Target = 'integrations/unexpected'
    Assert-OfflineThrows { & $apiScript } 'different target'
    $state.Route.Target = 'integrations/offline-integration'
    $state.Api = @($state.Api, $state.Api)
    Assert-OfflineThrows { & $apiScript } 'Multiple APIs'
    $state.Api = $state.Api[0]
    $state.Account = '946298554502'
    Assert-OfflineThrows { & $apiScript } 'Expected Exodus account'
    Assert-Offline ($state.Writes.Count -eq $writeCount) 'Conflicts and wrong account must not mutate AWS.'
    $state.Account = $ProjectConfig.Aws.AccountId

    $state.ErrorCommand = 'lambda get-policy'; $state.ErrorMessage = '(ExpiredTokenException) session expired'
    Assert-OfflineThrows {
        Invoke-ProjectAws -AllowNotFound -Arguments @('lambda', 'get-policy', '--function-name', (Get-GreetingFunctionArn))
    } 'session expired'
    $state.ErrorMessage = '(AccessDeniedException) denied'
    Assert-OfflineThrows {
        Invoke-ProjectAws -AllowNotFound -Arguments @('lambda', 'get-policy', '--function-name', (Get-GreetingFunctionArn))
    } 'denied'
    $state.ErrorCommand = ''
    $state.HttpStatus = 500
    $beforeHttp = $state.HttpCalls
    Assert-OfflineThrows { Wait-GreetingEndpoint -Uri 'https://offline.test/api/greeting' } 'Offline HTTP 500'
    Assert-Offline ($state.HttpCalls -eq $beforeHttp + 1) 'HTTP 500 must surface without publication retries.'
    $state.HttpStatus = 200
    $state.Pending404 = 100
    $beforeHttp = $state.HttpCalls
    Assert-OfflineThrows { Wait-GreetingEndpoint -Uri 'https://offline.test/api/greeting' -Attempts 3 } 'Offline HTTP 404'
    Assert-Offline ($state.HttpCalls -eq $beforeHttp + 3) 'Publication retries have a fixed limit.'
    $state.Pending404 = 0

    & (Join-Path $testRoot 'Tools\Secondary\IAM\create-greeting-role.ps1') | Out-Null
    $writeCount = $state.Writes.Count
    & (Join-Path $testRoot 'Tools\Secondary\IAM\create-greeting-role.ps1') | Out-Null
    Assert-Offline ($state.Writes.Count -eq $writeCount) 'Existing IAM role and logging policy are reused.'
    $state.FunctionExists = $false
    & (Join-Path $testRoot 'Tools\Secondary\Lambda\create.ps1') | Out-Null
    $writeCount = $state.Writes.Count
    & (Join-Path $testRoot 'Tools\Secondary\Lambda\create.ps1') | Out-Null
    Assert-Offline ($state.Writes.Count -eq $writeCount) 'Existing Lambda is reused.'
    & (Join-Path $testRoot 'Tools\Primary\Lambda\update.ps1') | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead((Get-ProjectPath $ProjectConfig.Lambda.Package))
    try {
        Assert-Offline ($zip.Entries.Count -eq 1 -and $zip.Entries[0].FullName -eq 'lambda_function.py') 'ZIP handler is at its root.'
    } finally { $zip.Dispose() }
    $result = & (Join-Path $testRoot 'Tools\Secondary\Lambda\invoke.ps1') | ConvertFrom-Json
    Assert-Offline ($result.Result.message -eq 'Hello, Brian!') 'Nested CLI event returns the greeting.'
    $state.FunctionError = $true
    Assert-OfflineThrows { & (Join-Path $testRoot 'Tools\Secondary\Lambda\invoke.ps1') } 'function error|reported Unhandled'
    $state.FunctionError = $false
    & (Join-Path $testRoot 'Tools\Secondary\HTTP-API-Endpoint\test.ps1') -Name ' Alice ' | Out-Null
    & (Join-Path $testRoot 'Tools\Primary\Frontend\update.ps1') | Out-Null

    & (Join-Path $testRoot 'Tools\Secondary\CloudFront\create-frontend-router.ps1') | Out-Null
    $routerTestScript = Join-Path $testRoot 'Tools\Secondary\CloudFront\test-frontend-router.ps1'
    $routerPublishScript = Join-Path $testRoot 'Tools\Primary\CloudFront\publish-frontend-router.ps1'
    $routerResult = & $routerTestScript | ConvertFrom-Json
    Assert-Offline ($routerResult.Passed -and $routerResult.OutputUri -eq '/index.html') 'Moved router test validates the rewrite.'
    $state.RouterWrongUri = $true
    Assert-OfflineThrows { & $routerTestScript } 'did not return GET /index.html'
    $state.RouterWrongUri = $false
    $state.RouterError = 'Offline router execution error'
    Assert-OfflineThrows { & $routerTestScript } 'Function execution failed'
    $state.RouterError = ''
    $writeCount = $state.Writes.Count
    $state.RouterETag = 'offline-router-2'
    Assert-OfflineThrows { & $routerPublishScript } 'changed after testing'
    Assert-Offline ($state.Writes.Count -eq $writeCount) 'A stale router test blocks publication.'
    $state.RouterETag = 'offline-router-1'
    $published = & $routerPublishScript | ConvertFrom-Json
    Assert-Offline ($published.Stage -eq 'LIVE') 'Moved publish script saves LIVE metadata.'

    & (Join-Path $testRoot 'Tools\Secondary\Budgets\create.ps1') -Email 'offline@example.com' | Out-Null
    $budgetRequest = Read-ProjectJson 'Website/Systems/Budgets/monthly-budget-request.json'
    Assert-Offline (($budgetRequest.NotificationsWithSubscribers.Notification.Threshold -join ',') -eq '80,100') 'Budget alerts are 80% and 100%.'
    $writeCount = $state.Writes.Count
    & (Join-Path $testRoot 'Tools\Secondary\Budgets\create.ps1') | Out-Null
    Assert-Offline ($state.Writes.Count -eq $writeCount) 'Existing matching budget is reused.'

    $state.CloudFrontConfig = Read-ProjectJson 'Website/Systems/CloudFront/cloudfront-distribution.json'
    & (Join-Path $testRoot 'Tools\Secondary\CloudFront\get-config.ps1') -PrepareUpdate | Out-Null
    & (Join-Path $testRoot 'Tools\Primary\CloudFront\update.ps1') | Out-Null
    $writeCount = $state.Writes.Count
    Assert-OfflineThrows { & (Join-Path $testRoot 'Tools\Primary\CloudFront\update.ps1') } 'stale'
    Assert-Offline ($state.Writes.Count -eq $writeCount) 'Stale CloudFront plans are rejected before update.'
    Assert-OfflineThrows { Get-ProjectPath '..\outside-project.json' } 'inside the project'
    Write-Output "PASS: $passed offline checks; AWS, HTTP, and npm calls were local fakes."
} finally {
    # Verify the absolute temporary target before recursive cleanup.
    $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
    if (-not $resolvedTestRoot.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not ([System.IO.Path]::GetFileName($resolvedTestRoot)).StartsWith('Exodus-offline-')) {
        throw "Refusing cleanup outside the test directory: $resolvedTestRoot"
    }
    Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
}
