# ✅ WhatsApp Integration Deployment Checklist

**Print this page or keep it open while deploying!**

---

## 📋 Pre-Deployment

### Environment Setup
- [ ] `.env.local` exists in project root
- [ ] `CHAKRA_API_KEY` is set
- [ ] `CHAKRA_BUSINESS_NUMBER` is set (15559518329)
- [ ] `SARVAM_API_KEY` is set
- [ ] `OWNER_PHONE` is set (919455281616)
- [ ] `WEBHOOK_SECRET` is set
- [ ] Database exists at `data/sales_agent.db`
- [ ] Message log exists at `data/runtime/message-log.json`

### Dependencies
- [ ] Node.js installed
- [ ] npm installed
- [ ] `npm install` completed successfully
- [ ] Project builds without errors

---

## 🔧 Installation

### Install Cloudflared
- [ ] Run: `winget install --id Cloudflare.cloudflared`
- [ ] Close and reopen PowerShell
- [ ] Run: `cloudflared --version`
- [ ] Version number displays (not "command not found")

**If winget fails:**
- [ ] Download from: https://github.com/cloudflare/cloudflared/releases
- [ ] Download file: `cloudflared-windows-amd64.exe`
- [ ] Rename to: `cloudflared.exe`
- [ ] Move to: `C:\Windows\System32`
- [ ] Verify: `cloudflared --version`

---

## 🚀 Deployment

### Start System
- [ ] Open PowerShell
- [ ] Navigate to project: `cd c:\Users\Nikhil1616\Desktop\Sales_Agent\SALES_AGENT\flowzint-ai-sales-os`
- [ ] Run: `.\start-with-tunnel.bat`
- [ ] See "Starting Next.js dev server..." message
- [ ] See "Starting Cloudflare tunnel..." message
- [ ] See tunnel URL: `https://[random].trycloudflare.com`
- [ ] **Copy tunnel URL to clipboard** 📋

### Verify Local Access
- [ ] Open browser: `http://localhost:3000`
- [ ] Frontend loads successfully
- [ ] Sidebar shows navigation items
- [ ] Runtime section visible

### Verify Debug Dashboard
- [ ] Open: `http://localhost:3000/debug`
- [ ] Page loads successfully
- [ ] See "Environment Configuration" section
- [ ] See "Agent Runtime State" section
- [ ] All status cards display

---

## ⚙️ Configuration

### ChakraHQ Webhooks
- [ ] Open ChakraHQ dashboard
- [ ] Find webhook configuration section
- [ ] Set Customer Webhook URL: `https://YOUR-TUNNEL-URL/api/webhook/customer`
  - [ ] Paste tunnel URL from clipboard
  - [ ] Add `/api/webhook/customer` to the end
  - [ ] No trailing slash
- [ ] Set Owner Webhook URL: `https://YOUR-TUNNEL-URL/api/webhook/owner`
  - [ ] Same tunnel URL
  - [ ] Add `/api/webhook/owner` to the end
- [ ] Set Webhook Secret: (from `.env.local` file)
  - [ ] Open `.env.local`
  - [ ] Find `WEBHOOK_SECRET=...`
  - [ ] Copy the value
  - [ ] Paste into ChakraHQ
- [ ] **Click Save** in ChakraHQ

### Test Webhook Connection
- [ ] Open new terminal/PowerShell
- [ ] Run: `curl "https://YOUR-TUNNEL-URL/api/webhook/customer?hub.challenge=test"`
- [ ] Response received: `test`
- [ ] If error, check tunnel URL is correct

### Enable Ravi AI
- [ ] Open: `http://localhost:3000`
- [ ] Look at sidebar "Runtime" section
- [ ] Enable switch: **Agent** ✅
- [ ] Enable switch: **Ravi standby** ✅
- [ ] Enable switch: **Auto reply** ✅
- [ ] Enable switch: **Sales mode** ✅ (optional)
- [ ] All switches turn green

### Verify Configuration
- [ ] Open: `http://localhost:3000/debug`
- [ ] **Environment Configuration:**
  - [ ] ChakraHQ API: ✅ Green
  - [ ] Sarvam AI: ✅ Green
  - [ ] Owner Phone: ✅ Green (shows 919455281616)
  - [ ] Webhook Secret: ✅ Green (shows ***set***)
- [ ] **Agent Runtime State:**
  - [ ] Agent Enabled: ✅ Green
  - [ ] Ravi Enabled: ✅ Green
  - [ ] Auto Send Replies: ✅ Green
  - [ ] Outbound Sales: ✅ Green (if enabled)

---

## 🧪 Testing

### Send Test Message
- [ ] Pick up phone with number: 919455281616
- [ ] Open WhatsApp
- [ ] Start chat with: +1 (555) 951-8329
- [ ] Send message: "Hi, I need bags"
- [ ] Message sent successfully

### Verify Webhook Received
- [ ] Open: `http://localhost:3000/debug`
- [ ] Scroll to **"Webhook Events"** section
- [ ] See new event with type: `customer_inbound` 🟦
- [ ] Event timestamp is recent (within last minute)
- [ ] Event payload shows:
  - [ ] phone: "919455281616"
  - [ ] text: "Hi, I need bags"

### Verify Customer Created
- [ ] Still in debug dashboard
- [ ] Scroll to **"Customers"** section
- [ ] See row with phone: 919455281616
- [ ] Customer has name and stage
- [ ] Message count > 0

### Verify Message Saved
- [ ] Still in debug dashboard
- [ ] Scroll to **"Recent Messages"** section
- [ ] See message from 919455281616
- [ ] Role badge: `user` 🟦
- [ ] Content: "Hi, I need bags"
- [ ] Timestamp is recent

### Verify Ravi Processed
- [ ] Scroll back to **"Webhook Events"**
- [ ] See event with type: `ravi_processed` 🟢
- [ ] Event shows Ravi's response

### Verify Reply Sent
- [ ] Check WhatsApp on phone
- [ ] See reply from +1 (555) 951-8329
- [ ] Reply is in Hindi/Hinglish (Ravi's style)
- [ ] Reply makes sense for the query

### Verify Frontend
- [ ] Open: `http://localhost:3000`
- [ ] Click **"Chats"** in sidebar
- [ ] See customer: 919455281616 in list
- [ ] Click on customer
- [ ] See conversation with 2+ messages
- [ ] Your message visible
- [ ] Ravi's response visible

---

## 🎯 Success Validation

### All Green Indicators
- [ ] Debug dashboard Environment: 4/4 green ✅✅✅✅
- [ ] Debug dashboard Agent State: 4/4 green ✅✅✅✅
- [ ] No red indicators anywhere

### Data Flow Complete
- [ ] WhatsApp message sent ✅
- [ ] Webhook received ✅
- [ ] Customer created ✅
- [ ] Message saved ✅
- [ ] Ravi processed ✅
- [ ] Reply generated ✅
- [ ] Reply sent ✅
- [ ] WhatsApp reply received ✅
- [ ] Frontend updated ✅

### Monitoring Working
- [ ] Debug dashboard accessible ✅
- [ ] Auto-refreshes every 5 seconds ✅
- [ ] Shows real-time data ✅
- [ ] All sections displaying correctly ✅

---

## 🐛 Troubleshooting (If Any Red ❌)

### ❌ Cloudflared not installed
**Fix:**
```powershell
winget install --id Cloudflare.cloudflared
```
Close PowerShell, reopen, try again.

---

### ❌ Tunnel starts but no webhook events
**Check:**
1. [ ] Tunnel URL in ChakraHQ matches exactly
2. [ ] URL ends with `/api/webhook/customer`
3. [ ] No trailing slash
4. [ ] Webhook secret matches

**Test:**
```powershell
curl "https://YOUR-TUNNEL-URL/api/webhook/customer?hub.challenge=test"
```
Should return: `test`

---

### ❌ Environment indicators red
**Fix:**
1. [ ] Open `.env.local`
2. [ ] Check all required keys exist:
   - `CHAKRA_API_KEY`
   - `CHAKRA_BUSINESS_NUMBER`
   - `SARVAM_API_KEY`
   - `OWNER_PHONE`
   - `WEBHOOK_SECRET`
3. [ ] Save file
4. [ ] Restart: `.\start-with-tunnel.bat`

---

### ❌ Agent state indicators red
**Fix:**
1. [ ] Go to: `http://localhost:3000`
2. [ ] Look at sidebar "Runtime" section
3. [ ] Click all switches ON (green)
4. [ ] Check debug dashboard again

---

### ❌ Webhook received but no customer
**Check:**
1. [ ] Visit: `http://localhost:3000/api/customers`
2. [ ] See if customer in JSON
3. [ ] Check database: `sqlite3 data\sales_agent.db "SELECT * FROM customers;"`

**Fix:** Usually means database is locked or permissions issue. Restart system.

---

### ❌ Customer created but Ravi didn't respond
**Check:**
1. [ ] Debug dashboard → Agent State → all green?
2. [ ] Debug dashboard → Environment → Sarvam AI green?
3. [ ] Webhook Events → see `ravi_processed`?

**Fix:**
- If no `ravi_processed` event, enable Ravi in Runtime section
- If `ravi_skipped_disabled` event, enable Auto reply

---

### ❌ Ravi responded but WhatsApp not received
**Check:**
1. [ ] Debug dashboard → Auto Send Replies: green?
2. [ ] Recent Messages → see Ravi's message?
3. [ ] Phone number correct? (919455281616)

**Fix:** Enable "Auto reply" in Runtime section

---

## 📊 Post-Deployment

### Keep Running
- [ ] Don't close tunnel terminal window
- [ ] System must stay running for webhooks to work
- [ ] If computer restarts, run `.\start-with-tunnel.bat` again

### Monitor Regularly
- [ ] Check debug dashboard daily
- [ ] Monitor customer conversations
- [ ] Review Ravi's responses
- [ ] Check webhook event log

### Update Tunnel URL
- [ ] Each time you restart, tunnel URL changes
- [ ] Copy new URL
- [ ] Update ChakraHQ webhooks
- [ ] Test again

### Optional: Persistent Tunnel
For permanent URL that doesn't change:
- [ ] Create Cloudflare account (free)
- [ ] Login: `cloudflared tunnel login`
- [ ] Create tunnel: `cloudflared tunnel create flowzint-sales`
- [ ] Follow Cloudflare docs for routing
- [ ] Get permanent subdomain

---

## 🎉 Completion

**All checkboxes marked?** ✅

**Congratulations! Your WhatsApp AI agent is live! 🚀**

---

## 📞 Quick Reference

| Item | Value |
|------|------|
| **Project Path** | `c:\Users\Nikhil1616\Desktop\Sales_Agent\SALES_AGENT\flowzint-ai-sales-os` |
| **Start Command** | `.\start-with-tunnel.bat` |
| **Frontend** | http://localhost:3000 |
| **Debug Dashboard** | http://localhost:3000/debug |
| **Business Number** | +1 (555) 951-8329 |
| **Test Phone** | 919455281616 |
| **Customer Webhook** | `https://TUNNEL-URL/api/webhook/customer` |
| **Owner Webhook** | `https://TUNNEL-URL/api/webhook/owner` |
| **Debug API** | `https://TUNNEL-URL/api/debug/webhooks` |

---

## 📚 Documentation

- **This Checklist:** `DEPLOYMENT_CHECKLIST.md`
- **Quick Start (5 min):** `QUICK_START_WHATSAPP.md`
- **Complete Guide:** `WHATSAPP_INTEGRATION_FIX.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`
- **Tunnel Setup:** `TUNNEL_SETUP_GUIDE.md`

---

**Date Deployed:** _________________

**Tunnel URL Used:** _________________

**Notes:** 
```


```

---

**Keep this checklist for future deployments! 📋**
