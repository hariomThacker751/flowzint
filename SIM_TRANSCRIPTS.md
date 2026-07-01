# Bot Conversation Simulation — 2026-06-25T12:16:00.807Z
Model: sarvam-105b | autoSend: false | DB: isolated copy


## Scenario 1: Happy path (English), specs drip-fed then confirm
Customer: Hi
Bot: Hello! How can I help you today?
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 461ms
Customer: I need 28 inch box
Bot: 28 inches, got it. What grammage?
   ↳ stage=gathering_specs | escalated=false | specs={s:28,g:null,q:null,lam:null,qty:null} | 309ms
Customer: 4 grammage
Bot: 28 inches, got it. What grammage?
   ↳ stage=gathering_specs | escalated=false | specs={s:28,g:4,q:null,lam:null,qty:null} | 298ms
Customer: janta quality
Bot: 28 inches, got it. What grammage?
   ↳ stage=gathering_specs | escalated=false | specs={s:28,g:4,q:Janta,lam:null,qty:null} | 316ms
Customer: 1 ton
Bot: Do you want lamination? Unlaminated (default), Regular (+₹2/kg), or Natural (+₹5/kg)?
   ↳ stage=gathering_specs | escalated=false | specs={s:28,g:4,q:Janta,lam:null,qty:1000} | 287ms
Customer: unlaminated
Bot: Here's your rate: 28" 4g Janta — ₹79/kg, total ₹79000.00 (for 1000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=quoting | escalated=false | specs={s:28,g:4,q:Janta,lam:None,qty:1000} | 305ms
Customer: yes confirm
Bot: Here's your rate: 28" 4g Janta — ₹79/kg, total ₹79000.00 (for 1000kg). Ex-factory (GST + transport separate). Works for you?
   ↳ stage=awaiting_payment | escalated=false | specs={s:28,g:4,q:Janta,lam:None,qty:1000} | 807ms

## Scenario 2: All specs in one Gujlish message
Customer: mane 30 inch 3.5 gram gold quality white unlaminated 2 ton joiye chhe
Bot: Bhai, 30 inch 3.5 gram gold quality white unlaminated 2 ton mate total ₹1,60,000 thase. Kem chho?
   ↳ stage=quoting | escalated=false | specs={s:30,g:3.5,q:Gold,lam:None,qty:2000} | 621ms
Customer: ha barobar chalse
Bot: Saru, bhai. Production start karva mate ₹16,000 thi ₹40,000 sudhi advance mokli shako chho? Delivery pehla balance thase.
   ↳ stage=awaiting_payment | escalated=false | specs={s:30,g:3.5,q:Gold,lam:None,qty:2000} | 729ms

## Scenario 3: Hinglish, partial then complete
Customer: bhai mujhe 36 inch ka maal chahiye
Bot: 36 inch, got it. What grammage?
   ↳ stage=gathering_specs | escalated=false | specs={s:36,g:null,q:null,lam:null,qty:null} | 323ms
Customer: 4 gram platinum
Bot: 36" 4g, noted. What quality?
   ↳ stage=gathering_specs | escalated=false | specs={s:36,g:4,q:Platinum,lam:null,qty:null} | 264ms
Customer: natural laminated
Bot: How much quantity do you need? (In KG)
   ↳ stage=gathering_specs | escalated=false | specs={s:36,g:4,q:Platinum,lam:Natural,qty:null} | 392ms
Customer: 5 ton
Bot: Dhanyavaad Test bhai! 🙏

Natural box aaambhii saaTHii ek vishesh utpadaan aahe. Production team-kaduun uplabdhitaa aaNi specifications tapaasvii lavlaagiilot. 15 minutaanMadhe puurN mahitisah parataaNaar.

WhatsApp var raahaavaa. 🙏
   ↳ stage=escalation_hold | escalated=true | specs={s:36,g:4,q:Platinum,lam:Natural,qty:5000} | 5ms
Customer: haan theek hai
Bot: Dhanyavaad Test bhai! 🙏 Natural box aaambhii saaThii ek vishesh utpaadan aahe. Production team-kadun uplabdhitaa ani specifications tapaasvi laagel. 15 minutaanMadhe puurN mahitisah parataanaar. WhatsApp var raahaavaa. 🙏
   ↳ stage=escalation_hold | escalated=false | specs={s:36,g:4,q:Platinum,lam:Natural,qty:null} | 796ms

## Scenario 4: Context-bleed check: finish order, then NEW order with different specs
Customer: 27 inch 4 gram gold 1 ton unlaminated
Bot: Namaste, 27 inch 4 gram Gold unlaminated box ke liye ₹79 per kg hai. Total price ₹79,000 for 1 ton. Kya aap agree hain?
   ↳ stage=quoting | escalated=false | specs={s:27,g:4,q:Gold,lam:None,qty:1000} | 671ms
Customer: yes
Bot: Great. Please send a token advance between ₹7,900 and ₹19,750 to start production. Balance payment before or at delivery.
   ↳ stage=awaiting_payment | escalated=false | specs={s:27,g:4,q:Gold,lam:None,qty:1000} | 365ms
Customer: new order
Bot: Hi! What box are you looking for? Share the size, grammage and quality — I'll get you the best rate.
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 636ms
Customer: 32 inch 3 gram silver 500 kg unlaminated
Bot: Namaste, 32 inch 3 gram Silver unlaminated box ke liye ₹80 per kg hai. Total price ₹40,000 for 500 kg. Kya aap agree hain?
   ↳ stage=quoting | escalated=false | specs={s:32,g:3,q:Silver,lam:None,qty:500} | 718ms

## Scenario 5: No quantity given — must ask, must NOT default to 10000kg
Customer: 34 inch platinum 3 grammage laminated
Bot: 34 inch platinum 3 grammage laminated, got it. What quantity do you need?
   ↳ stage=gathering_specs | escalated=false | specs={s:34,g:3,q:Platinum,lam:Regular,qty:null} | 313ms

## Scenario 6: Confirmation must advance, not loop
Customer: 24 inch 5 gram regular quality 800 kg regular lamination
Bot: ₹80 per kg, total ₹64,000 for 800kg. Do you agree?
   ↳ stage=quoting | escalated=false | specs={s:24,g:5,q:Regular,lam:Regular,qty:800} | 355ms
Customer: ha chalega
Bot: ₹80 per kg, total ₹64,000 for 800kg. Do you agree?
   ↳ stage=awaiting_payment | escalated=false | specs={s:24,g:5,q:Regular,lam:Regular,qty:800} | 440ms
Customer: ha
Bot: Great. To start production, please send a token advance of ₹6,400 to ₹16,000. The balance is due before or at delivery.
   ↳ stage=awaiting_payment | escalated=false | specs={s:24,g:5,q:Regular,lam:Regular,qty:800} | 486ms
Customer: haan ji
Bot: Great. To start production, please send a token advance of ₹6,400 to ₹16,000. The balance is due before or at delivery.
   ↳ stage=awaiting_payment | escalated=false | specs={s:24,g:5,q:Regular,lam:Regular,qty:800} | 578ms

## Scenario 7: VALID GST at awaiting_gst (preset post-payment)
_(preset: stage=awaiting_gst, specs known)_
Customer: my gst is 27AAPFU0939F1ZV
Bot: Thank you for confirming your GST number. The price is ₹79,000 total for 1000kg of Janta box at ₹79 per kg. How would you like to proceed with delivery?
   ↳ stage=awaiting_delivery | escalated=false | specs={s:28,g:4,q:Janta,lam:None,qty:1000} | 663ms

## Scenario 8: INVALID GST at awaiting_gst — must ask to re-check, not accept
_(preset: stage=awaiting_gst, specs known)_
Customer: 04AABCU9355J121
Bot: The GST number you sent doesn't look correct. Could you please double-check and resend it?
   ↳ stage=awaiting_gst | escalated=false | specs={s:28,g:4,q:Janta,lam:None,qty:1000} | 378ms

## Scenario 9: Sub-22 inch → must escalate/hold (no autonomous quote)
Customer: 18 inch 4 gram gold 1 ton unlaminated white
Bot: Dhanyavaad Test bhai! 🙏

Tumchi box avaashyakata nondavali. Yaa vishisht size-saaThii aambhii production team-kaduun ek vishesh puShTii haavii aahe — 10-15 minutaa mein sarv taapasiilaasaath tumhaalaa kalaweel.

WhatsApp var upalabdh rahaa. 🙏
   ↳ stage=escalation_hold | escalated=true | specs={s:18,g:4,q:Gold,lam:None,qty:1000} | 1ms

## Scenario 10: Natural lamination → must escalate/hold
Customer: 30 inch 4 gram gold 1 ton natural lamination white
Bot: Dhanyavaad Test bhai! 🙏

Natural box aaambhii saaTHii ek vishesh utpadaan aahe. Production team-kaduun uplabdhitaa aaNi specifications tapaasvii lavlaagiilot. 15 minutaanMadhe puurN mahitisah parataaNaar.

WhatsApp var raahaavaa. 🙏
   ↳ stage=escalation_hold | escalated=true | specs={s:30,g:4,q:Gold,lam:Natural,qty:1000} | 0ms

## Scenario 11: Greeting with name then specs
Customer: hello punit bhai
Bot: Haan bhai, main Puneet bol raha hun. Kya chahiye?
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 240ms
Customer: mane 26 inch 4 gram silver 900 kg unlaminated joiye
Bot: Kem chho bhai. 26 inch 4 gram silver white unlaminated 900 kg mate ₹79 per kg chhe, total ₹71,100 thase. Ex-factory price chhe. Agree che?
   ↳ stage=quoting | escalated=false | specs={s:26,g:4,q:Silver,lam:None,qty:900} | 719ms

## Scenario 12: Marathi script
Customer: नमस्कार, मला ३० इंच, ४ ग्रॅमेज, गोल्ड क्वालिटी, २ टन फॅब्रिक हवे आहे, अनलॅमिनेटेड
Bot: नमस्कार, तुमच्यासाठी ३० इंच, ४ ग्रॅमेज, गोल्ड क्वालिटी आणि अनलॅमिनेटेड फॅब्रिक उपलब्ध आहे. २ टनसाठी एकूण किंमत ₹१२ लाख असेल.
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 625ms

## Scenario 13: Mid-flow correction of size
Customer: 28 inch 4 gram janta 1 ton unlaminated
Bot: Namaste, 28 inch 4 gram Janta unlaminated box ke liye ₹79 per kg hai. Total price ₹79,000 for 1 ton hoga. Kya aap agree hain?
   ↳ stage=quoting | escalated=false | specs={s:28,g:4,q:Janta,lam:None,qty:1000} | 619ms
Customer: actually make it 30 inch
Bot: Namaste, 30 inch 4 gram Janta unlaminated box ke liye ₹79 per kg hai. Total price ₹79,000 for 1 ton hoga. Kya aap agree hain?
   ↳ stage=quoting | escalated=false | specs={s:30,g:4,q:Janta,lam:None,qty:1000} | 332ms
Customer: yes
Bot: Great. Please send a token advance between ₹7,900 and ₹19,750 to start production. Balance payment before or at delivery.
   ↳ stage=awaiting_payment | escalated=false | specs={s:30,g:4,q:Janta,lam:None,qty:1000} | 563ms

## Scenario 14: Off-topic product question
Customer: aap log suit ka kapda bhi banate ho?
Bot: Haan bhai, hum suit ka kapda bhi banate hain. Aapko kaunsa box chahiye?
   ↳ stage=greeting | escalated=false | specs={s:null,g:null,q:null,lam:null,qty:null} | 373ms

## Scenario 15: Price negotiation
Customer: 27 inch 4 gram gold 2 ton unlaminated
Bot: Namaste, 27 inch 4 gram Gold unlaminated box ke liye ₹79 per kg hai. Total price ₹1,58,000 hoga for 2000kg. Kya aap agree karte hain?
   ↳ stage=quoting | escalated=false | specs={s:27,g:4,q:Gold,lam:None,qty:2000} | 569ms
Customer: bhai thoda sasta karo na
Bot: Bhai, ₹79 per kg hi final price hai. Koi discount possible nahi hai.
   ↳ stage=quoting | escalated=false | specs={s:27,g:4,q:Gold,lam:None,qty:2000} | 387ms

## Scenario 16: Quantity in tons + decimal grammage
Customer: bhai 36 inch 3.75 grammage platinum 10 ton white unlaminated
Bot: Bhai, 36 inch 3.75 grammage Platinum White unlaminated box is ₹80 per kg. Total for 10000kg will be ₹8,00,000 ex-factory. Do you agree?
   ↳ stage=quoting | escalated=false | specs={s:36,g:3.75,q:Platinum,lam:None,qty:10000} | 617ms