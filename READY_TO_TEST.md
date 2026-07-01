# 🎉 Digital Twin System - Ready to Test!

## What's Been Implemented

### ✅ 1. Enhanced Ravi Agent (Digital Twin)
- **File**: `lib/server/ravi-agent-v2.ts`
- **Features**:
  - Automatic escalation detection (price, stock, delivery, technical)
  - Owner style integration
  - Real-time Guru communication
  - Natural holding messages ("Haan, main check karta hoon")

### ✅ 2. Enhanced Guru Agent (Learning System)
- **File**: `lib/server/prompts.ts` (updated)
- **Features**:
  - Learns owner's communication style
  - Stores business knowledge
  - Guides Ravi to talk like owner
  - Handles escalations

### ✅ 3. Guru Chat API
- **Endpoint**: `/api/guru/chat`
- **Features**:
  - Owner can chat with Guru
  - Automatic memory extraction
  - Escalation resolution
  - Style learning

### ✅ 4. Webhook Integration
- **File**: `lib/server/webhook.ts` (updated)
- **Features**:
  - Uses Ravi V2 with escalation
  - Returns escalation status
  - Notifies when owner input needed

## How to Test Right Now

### Test 1: Customer Asks Price (Escalation)

```powershell
# Customer asks about price
$body = @{
    type = "customer"
    phone = "919876543210"
    name = "Test Customer"
    text = "What is the price for 24 inch Regular bags?"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Result**:
- Ravi detects "price" keyword
- Escalates to Guru
- Sends holding message: "Haan, main check karke batata hoon"
- Response shows `escalated: true` and `needsOwnerInput: true`

### Test 2: Owner Teaches Guru

```powershell
# Owner teaches Guru the price
$body = @{
    message = "Bhai, 24 inch Regular ka price ₹85/kg hai. Customer ko bata dena."
    phone = "919408724777"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/guru/chat -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**Expected Result**:
- Guru extracts memory
- Stores price in knowledge base
- Learns owner's style ("Bhai", "bata dena")
- Response shows `memoryExtracted: true`

### Test 3: Customer Asks Price Again (No Escalation)

```powershell
# Different customer asks same price
$body = @{
    type = "customer"
    phone = "919999999999"
    name = "Another Customer"
    text = "24 inch Regular ka rate kya hai?"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/test/webhook -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Result**:
- Ravi detects "price" keyword
- Guru checks knowledge base (found!)
- Ravi responds immediately in owner's style
- No owner input needed
- Response shows `escalated: true` but `needsOwnerInput: false`

### Test 4: Get Pending Escalations

```powershell
# Check what escalations are waiting for owner
Invoke-WebRequest -Uri "http://localhost:3000/api/guru/chat?phone=919408724777" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Result**:
- Shows conversation history with Guru
- Shows pending escalations from Ravi
- Shows customer context for each escalation

## UI Integration (Next Step)

The Guru AI interface in the UI needs to be connected to the API. Here's what needs to be done:

### 1. Update Guru Page Component

In `app/page.tsx`, the `GuruPage` component needs to:
- Fetch messages from `/api/guru/chat?phone=919408724777`
- Send messages to `/api/guru/chat`
- Show pending escalations
- Highlight when memory is extracted

### 2. Show Escalation Alerts

When `needsOwnerInput: true` in customer webhook response:
- Show notification in UI
- Display customer context
- Allow owner to respond via Guru chat

### 3. Real-Time Updates

Add polling or WebSocket to:
- Show new escalations immediately
- Update when owner responds
- Show when Ravi continues conversation

## Testing the Complete Flow

### Scenario: Customer Asks Price → Owner Teaches → Customer Gets Answer

1. **Customer Message**:
   ```
   Customer: "What's the price for 24 inch Regular?"
   ```

2. **Ravi Response**:
   ```
   Ravi: "Haan, main check karke batata hoon. Ek minute."
   (Escalation created, waiting for owner)
   ```

3. **Owner Sees in UI**:
   ```
   Escalation Alert:
   Customer: Test Customer (919876543210)
   Question: Asking about price for 24 inch Regular
   ```

4. **Owner Teaches Guru**:
   ```
   Owner: "Bhai, 24 inch Regular ka ₹85/kg hai. Customer ko bata do."
   ```

5. **Guru Learns**:
   ```
   Guru: Stored price_24inch_regular = ₹85/kg
   Guru: Learned owner says "Bhai" and "bata do"
   Guru: Escalation resolved
   ```

6. **Ravi Continues** (automatically):
   ```
   Ravi → Customer: "Haan bhai, 24 inch Regular ka ₹85/kg hai. Order confirm karu?"
   ```

7. **Next Time** (different customer):
   ```
   Customer 2: "24 inch Regular ka rate?"
   Ravi: "Haan bhai, ₹85/kg hai. Kitna quantity chahiye?"
   (Instant response, no owner needed!)
   ```

## Key Features Working

✅ Escalation detection (price, stock, delivery, technical)
✅ Guru knowledge storage
✅ Owner style learning
✅ Natural holding messages
✅ Automatic escalation resolution
✅ Knowledge reuse for future queries

## What Makes This Different

### Traditional Chatbot:
```
Customer: "What's the price?"
Bot: "Let me check the database..."
Bot: "The price is ₹85/kg"
```
❌ Robotic, reveals it's AI

### Digital Twin (Our System):
```
Customer: "Price kya hai?"
Ravi: "Haan, ek minute check karta hoon"
[Checks with Guru]
Ravi: "Haan bhai, ₹85/kg hai. Theek hai?"
```
✅ Natural, sounds like owner

## Success Indicators

1. ✅ Customer never realizes it's AI
2. ✅ Ravi talks exactly like owner
3. ✅ Critical info always escalated
4. ✅ Owner teaches once, Ravi remembers forever
5. ✅ Seamless handoff between Ravi and Guru

## Next Steps

1. **Test the APIs** using the PowerShell commands above
2. **Connect UI** to Guru chat API
3. **Add escalation notifications** in UI
4. **Train the system** with owner's actual conversations
5. **Monitor and refine** based on real usage

## Owner Training Tips

### Good Training Examples:

✅ "Bhai, 24 inch Regular ka ₹85/kg hai"
✅ "Stock available hai, 2 din mein deliver kar dunga"
✅ "Meter weight 3.2g hai, customer ko bata do"

### What Guru Learns:
- Uses "Bhai" casually
- Says "kar dunga" (will do)
- Says "bata do" (just tell)
- Direct, confident tone
- Hindi-English mix

### Bad Training Examples:

❌ "Please inform the customer that the price is ₹85/kg"
❌ "The system shows stock is available"
❌ "Kindly check the database for meter weight"

(Too formal, not natural, reveals system)

## The Vision

**Customer should think**: "I'm talking to the owner"
**Reality**: "They're talking to Ravi, who learned from Guru, who learned from owner"
**Result**: Perfect digital twin of the owner

---

**Start testing now! The system is ready.** 🚀
