# Download script for NEMO embedding model
$ErrorActionPreference = "Stop"

# Configuration
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
$modelDir = Join-Path -Path $projectRoot -ChildPath "models"
$modelFile = "nemo_all_embed.bin"
$modelPath = Join-Path -Path $modelDir -ChildPath $modelFile

# Create models directory if it doesn't exist
if (-not (Test-Path $modelDir)) {
    New-Item -ItemType Directory -Path $modelDir | Out-Null
    Write-Host "Created models directory at $modelDir"
}

# Check if model already exists
if (Test-Path $modelPath) {
    Write-Host "Model file already exists at $modelPath"
    exit 0
}

# Download model from NGC
Write-Host "Downloading model file..."
$env:NGC_CLI_API_KEY = $env:NGC_API_KEY
ngc registry model download-version nvidia/nemo/nemo_all_embed:1.0 --dest $modelDir

# Verify download
if (Test-Path $modelPath) {
    Write-Host "Model downloaded successfully to $modelPath"
} else {
    Write-Error "Failed to download model"
    exit 1
}