function New-GreetingPackage {
    $source = Get-ProjectPath $ProjectConfig.Lambda.Source
    $package = Get-ProjectPath $ProjectConfig.Lambda.Package
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Handler source is missing: $source"
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $package) -Force | Out-Null
    # Package the individual file so the handler remains at the ZIP root.
    Compress-Archive -LiteralPath $source -DestinationPath $package -Force -ErrorAction Stop
    $package
}

function Assert-GreetingFunction {
    param([Parameter(Mandatory = $true)]$Function)
    if ($Function.FunctionArn -ne (Get-GreetingFunctionArn) -or
        $Function.Handler -ne $ProjectConfig.Lambda.Handler -or
        $Function.Runtime -ne $ProjectConfig.Lambda.Runtime -or
        $Function.Role -ne (Get-GreetingRoleArn)) {
        throw 'Existing function settings differ from project.json. Review them before deployment.'
    }
}
