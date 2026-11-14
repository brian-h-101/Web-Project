# Each entry script loads this file to locate the project, settings, and helpers.
$ErrorActionPreference = 'Stop'
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$SystemsRoot = Join-Path $ProjectRoot 'Website\Systems'
$settingsPath = Join-Path $SystemsRoot 'Configuration\project.json'
$ProjectConfig = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json

. (Join-Path $PSScriptRoot 'Files.ps1')
. (Join-Path $PSScriptRoot 'Aws.ps1')
. (Join-Path $PSScriptRoot 'Http.ps1')

function Get-GreetingFunctionArn {
    'arn:aws:lambda:{0}:{1}:function:{2}' -f $ProjectConfig.Aws.Region,
        $ProjectConfig.Aws.AccountId, $ProjectConfig.Lambda.Name
}

function Get-GreetingRoleArn {
    'arn:aws:iam::{0}:role/{1}' -f $ProjectConfig.Aws.AccountId,
        $ProjectConfig.Lambda.RoleName
}
