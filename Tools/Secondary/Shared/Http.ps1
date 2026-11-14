function Wait-GreetingEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [string]$ExpectedName = 'visitor',
        [int]$Attempts = 12,
        [int]$DelaySeconds = 5
    )
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        } catch {
            $status = 0
            if ($null -ne $_.Exception.Response) {
                $status = [int]$_.Exception.Response.StatusCode
            }
            # Retry the observed stage-publication race; surface other errors.
            if ($status -ne 404 -or $attempt -eq $Attempts) { throw }
            Write-Host "Route is publishing; retry $attempt of $Attempts..."
            Start-Sleep -Seconds $DelaySeconds
            continue
        }
        $data = $response.Content | ConvertFrom-Json
        if ($response.StatusCode -ne 200 -or
            $data.message -ne "Hello, $ExpectedName!" -or
            $data.service -ne 'exodus-portfolio') {
            throw "Unexpected greeting response from $Uri : $($response.Content)"
        }
        return [pscustomobject]@{
            Url = $Uri; StatusCode = $response.StatusCode; Data = $data
        }
    }
}
