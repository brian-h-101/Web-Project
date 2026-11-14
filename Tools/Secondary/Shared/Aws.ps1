function Invoke-ProjectAws {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$Region = $ProjectConfig.Aws.Region,
        [switch]$AllowNotFound
    )
    $commandArguments = @($Arguments) + @(
        '--profile', $ProjectConfig.Aws.Profile, '--region', $Region,
        '--output', 'json', '--no-cli-pager'
    )
    $errorPath = [System.IO.Path]::GetTempFileName()
    $savedErrorPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5.1 can turn native stderr into PowerShell errors.
        $ErrorActionPreference = 'Continue'
        $PSNativeCommandUseErrorActionPreference = $false
        $outputLines = & aws @commandArguments 2> $errorPath
        $nativeExitCode = $LASTEXITCODE
        $ErrorActionPreference = $savedErrorPreference
        $errorText = Get-Content -LiteralPath $errorPath -Raw
        if ($nativeExitCode -ne 0) {
            $missingResource = $errorText -match '\b(NoSuchEntity|NoSuchBucketPolicy|NotFoundException|ResourceNotFoundException)\b'
            if ($AllowNotFound -and $missingResource) { return $null }
            throw "aws $($Arguments[0]) $($Arguments[1]) failed ($nativeExitCode): $errorText"
        }
        # Some empty AWS listings produce no stdout in AWS CLI 2.
        $json = $outputLines -join [System.Environment]::NewLine
        if (-not [string]::IsNullOrWhiteSpace($json)) {
            $json | ConvertFrom-Json
        }
    } finally {
        $ErrorActionPreference = $savedErrorPreference
        Remove-Item -LiteralPath $errorPath -Force
    }
}

function Assert-ProjectAccount {
    $identity = Invoke-ProjectAws -Arguments @('sts', 'get-caller-identity')
    if ($identity.Account -ne $ProjectConfig.Aws.AccountId) {
        throw "Expected Exodus account $($ProjectConfig.Aws.AccountId); received $($identity.Account)."
    }
}
