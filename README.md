# Flowzint: Corrugated Box Sales OS

Flowzint is a multi-agent, high-performance sales operating system designed specifically for Corrugated Box Manufacturing. The primary focus of the system is to automate inbound WhatsApp box negotiations, qualification, pricing, and scheduling on a **Made-To-Order** basis.

## Core Sales Strategy
The Sales Agent engages customers to qualify their requirements across custom dimensions, ply count, Kraft paper GSM, printing, and quantity. It also captures seasonal demand cycles to predict future pipeline. If our own factory capacity is full, the system activates a **Trading Desk** to outsource the order to third-party manufacturers, ensuring we capture 100% of demand.

## Realistic Box Pricing Engine
Prices are computed on a per-box basis using realistic market parameters:

### 1. Base Price by Ply Grade
- **3-Ply Boxes** (Standard shipping boxes): **₹32.00 base** (scales as `base_price_3g * 0.4`)
- **5-Ply Boxes** (Heavy-duty shipping cartons): **₹45.00 base** (scales as `base_price_3g * 0.563`)
- **7-Ply Boxes** (Heavy industrial storage boxes): **₹60.00 base** (scales as `base_price_3g * 0.75`)
*Note: Base prices dynamically scale in proportion to the raw paper base price configured by the owner in the DB.*

### 2. Size Premium
Based on combined dimensions (Length + Width + Height in inches):
- **Small** (Combined size ≤ 20 inches): **+₹0.00**
- **Medium** (Combined size 21" to 40"): **+₹5.00**
- **Large** (Combined size 41" to 50"): **+₹12.00**

### 3. Kraft Paper GSM Premium
- **Standard (120 GSM)**: **+₹0.00**
- **Premium (150 GSM)**: **+₹4.00**
- **Heavy Duty (200 GSM)**: **+₹8.00**
*Note: Legacy decimal inputs (e.g. 3.0g to 5.0g) are automatically scaled: GSM = value * 50.*

### 4. Printing/Color Premium
- **Plain** (No printing): **+₹0.00**
- **Flexo Printed** (1-2 Colors for simple logos/texts): **+₹3.00**
- **Offset Printed** (Full-color premium graphics): **+₹7.00**

### 5. Finish & Lamination
- **None**: **+₹0.00**
- **Film Lamination** (Glossy/Matte protective film): **+₹4.00**
- **UV Coating / Varnish**: **+₹6.00**

---

## Human-in-the-Loop & Deal Desk Escalations
The system operates with guardrails. Certain non-standard or risky orders require validation from the Owner or Managers (Hierarchy: Admin/Owner > Dev > Manager) before the Sales Agent sends the confirmation:
- **7-Ply Setup Check**: Any 7-ply box requires approval due to machine setup complexity.
- **Short-Run Setup Cost**: Orders below **500 boxes** are flagged for escalation because setup costs make small runs low-margin.
- **Oversized Boards**: Any box with combined dimensions > 50 inches requires manual confirmation.
- **Delivery Exceptions**: If the production scheduler indicates no slot is available in the next 30 days.

## Localization & Target Markets
The agent communicates fluently in **Hindi, Gujarati, Tamil, Malayalam, Marathi, Telugu, and Kannada**, allowing it to qualify local buyers in their native languages.
