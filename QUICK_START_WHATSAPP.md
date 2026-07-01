# ⚡ Quick Start - WhatsApp Integration (5 Minutes)

## 🎯 What You're Doing
Exposing your localhost to the internet so ChakraHQ webhooks can reach your backend.

---

## 📋 Prerequisites
- ✅ Backend configured (`.env.local` has ChakraHQ and Sarvam keys)
- ✅ Database initialized (`data/sales_agent.db` exists)
- ✅ Node.js and npm installed

---

## 🚀 Steps

### 1️⃣ Install Cloudflared (One-Time)
```powershell
winget install --id Cloudflare.cloudflared
```

**Verify:**
```powershell
cloudflared --version
```

---

### 2️⃣ Start the System
```powershell
cd c:\Users\Nikhil1616\Desktop\Sales_Agent\SALES_AGENT\flowzint-ai-sales-os
.\start-with-tunnel.bat
```

**Wait for:**
```
Your quick Tunnel has been created! Visit it at:
https://abc-xyz-123.trycloudflare.com
```

**Copy this URL!** 📋

---

### 3️⃣ Configure ChakraHQ Webhooks

In ChakraHQ dashboard, set:

**Customer Webhook:**
```
https://YOUR-TUNNEL-URL/api/webhook/customer
```

**Owner Webhook:**
```
https://YOUR-TUNNEL-URL/api/webhook/owner
```

**Webhook Secret:** (from `.env.local`)
```
Your WEBHOOK_SECRET value
```

**Save the configuration!**

---

### 4️⃣ Enable Ravi AI

Open: http://localhost:3000

In the sidebar **"Runtime"** section, enable:
- ✅ Agent
- ✅ Ravi standby
- ✅ Auto reply
- ✅ Sales mode (optional)

---

### 5️⃣ Test It!

**Open Debug Dashboard:**
```
http://localhost:3000/debug
```

**Send WhatsApp:**
- From: **919455281616**
- To: **+1 (555) 951-8329**
- Message: "Hi, I need bags"

**Watch Debug Dashboard:**
- New webhook event appears ✅
- Customer (919455281616) appears ✅
- Your message appears ✅
- Ravi's response appears ✅
- WhatsApp reply received ✅

---

### 6️⃣ View in Frontend

Open: http://localhost:3000

Click **"Chats"** → See your customer → Click to view conversation!

---

## 🎉 Done!

You now have:
- ✅ Public webhook URL (via Cloudflare Tunnel)
- ✅ ChakraHQ webhooks configured
- ✅ Ravi AI enabled and responding
- ✅ Customer conversations visible in frontend
- ✅ Real-time monitoring via debug dashboard

---

## 🔍 Monitoring

**Debug Dashboard (Recommended):**
```
http://localhost:3000/debug
```

Shows:
- Webhook events
- Customers
- Messages
- Agent state
- Environment config

Auto-refreshes every 5 seconds!

---

## 📞 Quick Reference

| What | Where |
|------|-------|
| **Business Number** | +1 (555) 951-8329 |
| **Your Phone** | 919455281616 |
| **Frontend** | http://localhost:3000 |
| **Debug** | http://localhost:3000/debug |
| **Tunnel Script** | `.\start-with-tunnel.bat` |

---

## 🐛 Troubleshooting

**Cloudflared not found?**
```powershell
winget install --id Cloudflare.cloudflared
# Close and reopen PowerShell
```

**Webhooks not working?**
1. Check tunnel URL in ChakraHQ matches
2. Test: `curl https://YOUR-TUNNEL-URL/api/webhook/customer?hub.challenge=test`
3. Should return: `test`

**Ravi not responding?**
1. Open http://localhost:3000/debug
2. Check Agent State - all should be green
3. Check Environment - ChakraHQ and Sarvam should be green

**Need detailed help?**
Read: `WHATSAPP_INTEGRATION_FIX.md` (comprehensive guide)

---

## 💡 Pro Tips

1. **Keep tunnel running** - Don't close the terminal
2. **Tunnel URL changes** on each restart - Update ChakraHQ webhooks
3. **Debug dashboard** is your best friend - Check it first when debugging
4. **Message log** is at `data/runtime/message-log.json`
5. **Database** is at `data/sales_agent.db`

---

**Ready to go! 🚀**
