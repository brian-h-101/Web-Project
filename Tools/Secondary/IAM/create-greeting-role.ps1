[CmdletBinding(SupportsShouldProcess = $true)]
param()
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Lambda.RoleName, 'Create or reuse the greeting execution role')) { return }
Assert-ProjectAccount
$roleName = $ProjectConfig.Lambda.RoleName
$existing = Invoke-ProjectAws -AllowNotFound -Arguments @('iam', 'get-role', '--role-name', $roleName)
if ($null -eq $existing) {
    $trustPath = Get-ProjectPath $ProjectConfig.Lambda.TrustPolicy
    $existing = Invoke-ProjectAws -Arguments @(
        'iam', 'create-role', '--role-name', $roleName,
        '--assume-role-policy-document', "file://$trustPath",
        '--description', 'Execution role for the Exodus portfolio greeting function'
    )
}
$trusted = @($existing.Role.AssumeRolePolicyDocument.Statement | Where-Object {
    $_.Effect -eq 'Allow' -and $_.Action -contains 'sts:AssumeRole' -and
    $_.Principal.Service -contains 'lambda.amazonaws.com'
})
if ($existing.Role.Arn -ne (Get-GreetingRoleArn) -or $trusted.Count -eq 0) {
    throw 'Existing role ARN or Lambda trust does not match the project.'
}
$loggingArn = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
$policies = Invoke-ProjectAws -Arguments @('iam', 'list-attached-role-policies', '--role-name', $roleName)
if (@($policies.AttachedPolicies | Where-Object { $_.PolicyArn -eq $loggingArn }).Count -eq 0) {
    $null = Invoke-ProjectAws -Arguments @(
        'iam', 'attach-role-policy', '--role-name', $roleName, '--policy-arn', $loggingArn
    )
}
$existing.Role | Select-Object RoleName, Arn
