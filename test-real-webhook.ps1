# Test script to simulate a real webhook from your phone

$tunnelUrl = "https://weather-reel-quantity-windsor.trycloudflare.com"
$yourPhone = "919455281616"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "TESTING WEBHOOK WITH YOUR PHONE" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Testing tunnel connectivity..." -ForegroundColor Yellow
try {
    $challengeResponse = Invoke-WebRequest -Uri "$tunnelUrl/api/webhook/customer?hub.challenge=test" -UseBasicParsing
    if ($challengeResponse.Content -eq "test") {
        Write-Host "   ✅ Tunnel is reachable" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Tunnel returned unexpected response: $($challengeResponse.Content)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Tunnel is NOT reachable: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Sending simulated webhook from your phone ($yourPhone)..." -ForegroundColor Yellow

$webhookPayload = @{
    event = "message"
    payload = @{
        from = $yourPhone
        messageId = "real_test_$(Get-Date -Format 'yyyyMMddHHmmss')"
        message = @{
            from = $yourPhone
            id = "msg_$(Get-Date -Format 'yyyyMMddHHmmss')"
            type = "text"
            text = @{
                body = "Hello, I need 24 inch bags"
            }
        }
        contacts = @(
            @{
                profile = @{
                    name = "Nikhil (Your Phone)"
                }
            }
        )
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest -Uri "$tunnelUrl/api/webhook/customer" `
        -Method POST `
        -ContentType "application/json" `
        -Body $webhookPayload `
        -UseBasicParsing
    
    $responseData = $response.Content | ConvertFrom-Json
    
    Write-Host "   ✅ Webhook processed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host $response.Content -ForegroundColor White
    
} catch {
    Write-Host "   ❌ Webhook failed: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "3. Check debug dashboard:" -ForegroundColor Yellow
Write-Host "   http://localhost:3000/debug" -ForegroundColor White
Write-Host ""
Write-Host "You should see:" -ForegroundColor Yellow
Write-Host "   - customer_inbound event with phone: $yourPhone" -ForegroundColor White
Write-Host "   - New customer: $yourPhone" -ForegroundColor White
Write-Host "   - Ravi's response" -ForegroundColor White
Write-Host "================================" -ForegroundColor Cyan
