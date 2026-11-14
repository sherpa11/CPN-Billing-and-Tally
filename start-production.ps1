# CPN VEGETABLES - PowerShell Startup Script
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "  CPN VEGETABLES - Wholesale Billing and Management System" -ForegroundColor Green
Write-Host "  22-A, Gandhi Market, Dindigul" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

$env:NODE_ENV = "production"
$env:PORT = "5000"

# Open browser after delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:5000"
} | Out-Null

Write-Host "Starting Express Server on http://localhost:5000..." -ForegroundColor Cyan
node server/server.js
