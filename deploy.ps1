# deploy.ps1 - Run this from your project folder to deploy to Cloud Run
$envVars = @()

Get-Content .env | ForEach-Object {
    $line = $_.Trim()
    # Skip comments and empty lines
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    
    # Split on first = only
    $idx = $line.IndexOf('=')
    if ($idx -lt 0) { return }
    
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    
    # Skip FIREBASE_SERVICE_ACCOUNT - set it separately via secret manager
    if ($key -eq 'FIREBASE_SERVICE_ACCOUNT') { return }
    
    $envVars += "$key=$val"
}

$envString = $envVars -join ","
# At the end of the env vars, always add NODE_ENV=production for Cloud Run
$envString = $envString + ",NODE_ENV=production"

Write-Host "Deploying minn-studio to Cloud Run..."
Write-Host "Environment variables: $($envVars.Count) vars loaded"

gcloud run deploy minn-studio `
  --source . `
  --region us-west1 `
  --project gen-lang-client-0639313445 `
  --allow-unauthenticated `
  --clear-base-image `
  --memory 2Gi `
  --cpu 2 `
  --set-env-vars "$envString"

Write-Host "Done!"