function Add-GreetingApiPermission {
    param([string]$ApiId)
    $statementId = 'AllowPortfolioHttpGreeting'
    $sourceArn = 'arn:aws:execute-api:{0}:{1}:{2}/*/GET/api/greeting' -f
        $ProjectConfig.Aws.Region, $ProjectConfig.Aws.AccountId, $ApiId
    $functionArn = Get-GreetingFunctionArn
    $policyResponse = Invoke-ProjectAws -AllowNotFound -Arguments @(
        'lambda', 'get-policy', '--function-name', $functionArn
    )
    $statements = @()
    if ($null -ne $policyResponse) {
        $policy = $policyResponse.Policy | ConvertFrom-Json
        $statements = @($policy.Statement | Where-Object { $_.Sid -eq $statementId })
    }
    if ($statements.Count -gt 0) {
        $statement = $statements[0]
        if ($statement.Effect -ne 'Allow' -or
            $statement.Action -ne 'lambda:InvokeFunction' -or
            $statement.Resource -ne $functionArn -or
            $statement.Principal.Service -ne 'apigateway.amazonaws.com' -or
            $statement.Condition.ArnLike.'AWS:SourceArn' -ne $sourceArn -or
            $statement.Condition.StringEquals.'AWS:SourceAccount' -ne $ProjectConfig.Aws.AccountId) {
            throw 'The existing API invocation permission differs. Review it before replacing it.'
        }
        return
    }
    $null = Invoke-ProjectAws -Arguments @(
        'lambda', 'add-permission', '--function-name', $functionArn,
        '--statement-id', $statementId, '--action', 'lambda:InvokeFunction',
        '--principal', 'apigateway.amazonaws.com', '--source-arn', $sourceArn,
        '--source-account', $ProjectConfig.Aws.AccountId
    )
}
