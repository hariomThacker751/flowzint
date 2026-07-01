# Flowzint AI Sales Agent - Testing Guide

## 🚀 Quick Start

Your development server should be running on `http://localhost:3000`

If not, start it with:
```bash
cd flowzint-ai-sales-os
npm run dev
```

## ✅ Test 1: Database Health Check

```bash
curl http://localhost:3000/api/test/db
```

**Expected Response:**
```json
{
  "ok": true,
  "healthy": true,
  "tables": ["activity_log", "chat_messages", "customers", "enquiries", "knowledge_base", "price_config", "production_capacity", "quotes"],
  "counts": {
    "knowledge_base": 7,
    "production_capacity": 1050,
    "price_config": 1
  }
}
```

## ✅ Test 2: Guru Agent (Owner Learning)

### Test 2a: Send a fact to Guru
```bash
curl -X POST http://localhost:3000/api/guru/test \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"919408724777\", \"message\": \"The meter weight for 36 inch 3.0g unlaminated box is 180 grams per meter\"}"
```

**What to expect:**
- Guru should extract the memory in structured format
- Memory should be stored in knowledge_base
- Response should include `memoryStored: true`

### Test 2b: Get conversation history
```bash
curl "http://localhost:3000/api/guru/test?phone=919408724777"
```

**What to expect:**
- List of all messages between owner and Guru
- Should show the conversation history

### Test 2c: Send another fact
```bash
curl -X POST http://localhost:3000/api/guru/test \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"919408724777\", \"message\": \"Silver quality box has tensile strength of 1600 N and this is customer visible information\"}"
```

### Test 2d: Send an internal rule
```bash
curl -X POST http://localhost:3000/api/guru/test \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"919408724777\", \"message\": \"If customer orders less than 500 kg, we add 10% premium. This is internal only.\"}"
```

## ✅ Test 3: Knowledge Base

### Test 3a: Query all knowledge
```bash
curl "http://localhost:3000/api/knowledge"
```

### Test 3b: Query customer-visible knowledge only
```bash
curl "http://localhost:3000/api/knowledge?scope=customer_visible"
```

### Test 3c: Query internal-only knowledge
```bash
curl "http://localhost:3000/api/knowledge?scope=internal_only"
```

## ✅ Test 4: Pricing Engine

```bash
curl -X POST http://localhost:3000/api/pricing/calculate \
  -H "Content-Type: application/json" \
  -d "{
    \"sizeInches\": 36,
    \"grammage\": 3.5,
    \"quality\": \"Silver\",
    \"color\": \"White\",
    \"lamination\": \"Regular\",
    \"quantityKg\": 1000
  }"
```

**What to expect:**
- Deterministic price calculation
- Breakdown of base price, premiums, adjustments
- Unit price and total amount

## ✅ Test 5: Production Capacity

### Test 5a: Check delivery feasibility
```bash
curl "http://localhost:3000/api/capacity?start_date=2025-01-20&end_date=2025-02-20"
```

**What to expect:**
- List of capacity records for the date range
- Planned, booked, and available kg for each size/grammage

## ✅ Test 6: Ravi Agent (Customer Conversation)

### Test 6a: Simulate customer webhook
```bash
curl -X POST http://localhost:3000/api/webhook/customer \
  -H "Content-Type: application/json" \
  -d "{
    \"payload\": {
      \"message\": {
        \"from\": \"919876543210\",
        \"type\": \"text\",
        \"text\": { \"body\": \"Hello, I need 36 inch 3.5g silver laminated box\" }
      },
      \"contacts\": [{ \"profile\": { \"name\": \"Test Customer\" } }]
    }
  }"
```

**What to expect:**
- Ravi should respond with a greeting
- Should ask for more details (quantity, color, etc.)
- Response should be in the message

### Test 6b: Continue conversation with more details
```bash
curl -X POST http://localhost:3000/api/webhook/customer \
  -H "Content-Type: application/json" \
  -d "{
    \"payload\": {
      \"message\": {
        \"from\": \"919876543210\",
        \"type\": \"text\",
        \"text\": { \"body\": \"I need 800 kg, regular lamination, white color\" }
      },
      \"contacts\": [{ \"profile\": { \"name\": \"Test Customer\" } }]
    }
  }"
```

### Test 6c: Confirm and request quote
```bash
curl -X POST http://localhost:3000/api/webhook/customer \
  -H "Content-Type: application/json" \
  -d "{
    \"payload\": {
      \"message\": {
        \"from\": \"919876543210\",
        \"type\": \"text\",
        \"text\": { \"body\": \"Yes, please confirm the price and delivery\" }
      },
      \"contacts\": [{ \"profile\": { \"name\": \"Test Customer\" } }]
    }
  }"
```

**What to expect:**
- Ravi should generate a quote
- Quote should include:
  - Size, grammage, quality, color, lamination
  - Quantity
  - Unit price (deterministic, from pricing engine)
  - Total amount
  - Delivery date (from capacity check)
  - Quote validity (7 days)

## ✅ Test 7: Owner Webhook (Guru)

```bash
curl -X POST http://localhost:3000/api/webhook/owner \
  -H "Content-Type: application/json" \
  -d "{
    \"payload\": {
      \"message\": {
        \"from\": \"919408724777\",
        \"type\": \"text\",
        \"text\": { \"body\": \"The HSN code for PP woven box is 5407\" }
      },
      \"contacts\": [{ \"profile\": { \"name\": \"Owner\" } }]
    }
  }"
```

**What to expect:**
- Guru should extract the HSN code fact
- Should store it in knowledge_base
- Should respond confirming the storage

## 🎯 Testing Checklist

### Database Layer
- [x] Health check works
- [x] Seed data works
- [x] All tables created
- [x] Indexes added

### Guru Agent
- [ ] Can process owner messages
- [ ] Extracts memory candidates correctly
- [ ] Stores facts in knowledge_base
- [ ] Distinguishes customer_visible vs internal_only
- [ ] Maintains conversation history
- [ ] Handles escalations

### Ravi Agent
- [ ] Can process customer messages
- [ ] Extracts slots correctly (size, grammage, quality, color, lamination, quantity)
- [ ] Builds knowledge context (customer_visible only)
- [ ] Generates quotes using pricing engine
- [ ] Checks delivery feasibility
- [ ] Maintains conversation history
- [ ] Never hallucinates prices or delivery dates

### Pricing Engine
- [x] Calculates base price correctly
- [x] Applies size premiums
- [x] Applies grammage adjustments
- [x] Applies color premiums
- [x] Applies lamination premiums
- [x] Stores quotes

### Capacity Manager
- [x] Checks delivery feasibility
- [x] Finds earliest available date
- [x] Queries capacity by date range
- [x] Updates capacity

### Knowledge Base
- [x] Stores knowledge entries
- [x] Queries by key
- [x] Queries by pattern
- [x] Filters by scope
- [x] Updates existing entries

### Webhooks
- [ ] Customer webhook receives messages
- [ ] Owner webhook receives messages
- [ ] Signature verification works
- [ ] Message extraction works
- [ ] Agent state checking works
- [ ] Auto-reply works when enabled

### APIs
- [x] Sarvam API with timeout and retry
- [x] ChakraHQ API with retry logic
- [x] Error handling for all APIs

## 🐛 Troubleshooting

### Issue: Guru doesn't extract memory
**Check:**
1. Is the message format clear?
2. Does it contain a fact/rule?
3. Check the Guru system prompt

**Try:**
```bash
curl -X POST http://localhost:3000/api/guru/test \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"919408724777\", \"message\": \"MEMORY_KEY: test_key\nMEMORY_VALUE: test value\nMEMORY_TYPE: fact\nSCOPE: customer_visible\"}"
```

### Issue: Ravi doesn't generate quote
**Check:**
1. Are all slots filled? (size, grammage, quality, color, lamination, quantity)
2. Did customer say "confirm" or similar?
3. Check the conversation history

### Issue: Webhook returns 401
**Check:**
1. Is CHAKRA_WEBHOOK_SECRET set in .env.local?
2. Is the signature being sent correctly?
3. Try without signature verification (set CHAKRA_WEBHOOK_SECRET to empty)

### Issue: Sarvam API timeout
**Check:**
1. Is SARVAM_API_KEY correct?
2. Is internet connection working?
3. Check Sarvam API status

### Issue: Database error
**Check:**
1. Is data directory writable?
2. Is database file corrupted?
3. Try deleting data/sales_agent.db and restarting

## 📊 Expected Results Summary

After running all tests, you should have:

1. **Database:**
   - 8 tables with data
   - Multiple knowledge entries (from Guru tests)
   - Customer records (from Ravi tests)
   - Chat messages (from both agents)
   - Quotes (if Ravi generated any)

2. **Knowledge Base:**
   - Meter weight facts
   - Quality specifications
   - HSN codes
   - Internal rules
   - All properly scoped

3. **Conversation History:**
   - Owner ↔ Guru messages
   - Customer ↔ Ravi messages
   - All persisted in database

4. **Quotes:**
   - Deterministic prices
   - Delivery dates from capacity
   - All components tracked

## 🎉 Success Criteria

Your system is working correctly if:

1. ✅ Guru can learn facts from owner messages
2. ✅ Guru stores them in knowledge_base with correct scope
3. ✅ Ravi can extract customer requirements
4. ✅ Ravi generates quotes using pricing engine (not LLM)
5. ✅ Ravi checks delivery from capacity (not LLM)
6. ✅ All messages are persisted
7. ✅ Webhooks process messages correctly
8. ✅ APIs handle errors gracefully

## 🚀 Next Steps After Testing

1. **Configure ChakraHQ webhooks** to point to your server
2. **Test with real WhatsApp** messages
3. **Monitor activity_log** for all events
4. **Refine prompts** based on real conversations
5. **Add more knowledge** through Guru
6. **Deploy to production** server

**Happy Testing! 🎯**
