[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$Name = 'Brian', [switch]$ThroughWebsite)
. (Join-Path $PSScriptRoot '..\Shared\Project.ps1')

$endpoint = if ($ThroughWebsite) {
    'https://' + $ProjectConfig.Website.Domain
} else {
    (Read-ProjectJson $ProjectConfig.HttpApi.State).ApiEndpoint.TrimEnd('/')
}
$uri = $endpoint + '/api/greeting?name=' + [System.Uri]::EscapeDataString($Name)
if (-not $PSCmdlet.ShouldProcess($uri, 'Test the HTTP greeting')) { return }
$expectedName = if ($Name.Trim()) { $Name.Trim() } else { 'visitor' }
Wait-GreetingEndpoint -Uri $uri -ExpectedName $expectedName | ConvertTo-Json -Depth 10
