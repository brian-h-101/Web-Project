[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$EventPath)
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')
$inputPath = if ($EventPath) {
    Get-ProjectPath $EventPath
} else {
    Get-ProjectPath $ProjectConfig.Lambda.Event
}
$responsePath = Get-ProjectPath $ProjectConfig.Lambda.Response
if (-not $PSCmdlet.ShouldProcess($ProjectConfig.Lambda.Name, "Invoke using $inputPath")) { return }
Assert-ProjectAccount
$event = Read-ProjectJson $inputPath
if ($event -isnot [pscustomobject]) { throw 'The event file must contain a JSON object.' }
New-Item -ItemType Directory -Path (Split-Path -Parent $responsePath) -Force | Out-Null
$metadata = Invoke-ProjectAws -Arguments @(
    'lambda', 'invoke', '--function-name', (Get-GreetingFunctionArn),
    '--invocation-type', 'RequestResponse', '--payload', "fileb://$inputPath", $responsePath
)
$result = Get-Content -LiteralPath $responsePath -Raw | ConvertFrom-Json
if ($metadata.FunctionError) {
    throw "Lambda reported $($metadata.FunctionError): $($result | ConvertTo-Json -Compress)"
}
if ($metadata.StatusCode -ne 200) { throw "Unexpected invocation status: $($metadata.StatusCode)" }
[pscustomobject]@{ Invocation = $metadata; Result = $result } | ConvertTo-Json -Depth 10
