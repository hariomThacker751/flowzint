# 🚀 QUICK REFERENCE GUIDE

## How the System Works Now

### 📱 MESSAGE ROUTING

```
┌─────────────────────────────────────────────┐
│  WhatsApp Message Received                  │
└─────────────────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   From phone number   │
         └──────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
  +919924102678          Any other number
   (Owner Phone)          (Customer)
        │                       │
        ▼                       ▼
   GURU AI                 RAVI AI
(Internal Assistant)  (Customer-facing Owner)
        │                       │
        ▼                       ▼
 Business Management      Customer Service
 - Learn knowledge         - Sales inquiries
 - Answer owner           - Quote requests
 - Store pricing          - Product info
 - Manage production      - Natural conversation
```

---

## 🎭 RAVI AI (Customer Agent)

### Who is Ravi?
- **Identity**: Puneet, the owner of Flowzint Interweave
- **Never reveals**: That he's AI/bot/chatbot
- **Personality**: Warm Gujarati businessman, efficient but friendly
- **Style**: Short WhatsApp messages (1-2 sentences)

### Language Rules
| Customer Says | Ravi Replies In |
|--------------|----------------|
| "Hello" | Pure English |
| "Haan bhai!" | Hinglish |
| "Can I get..." | Pure English |
| "Kya kaam hai?" | Hinglish/Hindi |
| "नमस्ते" | Hindi |

### Example Conversations

**English Customer:**
```
Customer: Hello
Ravi: Hey! What can I help you with?

Customer: I want to buy bags
Ravi: Great! What size and quantity?
```

**Hinglish Customer:**
```
Customer: Haan bhai, bol na! Kya kaam hai?
Ravi: Haan bhai! Bags chahiye kya?

Customer: Kitne ka milega?
Ravi: Size aur quantity batao, main rate bata deta hoon
```

---

## 👔 GURU AI (Owner Assistant)

### Who is Guru?
- **Identity**: Internal business intelligence system
- **Talks to**: Only Puneet (the owner)
- **Purpose**: Learn and manage business knowledge

### What Guru Does
1. **Learns** from owner: pricing, stock, production capacity
2. **Stores** business knowledge in structured format
3. **Answers** owner's business questions
4. **Manages** production schedules and capacity

### Example Owner Conversation
```
Puneet: Bhai, 24 inch Regular ka meter weight 3.2g hai

Guru: ✅ Stored! I'll tell customers:
      24 inch Regular box has 3.2g meter weight.

Puneet: Customer ne 20 inch silver quality manga hai, stock hai?

Guru: Let me check production capacity...
      [Checks database and responds]
```

---

## 🔧 CONFIGURATION

### Environment Variables (.env.local)
```bash
# Owner phone - Routes to Guru AI
OWNER_PHONE=919924102678

# ChakraHQ Config
CHAKRA_API_KEY=your_key_here
CHAKRA_PLUGIN_ID=your_plugin_id
CHAKRA_PHONE_ID=your_phone_id

# Sarvam AI (LLM)
SARVAM_API_KEY=your_sarvam_key
SARVAM_MODEL=sarvam-105b

# Tunnel URL (for webhooks)
NEXT_PUBLIC_TUNNEL_URL=your_tunnel_url
```

### Webhook Endpoints
- **Customer Webhook**: `https://your-domain/api/webhook/customer`
- **Owner Webhook**: `https://your-domain/api/webhook/owner`

---

## 🎯 KEY FEATURES

### ✅ No Double Replies
- Owner messages filtered in customer webhook
- Each message processed exactly once

### ✅ Language Detection
- Automatically detects customer's language
- Replies in the same language
- 40+ Hindi/Hinglish word indicators

### ✅ Human-Like Responses
- Varies greetings naturally
- Short, WhatsApp-style messages
- Never sounds robotic
- Matches owner's personality

### ✅ Owner Routing
- Puneet's messages → Guru AI
- All other messages → Ravi AI
- Clean separation of concerns

---

## 🧪 TESTING COMMANDS

### Test Language Detection
```
Message: "Hello"
Expected: English reply

Message: "Haan bhai"  
Expected: Hinglish reply

Message: "I want bags"
Expected: Pure English reply
```

### Test Owner Routing
```
From: +919924102678
Expected: Guru AI responds (internal tone)

From: Any other number
Expected: Ravi AI responds (as owner)
```

### Check for Double Replies
```
Send any message
Expected: Exactly 1 reply
Check: Logs should show only 1 webhook processed it
```

---

## 📊 MONITORING

### Check Agent State
```
Visit: http://localhost:3000
Check sidebar: Agent status indicators
```

### View Logs
```
API endpoint: /api/agent/state
Returns: Recent logs and agent state
```

### Check Runtime Settings
- **agentEnabled**: Master switch
- **raviEnabled**: Customer agent
- **autoSendRaviReplies**: Auto-send vs draft
- **outboundSalesEnabled**: Proactive outreach

---

## 🚨 TROUBLESHOOTING

### Issue: Double replies still happening
**Check:**
1. Is OWNER_PHONE set correctly? `919924102678` (no + or spaces)
2. Did you restart the server after changing .env?
3. Are both webhooks configured in ChakraHQ?

**Fix:** Restart with `npm run dev`

---

### Issue: Wrong language responses
**Check:**
1. What language was detected? (check logs)
2. Is customer message ambiguous?

**Fix:** 
- Use more explicit Hindi words for Hinglish
- Pure English should have no Hindi mixing
- System defaults to English for ambiguous cases

---

### Issue: Owner messages going to Ravi
**Check:**
1. OWNER_PHONE in .env.local: `919924102678`
2. Phone format: no +, no spaces, just digits
3. Server restarted after env change?

**Fix:**
```bash
# Stop server (Ctrl+C)
# Restart
npm run dev
```

---

## 💡 TIPS FOR BEST RESULTS

1. **Teach Guru First**: Have Puneet teach Guru about pricing, stock, common questions
2. **Monitor Early**: Watch first few customer conversations to tune responses
3. **Use Clear Language**: Customers should use clear English OR clear Hindi/Hinglish
4. **Check Logs**: Regularly review logs to catch issues early
5. **Update Knowledge**: Keep teaching Guru new information as business evolves

---

## 📞 QUICK CONTACTS

| Role | Phone | Agent |
|------|-------|-------|
| Puneet (Owner) | +91 99241 02678 | Guru AI |
| Customers | All other numbers | Ravi AI |

---

**System Status: ✅ OPERATIONAL**
**Last Updated: June 9, 2026**
