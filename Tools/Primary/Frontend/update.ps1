[CmdletBinding(SupportsShouldProcess = $true)]
param()

. (Join-Path $PSScriptRoot '..\..\Secondary\Shared\Project.ps1')

$source = Get-ProjectPath 'Website/Frontend/dist'
$destination = 's3://' + $ProjectConfig.Website.Bucket + '/'

# Require the generated website before attempting an upload.
if (-not (Test-Path -LiteralPath (Join-Path $source 'index.html') -PathType Leaf)) {
    throw 'Frontend/dist/index.html is missing. Build the frontend first.'
}

if (-not $PSCmdlet.ShouldProcess(
    $destination,
    "Upload built frontend files from $source"
)) {
    return
}

Assert-ProjectAccount

$null = Invoke-ProjectAws -Arguments @(
    's3api', 'head-bucket',
    '--bucket', $ProjectConfig.Website.Bucket,
    '--expected-bucket-owner', $ProjectConfig.Aws.AccountId
)

# Sync paths relative to dist into the bucket root.
$syncArguments = @(
    's3', 'sync', $source, $destination,
    '--no-follow-symlinks',
    '--profile', $ProjectConfig.Aws.Profile,
    '--region', $ProjectConfig.Aws.Region,
    '--no-cli-pager'
)

& aws @syncArguments

if ($LASTEXITCODE -ne 0) {
    throw 'Frontend upload failed.'
}

Write-Output 'Built frontend upload completed.'