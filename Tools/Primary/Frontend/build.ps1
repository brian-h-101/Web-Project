[CmdletBinding(SupportsShouldProcess = $true)]
param()

. (Join-Path $PSScriptRoot '..\..\Secondary\Shared\Project.ps1')

$frontendPath = Get-ProjectPath 'Website/Frontend'
$indexPath = Join-Path $frontendPath 'dist\index.html'
if (-not (Test-Path -LiteralPath (Join-Path $frontendPath 'package.json') -PathType Leaf)) {
    throw 'Frontend/package.json is missing.'
}
if (-not $PSCmdlet.ShouldProcess($frontendPath, 'Build the React production files into dist')) {
    return
}

# Run the existing npm build script, then restore the caller's terminal directory.
Push-Location -LiteralPath $frontendPath
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'The React build failed. Review the npm output.' }
} finally {
    Pop-Location
}
if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
    throw 'The build completed without producing Frontend/dist/index.html.'
}
Write-Output "React build completed: $indexPath"
