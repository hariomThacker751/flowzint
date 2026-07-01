# 🧪 STEP-BY-STEP TESTING GUIDE

## ⚠️ IMPORTANT: DO THIS FIRST

### Step 0: Restart Your Server
The environment variable `OWNER_PHONE` was just added. You MUST restart the server for it to load.

```bash
# In your terminal where the server is running:
# 1. Stop the server: Press Ctrl+C

# 2. Restart the server:
npm run dev

# 3. Wait for it to say "Ready" or show the URL
```

**Why?** Environment variables are loaded only when the server starts. Changes to `.env.local` won't take effect until you restart.

---

## 📋 TEST PLAN

### ✅ Test 1: No More Double Replies

**What to test:** Ensure only 1 reply is sent per message

**Steps:**
1. Send a message from ANY customer phone (not Puneet's)
2. Example: "Hello"
3. Count the replies

**Expected Result:**
- ✅ Exactly **1 reply** from Ravi
- ❌ NOT 2 replies

**If it fails:**
- Check if server was restarted
- Check both webhooks are configured correctly
- Review logs at http://localhost:3000 → Check "Activity" or "Logs"

---

### ✅ Test 2: Language Detection - English

**What to test:** English customers get English replies

**Steps:**
1. Send: `"Hello"`
2. Wait for reply

**Expected Reply Examples:**
- ✅ "Hey! What can I help you with?"
- ✅ "Hi! Looking for bags?"
- ✅ "Hello! What do you need?"

**Should NOT contain:**
- ❌ "Haan bhai"
- ❌ "kya chahiye"
- ❌ Any Hindi words

**Try more English messages:**
```
"I want to buy bags"
Expected: "Great! What size and quantity?" (or similar, in English)

"Can you help me?"
Expected: "Sure! What do you need?" (or similar, in English)

"Do you have 20 inch bags?"
Expected: English reply about checking stock
```

---

### ✅ Test 3: Language Detection - Hinglish

**What to test:** Hinglish customers get Hinglish replies

**Steps:**
1. Send: `"Haan bhai, bol na! Kya kaam hai?"`
2. Wait for reply

**Expected Reply Examples:**
- ✅ "Haan bhai! Bags chahiye kya?"
- ✅ "Ji boliye! Kya kaam hai?"
- ✅ "Haan, bolo bhai!"

**Should contain Hindi/Hinglish words like:**
- ✅ "bhai", "haan", "kya", "chahiye", "theek"

**Try more Hinglish messages:**
```
"hello bhai"
Expected: Hinglish reply like "Haan bhai, bolo!"

"Kitne ka milega?"
Expected: Hinglish reply asking for details

"20 inch bags chahiye"
Expected: Hinglish reply asking quantity
```

---

### ✅ Test 4: Language Detection - Pure Hindi

**What to test:** Hindi script gets Hindi reply

**Steps:**
1. Send: `"नमस्ते"`
2. Wait for reply

**Expected Reply:**
- ✅ Reply in Hindi (Devanagari or Hinglish)
- Example: "नमस्ते! कैसे मदद कर सकता हूं?" OR "Namaste! Kya chahiye?"

---

### ✅ Test 5: Response Variety

**What to test:** Ravi doesn't repeat the same greeting

**Steps:**
1. Send "Hello" from one customer
2. Send "Hello" from a different customer (or wait 5 minutes)
3. Send "Hello" from another customer

**Expected Result:**
- ✅ Each greeting should be DIFFERENT
- Examples:
  - First: "Hey! What can I help you with?"
  - Second: "Hi! Looking for bags?"
  - Third: "Hello! What do you need?"

**Should NOT happen:**
- ❌ All three replies are identical

---

### ✅ Test 6: Owner Routing (Puneet → Guru)

**What to test:** Messages from Puneet's phone go to Guru AI

**Requirements:**
- Must send from phone: **+91 99241 02678**
- This is Puneet's configured owner phone

**Steps:**
1. Send message from +91 99241 02678
2. Example: "Hello" or "Guru, can you help?"

**Expected Result:**
- ✅ Guru AI responds (internal business tone)
- ✅ More professional/structured replies
- ✅ May mention storing knowledge, checking data, etc.

**Should NOT happen:**
- ❌ Ravi (customer agent) responds
- ❌ Gets same casual "Haan bhai" style reply

**Example Guru Reply Style:**
```
Puneet: "What's our stock level?"
Guru: "Let me check the production database..."
      [Professional, data-focused response]
```

---

### ✅ Test 7: Customer Routing (Everyone Else → Ravi)

**What to test:** All non-owner phones get Ravi AI

**Steps:**
1. Send message from ANY phone number that's NOT +919924102678
2. Example phones to test:
   - +91 98765 43210
   - +91 11111 11111
   - Any customer number

**Expected Result:**
- ✅ Ravi AI responds (as owner, customer-facing)
- ✅ Warm, casual tone
- ✅ Language matches customer's message
- ✅ Short WhatsApp-style replies

**Example Ravi Reply Style:**
```
Customer: "I need bags"
Ravi: "Great! What size and quantity?"

Customer: "Bags chahiye"
Ravi: "Haan bhai! Size aur quantity batao?"
```

---

### ✅ Test 8: Human-Like Tone

**What to test:** Ravi sounds like a real person, not a bot

**Steps:**
1. Have a short conversation (3-4 messages)
2. Example:
   ```
   You: "Hello"
   Ravi: ?
   
   You: "I want bags"
   Ravi: ?
   
   You: "20 inch"
   Ravi: ?
   ```

**Expected Characteristics:**
- ✅ Short replies (1-2 sentences)
- ✅ Natural flow
- ✅ Asks ONE question at a time
- ✅ Feels like WhatsApp chat, not email
- ✅ NEVER says "I am AI" or "I am Ravi" or "I'm a bot"

**Red Flags (Should NOT happen):**
- ❌ "As an AI assistant, I can help..."
- ❌ "I am Ravi AI, your virtual agent..."
- ❌ Long paragraphs
- ❌ Multiple questions in one message
- ❌ Formal language like "Dear customer..."

---

### ✅ Test 9: Knowledge Escalation

**What to test:** When Ravi doesn't know something, he handles it gracefully

**Steps:**
1. Ask a specific question Ravi might not know:
   ```
   "What's the price of 24 inch silver quality bags?"
   ```

**Expected Result:**
- ✅ Ravi says he'll check
- ✅ In customer's language:
  - English: "Let me check and get back to you in a moment!"
  - Hinglish: "Haan, abhi check karke batata hoon. Ek minute."

**Should NOT happen:**
- ❌ "Checking the database..."
- ❌ "Verifying in the system..."
- ❌ Makes up a price
- ❌ Says "I don't have that information" (too robotic)

---

## 🔍 HOW TO CHECK LOGS

### View in Browser:
1. Open http://localhost:3000
2. Go to "Activity" section (left sidebar)
3. Look for recent logs

### Check for These Log Types:
```
customer_inbound          - Message received from customer
customer_webhook_ignored_owner - Owner message filtered (good!)
owner_inbound            - Message received from owner
ravi_processed           - Ravi successfully replied
guru_reply              - Guru successfully replied
ravi_sarvam_error       - Error in AI processing (investigate)
```

---

## ✅ SUCCESS CRITERIA

All tests should pass with these results:

- [ ] Only 1 reply per message (no doubles)
- [ ] English customers get pure English replies
- [ ] Hinglish customers get Hinglish replies
- [ ] Responses vary (not repetitive)
- [ ] Puneet's phone → Guru AI (professional tone)
- [ ] Other phones → Ravi AI (casual owner tone)
- [ ] Short, natural messages (1-2 sentences)
- [ ] Never reveals being AI/bot
- [ ] Handles unknown info gracefully

---

## 🚨 IF TESTS FAIL

### Problem: Still getting double replies
**Fix:**
1. Restart server (Ctrl+C, then `npm run dev`)
2. Check OWNER_PHONE in .env.local: `919924102678`
3. Verify both webhooks configured in ChakraHQ

---

### Problem: Wrong language (English to Hinglish question)
**Fix:**
1. Make customer message more explicit
2. Use clear Hindi words: "bhai", "kya", "haan", etc.
3. Check logs to see what language was detected
4. Pure greetings like "Hello" default to English (by design)

---

### Problem: Owner messages going to Ravi
**Fix:**
1. Check .env.local has: `OWNER_PHONE=919924102678`
2. Phone must be EXACTLY: `919924102678` (no +, no spaces)
3. **Restart server** after any .env changes
4. Check owner webhook URL in ChakraHQ

---

### Problem: Still sounds robotic
**Fix:**
1. Check if you're testing in English or Hinglish
2. Ravi is more casual in Hinglish ("Haan bhai!")
3. English mode is professional but warm
4. This is expected behavior — matches customer's formality level

---

## 📞 TESTING CHECKLIST

Print this and check off as you test:

```
[ ] Restart server
[ ] Test 1: No double replies
[ ] Test 2: English detection
[ ] Test 3: Hinglish detection  
[ ] Test 4: Hindi detection
[ ] Test 5: Response variety
[ ] Test 6: Owner routing (Puneet → Guru)
[ ] Test 7: Customer routing (Others → Ravi)
[ ] Test 8: Human-like tone
[ ] Test 9: Knowledge escalation

[ ] All tests passed? ✅
[ ] Any issues found? Document them
[ ] Ready for production? 🚀
```

---

## 🎉 AFTER TESTING

If all tests pass:
1. ✅ System is ready for real customers
2. ✅ Monitor first few conversations closely
3. ✅ Have Puneet teach Guru common questions
4. ✅ Adjust as needed based on real usage

If some tests fail:
1. ❌ Review the specific failing test above
2. ❌ Check the "IF TESTS FAIL" section
3. ❌ Review logs for errors
4. ❌ Ask for help if needed

---

**Good luck with testing! 🚀**
