#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Runs Jest tests with coverage for the connection validator

.DESCRIPTION
    This script sets up the environment and runs the comprehensive test suite
    for the connection validator with coverage reporting.
#>

Write-Host "Running Jest tests with coverage..." -ForegroundColor Green
Write-Host

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies first..." -ForegroundColor Yellow
    npm install
    Write-Host
}

# Run tests with coverage
node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage

# Check if tests passed
if ($LASTEXITCODE -eq 0) {
    Write-Host
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "✓ All tests passed!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host
    Write-Host "Coverage report generated in: coverage/lcov-report/index.html" -ForegroundColor Cyan
} else {
    Write-Host
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "✗ Tests failed" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
}

Write-Host
