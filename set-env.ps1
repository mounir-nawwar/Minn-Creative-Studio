# set-env.ps1 - Sets env vars on the existing Cloud Run service without redeploying
$envVars = @()

Get-Content .env | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 0) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if ($key -eq 'FIREBASE_SERVICE_ACCOUNT') { return }
    $envVars += "$key=$val"
}

$envString = ($envVars + "NODE_ENV=production") -join ","

Write-Host "Setting $($envVars.Count) env vars on minn-studio..."

gcloud run services update minn-creative-studio `
  --region europe-west1 `
  --project gen-lang-client-0639313445 `
  --set-env-vars "$envString"

Write-Host "Done!"
