$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$siteUrl = 'http://localhost:5173/'
$apiUrl = 'http://localhost:3001/api/health'

function Test-Url {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

Set-Location -LiteralPath $projectRoot

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js is not installed or is not available in PATH.'
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Error 'npm is not installed or is not available in PATH.'
}

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env'))) {
  Write-Error 'The .env file is missing. Copy .env.example to .env and add the PostgreSQL password first.'
}

$postgresService = Get-Service -Name 'postgresql-x64-18' -ErrorAction SilentlyContinue
if ($postgresService -and $postgresService.Status -ne 'Running') {
  try {
    Start-Service -Name $postgresService.Name
    $postgresService.WaitForStatus('Running', [TimeSpan]::FromSeconds(20))
  } catch {
    Write-Warning 'PostgreSQL could not be started automatically. Start postgresql-x64-18 as Administrator if the API does not connect.'
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
  Write-Host 'Installing project dependencies...' -ForegroundColor Cyan
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}

if (-not (Test-Url -Url $apiUrl)) {
  Write-Host 'Preparing the database...' -ForegroundColor Cyan
  & npm.cmd run db:migrate
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Database migration failed. The website can open, but bookings and admin features may not work.'
  }
}

$siteReady = Test-Url -Url $siteUrl
$apiReady = Test-Url -Url $apiUrl

if (-not $siteReady -and -not $apiReady) {
  Write-Host 'Starting Ghure Ashi...' -ForegroundColor Cyan
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev') -WorkingDirectory $projectRoot -WindowStyle Hidden
} elseif (-not $siteReady) {
  Write-Host 'Starting the website...' -ForegroundColor Cyan
  $viteCommand = Join-Path $projectRoot 'node_modules\.bin\vite.cmd'
  Start-Process -FilePath $viteCommand -WorkingDirectory $projectRoot -WindowStyle Hidden
} elseif (-not $apiReady) {
  Write-Host 'Starting the application server...' -ForegroundColor Cyan
  Start-Process -FilePath 'node.exe' -ArgumentList @('--watch','server/index.js') -WorkingDirectory $projectRoot -WindowStyle Hidden
}

if (-not ($siteReady -and $apiReady)) {
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 500
    $siteReady = Test-Url -Url $siteUrl
    $apiReady = Test-Url -Url $apiUrl
    if ($siteReady -and $apiReady) { break }
  }
}

if (-not $siteReady) {
  Write-Error 'The website did not start within 20 seconds. Run npm run dev in a terminal to view the detailed error.'
}

Start-Process $siteUrl

if ($apiReady) {
  Write-Host 'Ghure Ashi is ready.' -ForegroundColor Green
} else {
  Write-Warning 'The website opened, but the API is unavailable. Check PostgreSQL and the DATABASE_URL in .env.'
  Read-Host 'Press Enter to close this launcher'
}
