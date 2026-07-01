# Quick Testing Guide

## Test the Complete Customer Flow

### Step 1: Check System Status
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/test/status -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Step 2: Test Customer Message 1 - Initial Inquiry
```powershell
$body = @{
    type = "customer"
    phone = "919876543210"
    name = "Rajesh Kumar"
    text = "Hi, I need 24 inch bags"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Step 3: Test Customer Message 2 - Provide Grammage
```powershell
$body = @{
    type = "customer"
    phone = "919876543210"
    name = "Rajesh Kumar"
    text = "3.5g grammage"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Step 4: Test Customer Message 3 - Provide Quality
```powershell
$body = @{
    type = "customer"
    phone = "919876543210"
    name = "Rajesh Kumar"
    text = "Regular quality"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Step 5: Test Customer Message 4 - Provide Color
```powershell
$body = @{
    type = "customer"
    phone = "919876543210"
    name = "Rajesh Kumar"
    text = "White color"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Step 6: Test Customer Message 5 - Provide Lamination
```powershell
$body = @{
    type = "customer"
    phone = "919876543210"
    name = "Rajesh Kumar"
    text = "No lamination"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Step 7: Test Customer Message 6 - Provide Quantity and Confirm
```powershell
$body = @{
    type = "customer"
    phone = "919876543210"
    name = "Rajesh Kumar"
    text = "1000 kg, please confirm"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Result:** Quote should be generated with pricing and delivery date!

---

## Test Owner Learning (Guru Agent)

### Test Owner Message - Provide Knowledge
```powershell
$body = @{
    type = "owner"
    phone = "919408724777"
    name = "Production Team"
    text = "The meter weight for 24 inch Regular quality is 3.2g"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Result:** Memory should be extracted and stored in knowledge base!

---

## Check Database

### View Database Health
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/test/db -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Seed Test Data (if needed)
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/test/db -Method POST -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

---

## Check Agent State

### Get Current State
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/agent/state -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Enable/Disable Auto-Send
```powershell
# Enable auto-send
$body = @{
    agentEnabled = $true
    raviEnabled = $true
    autoSendRaviReplies = $true
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/agent/state -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

---

## Direct Database Query (SQLite)

If you want to check the database directly:

```powershell
# Navigate to the project directory
cd C:\Users\Nikhil1616\Desktop\Sales_Agent\SALES_AGENT\anjani-ai-sales-os

# Open SQLite database
sqlite3 data/sales_agent.db

# View customers
SELECT * FROM customers;

# View chat messages
SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 10;

# View enquiries
SELECT * FROM enquiries;

# View quotes
SELECT * FROM quotes;

# View knowledge base
SELECT * FROM knowledge_base;

# Exit SQLite
.exit
```

---

## Troubleshooting

### If Sarvam API fails:
1. Check internet connection
2. Verify API key in `.env.local`
3. Test directly: `GET http://localhost:3000/api/test/sarvam`

### If webhooks fail:
1. Check agent is enabled: `GET http://localhost:3000/api/agent/state`
2. Check database health: `GET http://localhost:3000/api/test/db`
3. Check server logs in terminal

### If database issues:
1. Delete `data/sales_agent.db`
2. Restart server (it will recreate database)
3. Seed data: `POST http://localhost:3000/api/test/db`

---

## Success Indicators

✅ System status shows all components ready  
✅ Sarvam test returns AI response  
✅ Customer webhook extracts slots correctly  
✅ Quote is generated with all slots filled  
✅ Owner webhook stores knowledge  
✅ Database shows all records  

**Happy Testing!** 🚀
