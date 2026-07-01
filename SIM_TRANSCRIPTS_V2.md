# Bot Conversation Simulation — 2026-06-25T12:36:59.937Z
Model: sarvam-105b | autoSend: false | DB: isolated copy


## Scenario 1: Gujlish drip-feed — must acknowledge + ask NEXT spec each turn (no parroting)
Customer: kem cho
Bot: Kem chho bhai! Kai specs ni jarurat chhe?
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 435ms
Customer: mane 32 inch nu box joiye
Bot: Saru, 32" noté karyu. Kai grammage joiye? (3g, 3.5g, 4g, 4.5g, 5g)
   ↳ stage=gathering_specs | escalated=false | specs={s:32,g:null,q:null,lam:null,qty:null} | 4ms
Customer: 4.5 gram
Bot: Got it — 32", 4.5g. What quality do you need? Janta, Regular, Silver, Gold, or Platinum?
   ↳ stage=gathering_specs | escalated=false | specs={s:32,g:4.5,q:null,lam:null,qty:null} | 1ms
Customer: gold quality
Bot: Got it — 32", 4.5g, Gold. How much quantity do you need? (In KG)
   ↳ stage=gathering_specs | escalated=false | specs={s:32,g:4.5,q:Gold,lam:null,qty:null} | 1ms
Customer: 1500 kg
Bot: Do you want lamination? Unlaminated (default), Regular (+₹2/kg), or Natural (+₹5/kg)?
   ↳ stage=gathering_specs | escalated=false | specs={s:32,g:4.5,q:Gold,lam:null,qty:1500} | 2ms
Customer: regular lamination
Bot: Here's your rate: 32" 4.5g Regular — ₹81/kg, total ₹121500.00 (for 1500kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:32,g:4.5,q:Regular,lam:Regular,qty:1500} | 18ms
Customer: ha barobar
Bot: Bhai, tamaro order note kari lidhu. Tamaro order: 1500kg Regular box — total ₹121500.00. Production start karva mate token advance ₹12,150–₹30,380 (10–25%) moklo. Baaki delivery time pe. Payment details moklu chhu.
   ↳ stage=awaiting_payment | escalated=false | specs={s:32,g:4.5,q:Regular,lam:Regular,qty:1500} | 1ms

## Scenario 2: Hindi (Devanagari), ALL specs in one message — extraction + correct quote
Customer: मुझे ३२ इंच, ४ ग्राम, गोल्ड क्वालिटी, सफेद, २ टन, अनलैमिनेटेड चाहिए
Bot: भाई, आपका रेट: 32" 4g Gold — ₹79/kg, total ₹158000.00 (2000kg के लिए)। Ex-factory — GST और transport अलग। चलेगा?
   ↳ stage=quoting | escalated=false | specs={s:32,g:4,q:Gold,lam:None,qty:2000} | 3ms
Customer: हाँ ठीक है
Bot: भाई, आपका ऑर्डर नोट कर लिया। आपका ऑर्डर: 2000kg Gold फैब्रिक — total ₹158000.00. प्रोडक्शन शुरू करने के लिए token advance ₹15,800–₹39,500 (10–25%) भेजो। बाकी डिलीवरी टाइम पर। पेमेंट डिटेल्स भेजता हूं।
   ↳ stage=awaiting_payment | escalated=false | specs={s:32,g:4,q:Gold,lam:None,qty:2000} | 2ms

## Scenario 3: Marathi (Devanagari) ALL specs — was hallucinating ₹12 lakh before
Customer: मला ३० इंच, ४ ग्रॅमेज, गोल्ड क्वालिटी, २ टन, अनलॅमिनेटेड हवे आहे
Bot: भाई, आपका रेट: 30" 4g Gold — ₹79/kg, total ₹158000.00 (2000kg के लिए)। Ex-factory — GST और transport अलग। चलेगा?
   ↳ stage=quoting | escalated=false | specs={s:30,g:4,q:Gold,lam:None,qty:2000} | 2ms

## Scenario 4: Natural LAMINATION order — must QUOTE now (not escalate)
Customer: 28 inch 4 gram silver white 1 ton natural lamination
Bot: Here's your rate: 28" 4g Silver — ₹84/kg, total ₹84000.00 (for 1000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:28,g:4,q:Silver,lam:Natural,qty:1000} | 2ms

## Scenario 5: Off-topic (English) — must clarify PP woven only
Customer: do you guys make plastic carry bags or only box?
Bot: We manufacture only PP woven box rolls. What box specifications do you need?
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 311ms

## Scenario 6: Off-topic (Hinglish) — bori/sack
Customer: bhai aap log ready bori bhi banate ho kya?
Bot: Haan bhai, hum sirf PP woven box banate hain. Aapko kis size aur grammage ka box chahiye?
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 304ms

## Scenario 7: Sub-22 inch (English) — must escalate/hold in correct language
Customer: 20 inch 4 gram gold 1 ton unlaminated white
Bot: Thank you Test ji! 🙏

I've noted your box requirement. This particular size needs a special confirmation from our production team — I'll get back to you within 10–15 minutes with full details.

Please stay available on WhatsApp. 🙏
   ↳ stage=escalation_hold | escalated=true | specs={s:20,g:4,q:Gold,lam:None,qty:1000} | 3ms

## Scenario 8: English drip-feed + confirm — must advance to payment, no lag
Customer: hello
Bot: Hello! How can I help you with your PP woven box requirements today?
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 424ms
Customer: i want 26 inch
Bot: Got it — 26". What grammage do you need? (3g, 3.5g, 4g, 4.5g, 5g)
   ↳ stage=gathering_specs | escalated=false | specs={s:26,g:null,q:null,lam:null,qty:null} | 2ms
Customer: 3.5 gram
Bot: Got it — 26", 3.5g. What quality do you need? Janta, Regular, Silver, Gold, or Platinum?
   ↳ stage=gathering_specs | escalated=false | specs={s:26,g:3.5,q:null,lam:null,qty:null} | 2ms
Customer: platinum
Bot: Got it — 26", 3.5g, Platinum. How much quantity do you need? (In KG)
   ↳ stage=gathering_specs | escalated=false | specs={s:26,g:3.5,q:Platinum,lam:null,qty:null} | 1ms
Customer: unlaminated
Bot: Got it — 26", 3.5g, Platinum, unlaminated. How much quantity do you need? (In KG)
   ↳ stage=gathering_specs | escalated=false | specs={s:26,g:3.5,q:Platinum,lam:None,qty:null} | 1ms
Customer: 2 ton
Bot: Here's your rate: 26" 3.5g Platinum — ₹80/kg, total ₹160000.00 (for 2000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:26,g:3.5,q:Platinum,lam:None,qty:2000} | 3ms
Customer: yes please proceed
Bot: I've noted your order. Your order: 2000kg Platinum box — total ₹160000.00. To start production, please send a token advance of ₹16,000–₹40,000 (10–25% of order value). Balance before delivery. I'll share the payment details now.
   ↳ stage=awaiting_payment | escalated=false | specs={s:26,g:3.5,q:Platinum,lam:None,qty:2000} | 2ms

## Scenario 9: Half-coloured premium (+₹5/kg) — check pricing
Customer: 33 inch 4 gram gold half coloured 1 ton unlaminated
Bot: Here's your rate: 33" 4g Gold — ₹84/kg, total ₹84000.00 (for 1000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:33,g:4,q:Gold,lam:None,qty:1000} | 2ms

## Scenario 10: Full-coloured premium (+₹7/kg) — check pricing
Customer: 30 inch 3 gram silver full coloured 500 kg regular lamination
Bot: Here's your rate: 30" 3g Silver — ₹89/kg, total ₹44500.00 (for 500kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:30,g:3,q:Silver,lam:Regular,qty:500} | 2ms

## Scenario 11: Gujarati script full specs
Customer: મારે ૩૪ ઇંચ, ૫ ગ્રામ, પ્લેટિનમ, સફેદ, ૩ ટન, અનલેમિનેટેડ જોઈએ
Bot: Bhai, tamaru rate: 34" 5g Platinum — ₹78/kg, total ₹234000.00 (3000kg mate). Ex-factory — GST ane transport alag. Chalega?
   ↳ stage=quoting | escalated=false | specs={s:34,g:5,q:Platinum,lam:None,qty:3000} | 2ms

## Scenario 12: Negotiation after quote — hold the price
Customer: 29 inch 4 gram gold 2 ton unlaminated
Bot: Here's your rate: 29" 4g Gold — ₹79/kg, total ₹158000.00 (for 2000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:29,g:4,q:Gold,lam:None,qty:2000} | 1ms
Customer: yaar 5 rupaye kam karo
Bot: Bhai, ₹79/kg hi hamara best ex-factory rate hai — isse kam nahi ho sakta. Quality top hai. Chalega?
   ↳ stage=quoting | escalated=false | specs={s:29,g:4,q:Gold,lam:None,qty:2000} | 1ms

## Scenario 13: Mid-flow QUALITY correction
Customer: 31 inch 4 gram silver 1 ton unlaminated
Bot: Here's your rate: 31" 4g Silver — ₹79/kg, total ₹79000.00 (for 1000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:31,g:4,q:Silver,lam:None,qty:1000} | 80ms
Customer: no make it platinum
Bot: Here's your rate: 31" 4g Platinum — ₹79/kg, total ₹79000.00 (for 1000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:31,g:4,q:Platinum,lam:None,qty:1000} | 2ms
Customer: ok done
Bot: I've noted your order. Your order: 1000kg Platinum box — total ₹79000.00. To start production, please send a token advance of ₹7,900–₹19,750 (10–25% of order value). Balance before delivery. I'll share the payment details now.
   ↳ stage=awaiting_payment | escalated=false | specs={s:31,g:4,q:Platinum,lam:None,qty:1000} | 2ms

## Scenario 14: Quantity-first then specs (Hinglish)
Customer: bhai mujhe 3 ton chahiye
Bot: Theek hai, 3000kg note kiya. Kaun sa size chahiye? (Inches mein batao — 12 se 36 inch)
   ↳ stage=gathering_specs | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:3000} | 1ms
Customer: 35 inch 4 gram janta unlaminated
Bot: Here's your rate: 35" 4g Janta — ₹79/kg, total ₹237000.00 (for 3000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:35,g:4,q:Janta,lam:None,qty:3000} | 1ms

## Scenario 15: VALID GST (different state) at awaiting_gst
_(preset: stage=awaiting_gst, specs known)_
Customer: here is my gst 29AAGCB7383J1Z4
Bot: Thank you for providing your GST number. The price is ₹79 per kg, totaling ₹1,58,000 for 2000kg. How would you like to receive the delivery - self-pickup from Surat/Kim or should we arrange transport?
   ↳ stage=awaiting_delivery | escalated=false | specs={s:30,g:4,q:Gold,lam:None,qty:2000} | 637ms

## Scenario 16: INVALID GST (wrong checksum) at awaiting_gst — must re-ask
_(preset: stage=awaiting_gst, specs known)_
Customer: 27AAPFU0939F1ZA
Bot: The GST number you provided doesn't look correct. Could you please double-check and resend it?
   ↳ stage=awaiting_gst | escalated=false | specs={s:30,g:4,q:Gold,lam:None,qty:2000} | 389ms
Customer: 29AAGCB7383J1Z4
Bot: Thank you for the correct GST number. The price for 2000kg of 30" 4g Gold PP woven box is ₹1,58,000 total (₹79/kg). How would you like to proceed with delivery?
   ↳ stage=awaiting_delivery | escalated=false | specs={s:30,g:4,q:Gold,lam:None,qty:2000} | 510ms

## Scenario 17: Tamil script greeting + English specs
Customer: வணக்கம், எனக்கு துணி வேண்டும்
Bot: வணக்கம்! உங்களுக்குத் தேவையான துணியின் விவரங்களைச் சொல்ல முடியுமா?
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 358ms
Customer: 27 inch 4 gram gold 1 ton unlaminated
Bot: Here's your rate: 27" 4g Gold — ₹79/kg, total ₹79000.00 (for 1000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:27,g:4,q:Gold,lam:None,qty:1000} | 2ms