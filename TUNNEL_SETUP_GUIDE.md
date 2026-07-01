# 🌐 Cloudflare Tunnel Setup Guide

## Problem
ChakraHQ webhooks cannot reach `http://localhost:3000/api/webhook/customer` because localhost is not publicly accessible. We need to expose the backend to the internet.

## Solution
Use Cloudflare Tunnel (free) to create a secure public URL that forwards to your localhost.

---

## Step 1: Install Cloudflared

### Option A: Using winget (Recommended for Windows)
```bash
winget install --id Cloudflare.cloudflared
```

### Option B: Manual Download
1. Go to https://github.com/cloudflare/cloudflared/releases
2. Download `cloudflared-windows-amd64.exe`
3. Rename it to `cloudflared.exe`
4. Move it to a folder in your PATH (e.g., `C:\Windows\System32`)

### Verify Installation
```bash
cloudflared --version
```

You should see the version number if installed correctly.

---

## Step 2: Start the Application with Tunnel

### Easy Method: Use the Startup Script
```bash
cd c:\Users\Nikhil1616\Desktop\Sales_Agent\SALES_AGENT\anjani-ai-sales-os
.\start-with-tunnel.bat
```

This script will:
1. Check if cloudflared is installed
2. Start the Next.js dev server on port 3000
3. Start the Cloudflare tunnel
4. Display your public URL

### Manual Method (Alternative)

Terminal 1 - Start Next.js:
```bash
npm run dev
```

Terminal 2 - Start Cloudflare Tunnel:
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## Step 3: Configure ChakraHQ Webhooks

1. When the tunnel starts, you'll see output like:
   ```
   Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
   https://abc-def-ghi-jkl.trycloudflare.com
   ```

2. Copy the `https://` URL (it will be different each time)

3. Go to ChakraHQ Dashboard:
   - **Customer Webhook URL**: `https://YOUR-TUNNEL-URL/api/webhook/customer`
   - **Owner Webhook URL**: `https://YOUR-TUNNEL-URL/api/webhook/owner`
   - **Webhook Secret**: Use the value from your `.env.local` file

4. Save the webhook configuration

---

## Step 4: Test the Integration

### 4.1 Check Debug Endpoint
Visit in your browser:
```
https://YOUR-TUNNEL-URL/api/debug/webhooks
```

This will show:
- Last 20 webhook events received
- All customers in the database
- Recent messages
- Agent state (Ravi enabled, auto-reply, etc.)
- Environment configuration

### 4.2 Send a Test Message
1. From your phone (919455281616), send a WhatsApp message to: **+1 (555) 951-8329**
2. Message example: "Hi, I need 18 inch bags"

### 4.3 Verify in the System

**Check the debug endpoint:**
```
https://YOUR-TUNNEL-URL/api/debug/webhooks
```

You should see:
- New webhook event in `webhookLog`
- New customer entry (919455281616)
- Chat messages from both user and Ravi AI

**Check the frontend:**
1. Open http://localhost:3000
2. Click on "Chats" in the sidebar
3. You should see your customer (919455281616) in the list
4. Click on it to view the conversation

---

## Step 5: Verify Ravi AI Responds

1. Check that all agent flags are enabled in the frontend:
   - Agent: ON
   - Ravi standby: ON
   - Auto reply: ON
   - Sales mode: ON (optional)

2. Send another message from 919455281616

3. Check the debug endpoint to see:
   - `ravi_processed` event in the webhook log
   - Ravi's response message in chat_messages

4. You should receive Ravi's reply on WhatsApp

---

## Important Notes

### Tunnel URL Changes
The free Cloudflare tunnel generates a **new random URL each time** you start it. You'll need to:
1. Update the ChakraHQ webhook configuration with the new URL each time
2. Or use a persistent tunnel (requires Cloudflare account - see below)

### Persistent Tunnel (Optional)
For a permanent URL that doesn't change:

1. Create a Cloudflare account (free)
2. Login via CLI:
   ```bash
   cloudflared tunnel login
   ```
3. Create a named tunnel:
   ```bash
   cloudflared tunnel create anjani-sales
   ```
4. Configure and route the tunnel (follow Cloudflare docs)

This gives you a permanent subdomain like `anjani-sales.yourname.workers.dev`

### Keeping the Tunnel Running
- The tunnel must stay running for webhooks to work
- Don't close the terminal window
- If you restart your computer, run `start-with-tunnel.bat` again
- The tunnel URL will change, so update ChakraHQ webhooks

---

## Troubleshooting

### "cloudflared not found"
- Install cloudflared using one of the methods in Step 1
- Restart your terminal after installation
- Check PATH: `echo %PATH%`

### "Cannot connect to localhost:3000"
- Make sure Next.js dev server is running first
- Check if port 3000 is available: `netstat -ano | findstr :3000`
- Try a different port in `package.json` if 3000 is busy

### Webhooks not received
1. Check the tunnel is running and URL is correct
2. Verify ChakraHQ webhook configuration matches your tunnel URL exactly
3. Check webhook secret matches `.env.local`
4. Visit the debug endpoint to see if ANY webhooks are being received
5. Check `data/runtime/message-log.json` for raw webhook events

### Customer not appearing in frontend
1. Check `/api/customers` endpoint directly: `https://YOUR-TUNNEL-URL/api/customers`
2. Check the database: `data/sales_agent.db`
3. Look for errors in console and `dev-server.err.log`
4. Verify the webhook handler created the customer record

### Ravi not responding
1. Check agent state: Visit debug endpoint or click "Runtime" section in sidebar
2. Ensure all flags are enabled:
   - `agentEnabled: true`
   - `raviEnabled: true`
   - `autoSendRaviReplies: true`
3. Check `.env.local` has:
   - `SARVAM_API_KEY`
   - `CHAKRA_API_KEY`
   - `CHAKRA_BUSINESS_NUMBER`
4. Look for `ravi_processed` events in message log

---

## Quick Reference

**Start the system:**
```bash
.\start-with-tunnel.bat
```

**Check debug info:**
```
https://YOUR-TUNNEL-URL/api/debug/webhooks
```

**Webhook endpoints:**
- Customer: `https://YOUR-TUNNEL-URL/api/webhook/customer`
- Owner: `https://YOUR-TUNNEL-URL/api/webhook/owner`

**Local frontend:**
```
http://localhost:3000
```

**ChakraHQ Business Number:**
```
+1 (555) 951-8329
```

**Test/Owner Phone:**
```
919455281616
```

---

## Next Steps

Once everything is working:

1. ✅ Send messages from your phone to the business number
2. ✅ See them appear in the frontend customer list
3. ✅ View conversations in the chat workspace
4. ✅ Watch Ravi AI respond automatically
5. ✅ Use the debug endpoint to monitor webhook events
6. ✅ Check knowledge base and activity feed for AI intelligence

**You're all set! 🚀**
