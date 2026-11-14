function Get-OrCreateProjectApi {
    $listing = Invoke-ProjectAws -Arguments @('apigatewayv2', 'get-apis')
    $apiMatches = @($listing.Items | Where-Object { $_.Name -eq $ProjectConfig.HttpApi.Name })
    if ($apiMatches.Count -gt 1) {
        throw "Multiple APIs named $($ProjectConfig.HttpApi.Name). Resolve the duplicate IDs before continuing."
    }
    if ($apiMatches.Count -eq 1) {
        if ($apiMatches[0].ProtocolType -ne 'HTTP') { throw 'Existing API is not an HTTP API.' }
        return $apiMatches[0]
    }
    Invoke-ProjectAws -Arguments @(
        'apigatewayv2', 'create-api', '--name', $ProjectConfig.HttpApi.Name,
        '--protocol-type', 'HTTP'
    )
}

function Get-OrCreateGreetingIntegration {
    param([string]$ApiId)
    $functionArn = Get-GreetingFunctionArn
    $invokeUri = 'arn:aws:apigateway:{0}:lambda:path/2015-03-31/functions/{1}/invocations' -f
        $ProjectConfig.Aws.Region, $functionArn
    $listing = Invoke-ProjectAws -Arguments @('apigatewayv2', 'get-integrations', '--api-id', $ApiId)
    $integrationMatches = @($listing.Items | Where-Object {
        $_.IntegrationUri -eq $functionArn -or $_.IntegrationUri -eq $invokeUri
    })
    if ($integrationMatches.Count -gt 1) { throw 'Multiple integrations target the greeting function. Review their IDs.' }
    if ($integrationMatches.Count -eq 1) {
        if ($integrationMatches[0].IntegrationType -ne 'AWS_PROXY' -or
            $integrationMatches[0].PayloadFormatVersion -ne '2.0' -or
            $integrationMatches[0].IntegrationMethod -ne 'POST') {
            throw 'Existing greeting integration has different settings. Review it before changing it.'
        }
        return $integrationMatches[0]
    }
    Invoke-ProjectAws -Arguments @(
        'apigatewayv2', 'create-integration', '--api-id', $ApiId,
        '--integration-type', 'AWS_PROXY', '--integration-uri', $functionArn,
        '--integration-method', 'POST', '--payload-format-version', '2.0'
    )
}

function Get-OrCreateGreetingRoute {
    param([string]$ApiId, [string]$IntegrationId)
    $listing = Invoke-ProjectAws -Arguments @('apigatewayv2', 'get-routes', '--api-id', $ApiId)
    $routeMatches = @($listing.Items | Where-Object { $_.RouteKey -eq $ProjectConfig.HttpApi.RouteKey })
    if ($routeMatches.Count -gt 1) { throw 'Multiple greeting routes were returned.' }
    if ($routeMatches.Count -eq 1) {
        if ($routeMatches[0].Target -ne "integrations/$IntegrationId" -or
            $routeMatches[0].AuthorizationType -ne 'NONE') {
            throw 'Existing route has a different target or authorization setting. Review it first.'
        }
        return $routeMatches[0]
    }
    Invoke-ProjectAws -Arguments @(
        'apigatewayv2', 'create-route', '--api-id', $ApiId, '--route-key',
        $ProjectConfig.HttpApi.RouteKey, '--authorization-type', 'NONE',
        '--target', "integrations/$IntegrationId"
    )
}

function Get-OrCreateDefaultStage {
    param([string]$ApiId)
    $stage = Invoke-ProjectAws -AllowNotFound -Arguments @(
        'apigatewayv2', 'get-stage', '--api-id', $ApiId, '--stage-name', '$default'
    )
    if ($null -ne $stage) {
        if (-not $stage.AutoDeploy) { throw 'Existing default stage has auto-deployment disabled.' }
        return $stage
    }
    Invoke-ProjectAws -Arguments @(
        'apigatewayv2', 'create-stage', '--api-id', $ApiId,
        '--stage-name', '$default', '--auto-deploy'
    )
}
