<# Creates missing HTTP API components and reuses matching existing resources. #>
[CmdletBinding(SupportsShouldProcess = $true)]
param()
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
. (Join-Path $PSScriptRoot '..\Shared\Lambda.ps1')
. (Join-Path $PSScriptRoot '..\Shared\HttpApi.ps1')
. (Join-Path $PSScriptRoot '..\Shared\LambdaPermission.ps1')

if (-not $PSCmdlet.ShouldProcess(
    "$($ProjectConfig.Aws.AccountId) / $($ProjectConfig.HttpApi.Name)",
    'Create or reuse the greeting HTTP API'
)) { return }
Assert-ProjectAccount
$function = Invoke-ProjectAws -Arguments @(
    'lambda', 'get-function-configuration', '--function-name', (Get-GreetingFunctionArn)
)
Assert-GreetingFunction $function

# Each returned ID becomes an input to the next component.
$api = Get-OrCreateProjectApi
Write-ProjectJson -Path $ProjectConfig.HttpApi.State -Value $api
$integration = Get-OrCreateGreetingIntegration -ApiId $api.ApiId
Add-GreetingApiPermission -ApiId $api.ApiId
$route = Get-OrCreateGreetingRoute -ApiId $api.ApiId -IntegrationId $integration.IntegrationId
$stage = Get-OrCreateDefaultStage -ApiId $api.ApiId

$uri = $api.ApiEndpoint.TrimEnd('/') + '/api/greeting'
$result = Wait-GreetingEndpoint -Uri $uri
[pscustomobject]@{
    ApiId = $api.ApiId; IntegrationId = $integration.IntegrationId
    RouteId = $route.RouteId; Stage = $stage.StageName
    Url = $uri; StatusCode = $result.StatusCode; Result = $result.Data
} | ConvertTo-Json -Depth 10
