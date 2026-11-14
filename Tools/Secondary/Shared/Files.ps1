function Get-ProjectPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $candidate = if ([System.IO.Path]::IsPathRooted($Path)) {
        $Path
    } else {
        Join-Path $ProjectRoot $Path
    }
    $resolved = [System.IO.Path]::GetFullPath($candidate)
    $boundary = $ProjectRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($boundary, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path must stay inside the project: $Path"
    }
    $resolved
}

function Write-ProjectJson {
    param([string]$Path, [Parameter(Mandatory = $true)]$Value)
    $destination = Get-ProjectPath $Path
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    $json = $Value | ConvertTo-Json -Depth 50
    [System.IO.File]::WriteAllText(
        $destination, $json, [System.Text.UTF8Encoding]::new($false)
    )
}

function Read-ProjectJson {
    param([string]$Path)
    Get-Content -LiteralPath (Get-ProjectPath $Path) -Raw | ConvertFrom-Json
}
