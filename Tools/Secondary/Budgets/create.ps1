[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$Email)
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Budget.Name, 'Create or verify the monthly budget')) { return }
Assert-ProjectAccount
$account = $ProjectConfig.Aws.AccountId
$budgetName = $ProjectConfig.Budget.Name
$budgetRegion = $ProjectConfig.Budget.Region
$existing = Invoke-ProjectAws -Region $budgetRegion -AllowNotFound -Arguments @(
    'budgets', 'describe-budget', '--account-id', $account, '--budget-name', $budgetName
)
if ($null -ne $existing) {
    if ([decimal]$existing.Budget.BudgetLimit.Amount -ne [decimal]$ProjectConfig.Budget.AmountUSD -or
        $existing.Budget.BudgetLimit.Unit -ne 'USD' -or
        $existing.Budget.TimeUnit -ne 'MONTHLY' -or $existing.Budget.BudgetType -ne 'COST') {
        throw 'An existing budget has different settings. Review it before changing it.'
    }
    Write-Output "Verified existing monthly budget: $budgetName."
    return
}
if ([string]::IsNullOrWhiteSpace($Email) -or $Email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    throw 'Supply -Email with the alert address when creating a new budget.'
}
$notifications = @(foreach ($threshold in @(80, 100)) {
    @{
        Notification = @{
            NotificationType = 'ACTUAL'; ComparisonOperator = 'GREATER_THAN'
            Threshold = $threshold; ThresholdType = 'PERCENTAGE'
        }
        Subscribers = @(@{ SubscriptionType = 'EMAIL'; Address = $Email.Trim() })
    }
})
$request = @{
    AccountId = $account
    Budget = @{
        BudgetName = $budgetName
        BudgetLimit = @{ Amount = [string]$ProjectConfig.Budget.AmountUSD; Unit = 'USD' }
        TimeUnit = 'MONTHLY'; BudgetType = 'COST'
        CostFilters = @{ LinkedAccount = @($account) }
    }
    NotificationsWithSubscribers = $notifications
}
$requestPath = 'Website/Systems/Budgets/monthly-budget-request.json'
Write-ProjectJson -Path $requestPath -Value $request
$null = Invoke-ProjectAws -Region $budgetRegion -Arguments @(
    'budgets', 'create-budget', '--cli-input-json', "file://$(Get-ProjectPath $requestPath)"
)
Write-Output "Created $budgetName with 80% and 100% email alerts. Complete AWS email verification."
