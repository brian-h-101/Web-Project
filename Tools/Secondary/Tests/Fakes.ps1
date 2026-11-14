# These commands replace AWS and HTTP only inside the offline test process.
if (-not $OfflineWorkerActive) {
    throw 'Run offline.ps1 instead of loading the test fakes directly.'
}
function Reset-OfflineState {
    $global:OfflineAwsState = @{
        Account = $ProjectConfig.Aws.AccountId
        Api = $null; Integration = $null; Route = $null; Stage = $null
        Permission = $null; Role = $null; LoggingAttached = $false; Budget = $null
        FunctionExists = $true; FunctionError = $false
        Pending404 = 1; HttpStatus = 200; HttpCalls = 0
        Calls = [System.Collections.Generic.List[string]]::new()
        Writes = [System.Collections.Generic.List[string]]::new()
        ETag = 'offline-etag-1'; CloudFrontConfig = $null
        ErrorCommand = ''; ErrorMessage = ''
        Router = $null; RouterLive = $null; RouterETag = 'offline-router-1'
        RouterError = ''; RouterWrongUri = $false
        NpmCalls = [System.Collections.Generic.List[string]]::new()
        NpmLocations = [System.Collections.Generic.List[string]]::new()
        BuildExitCode = 0
        Function = @{
            FunctionName = $ProjectConfig.Lambda.Name
            FunctionArn = Get-GreetingFunctionArn
            Runtime = $ProjectConfig.Lambda.Runtime
            Handler = $ProjectConfig.Lambda.Handler
            Role = Get-GreetingRoleArn
            State = 'Active'; LastUpdateStatus = 'Successful'
        }
    }
}

function global:Get-OfflineOption {
    param([object[]]$CommandArguments, [string]$Option)
    $index = [array]::IndexOf($CommandArguments, $Option)
    if ($index -lt 0) { throw "Missing mocked option $Option" }
    $CommandArguments[$index + 1]
}

function global:Write-OfflineFailure {
    param([string]$Message)
    Write-Error -Message $Message -ErrorAction Continue
    $global:LASTEXITCODE = 254
}

function global:aws {
    $commandArguments = @($args)
    $command = "$($commandArguments[0]) $($commandArguments[1])"
    $state = $global:OfflineAwsState
    $state.Calls.Add($command)
    $global:LASTEXITCODE = 0
    if ($command -eq $state.ErrorCommand) {
        Write-OfflineFailure $state.ErrorMessage
        return
    }
    if ($commandArguments[1] -match '^(create|update|add|attach|publish)-' -or $command -eq 's3 sync') {
        $state.Writes.Add($command)
    }
    $result = switch ($command) {
        'sts get-caller-identity' { @{ Account = $state.Account } }
        'apigatewayv2 get-apis' {
            if ($null -eq $state.Api) { return } # Exercise the CLI's empty stdout.
            @{ Items = @($state.Api) }
        }
        'apigatewayv2 create-api' {
            $state.Api = @{
                ApiId = 'offline123'; Name = 'exodus-portfolio-api'; ProtocolType = 'HTTP'
                ApiEndpoint = 'https://offline123.execute-api.us-east-2.amazonaws.com'
            }
            $state.Api
        }
        'apigatewayv2 get-integrations' { @{ Items = @($state.Integration | Where-Object { $null -ne $_ }) } }
        'apigatewayv2 create-integration' {
            $state.Integration = @{
                IntegrationId = 'offline-integration'
                IntegrationUri = $state.Function.FunctionArn
                IntegrationType = 'AWS_PROXY'; IntegrationMethod = 'POST'; PayloadFormatVersion = '2.0'
            }
            $state.Integration
        }
        'apigatewayv2 get-routes' { @{ Items = @($state.Route | Where-Object { $null -ne $_ }) } }
        'apigatewayv2 create-route' {
            $state.Route = @{
                RouteId = 'offline-route'; RouteKey = 'GET /api/greeting'
                Target = 'integrations/offline-integration'; AuthorizationType = 'NONE'
            }
            $state.Route
        }
        'apigatewayv2 get-stage' {
            if ($null -eq $state.Stage) { Write-OfflineFailure '(NotFoundException) stage absent'; return }
            $state.Stage
        }
        'apigatewayv2 create-stage' {
            $state.Stage = @{ StageName = '$default'; AutoDeploy = $true }
            $state.Stage
        }
        'lambda get-function-configuration' {
            if (-not $state.FunctionExists) { Write-OfflineFailure '(ResourceNotFoundException) absent'; return }
            $state.Function
        }
        'lambda create-function' { $state.FunctionExists = $true; $state.Function }
        'lambda update-function-code' { $state.Function }
        'lambda wait' { return }
        'lambda get-policy' {
            if ($null -eq $state.Permission) { Write-OfflineFailure '(ResourceNotFoundException) policy absent'; return }
            @{ Policy = (@{ Statement = @($state.Permission) } | ConvertTo-Json -Depth 10 -Compress) }
        }
        'lambda add-permission' {
            $state.Permission = @{
                Sid = 'AllowPortfolioHttpGreeting'; Effect = 'Allow'
                Action = 'lambda:InvokeFunction'; Resource = $state.Function.FunctionArn
                Principal = @{ Service = 'apigateway.amazonaws.com' }
                Condition = @{
                    ArnLike = @{ 'AWS:SourceArn' = Get-OfflineOption $commandArguments '--source-arn' }
                    StringEquals = @{ 'AWS:SourceAccount' = $state.Account }
                }
            }
            @{ Statement = ($state.Permission | ConvertTo-Json -Depth 10 -Compress) }
        }
        'lambda invoke' {
            $payloadArgument = Get-OfflineOption $commandArguments '--payload'
            $payload = Get-Content -LiteralPath $payloadArgument.Substring(8) -Raw | ConvertFrom-Json
            $payloadIndex = [array]::IndexOf($commandArguments, '--payload')
            $responsePath = $commandArguments[$payloadIndex + 2]
            $name = $payload.queryStringParameters.name
            $name = if ($name -and $name.Trim()) { $name.Trim() } else { 'visitor' }
            $response = if ($state.FunctionError) { '{"errorMessage":"offline error"}' } else {
                @{ message = "Hello, $name!"; service = 'exodus-portfolio' } | ConvertTo-Json -Compress
            }
            [System.IO.File]::WriteAllText($responsePath, $response)
            $metadata = @{ StatusCode = 200; ExecutedVersion = '$LATEST' }
            if ($state.FunctionError) { $metadata.FunctionError = 'Unhandled' }
            $metadata
        }
        'iam get-role' {
            if ($null -eq $state.Role) { Write-OfflineFailure '(NoSuchEntity) role absent'; return }
            @{ Role = $state.Role }
        }
        'iam create-role' {
            $state.Role = @{
                RoleName = 'exodus-portfolio-greeting-role'; Arn = $state.Function.Role
                AssumeRolePolicyDocument = @{
                    Statement = @(@{
                        Effect = 'Allow'; Action = 'sts:AssumeRole'
                        Principal = @{ Service = 'lambda.amazonaws.com' }
                    })
                }
            }
            @{ Role = $state.Role }
        }
        'iam list-attached-role-policies' {
            $policies = @()
            if ($state.LoggingAttached) {
                $policies = @(@{ PolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' })
            }
            @{ AttachedPolicies = $policies }
        }
        'iam attach-role-policy' { $state.LoggingAttached = $true; return }
        'budgets describe-budget' {
            if ($null -eq $state.Budget) { Write-OfflineFailure '(NotFoundException) budget absent'; return }
            @{ Budget = $state.Budget }
        }
        'budgets create-budget' {
            $fileArgument = Get-OfflineOption $commandArguments '--cli-input-json'
            $request = Get-Content -LiteralPath $fileArgument.Substring(7) -Raw | ConvertFrom-Json
            $state.Budget = $request.Budget
            return
        }
        's3api head-bucket' { @{ BucketRegion = 'us-east-2' } }
        's3 sync' {
            if ($commandArguments -contains '--delete' -or
                $commandArguments -notcontains '--no-follow-symlinks' -or
                $commandArguments[2] -ne (Get-ProjectPath 'Website/Frontend/dist') -or
                $commandArguments[3] -ne ('s3://' + $ProjectConfig.Website.Bucket + '/')) {
                throw 'Unexpected upload scope or flags.'
            }
            return
        }
        'cloudfront create-function' {
            if ($state.Router) { Write-OfflineFailure '(FunctionAlreadyExists) function exists'; return }
            $configuration = Get-OfflineOption $commandArguments '--function-config'
            $code = Get-OfflineOption $commandArguments '--function-code'
            if (-not $configuration.StartsWith('file://') -or -not $code.StartsWith('fileb://') -or
                -not (Test-Path -LiteralPath $code.Substring(8) -PathType Leaf)) {
                throw 'Invalid router code/configuration paths.'
            }
            $state.Router = @{
                Name = Get-OfflineOption $commandArguments '--name'
                FunctionConfig = Get-Content -LiteralPath $configuration.Substring(7) -Raw | ConvertFrom-Json
                FunctionMetadata = @{
                    FunctionARN = 'arn:aws:cloudfront::{0}:function/exodus-portfolio-frontend-router' -f $ProjectConfig.Aws.AccountId
                    Stage = 'DEVELOPMENT'
                }
            }
            @{ ETag = $state.RouterETag; FunctionSummary = $state.Router }
        }
        'cloudfront describe-function' {
            $stage = Get-OfflineOption $commandArguments '--stage'
            $router = if ($stage -eq 'LIVE') { $state.RouterLive } else { $state.Router }
            if (-not $router) { Write-OfflineFailure '(NoSuchFunctionExists) function absent'; return }
            @{ ETag = $state.RouterETag; FunctionSummary = $router }
        }
        'cloudfront test-function' {
            if ((Get-OfflineOption $commandArguments '--if-match') -ne $state.RouterETag) {
                Write-OfflineFailure '(PreconditionFailed) stale router version'; return
            }
            $eventArgument = Get-OfflineOption $commandArguments '--event-object'
            if (-not $eventArgument.StartsWith('fileb://')) { throw 'Expected a binary test event file.' }
            $event = Get-Content -LiteralPath $eventArgument.Substring(8) -Raw | ConvertFrom-Json
            $request = $event.request
            if (-not $state.RouterWrongUri) { $request.uri = '/index.html' }
            @{
                TestResult = @{
                    FunctionSummary = $state.Router
                    FunctionErrorMessage = $state.RouterError
                    FunctionOutput = (@{ request = $request } | ConvertTo-Json -Depth 20 -Compress)
                }
            }
        }
        'cloudfront publish-function' {
            if ((Get-OfflineOption $commandArguments '--if-match') -ne $state.RouterETag) {
                Write-OfflineFailure '(PreconditionFailed) stale router version'; return
            }
            $state.RouterLive = $state.Router | ConvertTo-Json -Depth 20 | ConvertFrom-Json
            $state.RouterLive.FunctionMetadata.Stage = 'LIVE'
            @{ FunctionSummary = $state.RouterLive }
        }
        'cloudfront get-distribution-config' {
            @{ ETag = $state.ETag; DistributionConfig = $state.CloudFrontConfig }
        }
        'cloudfront update-distribution' {
            if ((Get-OfflineOption $commandArguments '--if-match') -ne $state.ETag) {
                throw 'Missing CloudFront concurrency protection.'
            }
            $state.ETag = 'offline-etag-2'
            @{ Distribution = @{ Id = 'E3M9GEX0LQHSED'; Status = 'InProgress' } }
        }
        'cloudfront wait' { return }
        'cloudfront get-distribution' {
            @{ Distribution = @{ Id = 'E3M9GEX0LQHSED'; DomainName = 'offline.cloudfront.net'; Status = 'Deployed' } }
        }
        default { throw "Unimplemented offline AWS command: $command" }
    }
    if ($null -ne $result) { $result | ConvertTo-Json -Depth 30 -Compress }
}

if (-not ('OfflineHttpResponse' -as [type])) {
    Add-Type -TypeDefinition @'
public class OfflineHttpResponse : System.Net.WebResponse {
    public System.Net.HttpStatusCode StatusCode { get; set; }
}
'@
}
function global:Invoke-WebRequest {
    param([string]$Uri, [switch]$UseBasicParsing, [int]$TimeoutSec, [string]$ErrorAction)
    $state = $global:OfflineAwsState
    $state.HttpCalls++
    $status = $state.HttpStatus
    if ($state.Pending404 -gt 0) { $state.Pending404--; $status = 404 }
    if ($status -ne 200) {
        $response = [OfflineHttpResponse]::new()
        $response.StatusCode = [System.Net.HttpStatusCode]$status
        throw [System.Net.WebException]::new(
            "Offline HTTP $status", $null, [System.Net.WebExceptionStatus]::ProtocolError, $response
        )
    }
    $name = 'visitor'
    if ($Uri -match '[?&]name=([^&]*)') {
        $name = [System.Uri]::UnescapeDataString($Matches[1]).Trim()
        if (-not $name) { $name = 'visitor' }
    }
    [pscustomobject]@{
        StatusCode = 200
        Content = (@{ message = "Hello, $name!"; service = 'exodus-portfolio' } | ConvertTo-Json -Compress)
    }
}
function global:Start-Sleep { param([int]$Seconds) }

function global:npm.cmd {
    $state = $global:OfflineAwsState
    $state.NpmCalls.Add(($args -join ' '))
    $state.NpmLocations.Add((Get-Location).Path)
    $global:LASTEXITCODE = $state.BuildExitCode
    if ($state.BuildExitCode -eq 0) {
        $indexPath = Get-ProjectPath 'Website/Frontend/dist/index.html'
        New-Item -ItemType Directory -Path (Split-Path -Parent $indexPath) -Force | Out-Null
        [System.IO.File]::WriteAllText($indexPath, '<!doctype html><title>Offline React build</title>')
    }
}
