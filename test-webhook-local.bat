@echo off
echo ========================================
echo Testing Local Webhook Endpoints
echo ========================================
echo.

echo Testing Customer Webhook Endpoint...
curl -X GET "http://localhost:3000/api/webhook/customer?hub.challenge=test123"
echo.
echo.

echo Testing Owner Webhook Endpoint...
curl -X GET "http://localhost:3000/api/webhook/owner?hub.challenge=test456"
echo.
echo.

echo Testing Debug Endpoint...
curl -X GET "http://localhost:3000/api/debug/webhooks"
echo.
echo.

echo Testing Customers API...
curl -X GET "http://localhost:3000/api/customers"
echo.
echo.

echo ========================================
echo Tests Complete!
echo ========================================
pause
