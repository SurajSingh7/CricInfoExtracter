# Stock Backend — Full API Documentation (Hinglish)

Ye document is project ke **saare 51 APIs** ko simple Hinglish mein explain karta hai, taaki koi bhi naya (junior) ya senior engineer bina project explore kiye directly samajh sake ki kaunsa API **kya kaam karta hai**, **kya bhejna hai**, aur **kya wapas milega**.

---

## 1. Project Overview

| Cheez | Detail |
|---|---|
| Language / Runtime | Node.js (ES Modules — `import/export`) |
| Framework | Express.js 4.18 |
| Database | MongoDB (Mongoose 8.0 ORM) |
| File uploads | Multer (product images/attachments ke liye) |
| PDF generation | PDFKit (Purchase Order ka PDF banane ke liye) |
| Server port | `.env` ki `PORT` value, default `5000` → `http://localhost:5000` |
| Global API prefix | **`/api/v1/stock`** (har API ke aage ye lagega) |
| DB name | `stock_db` (Mongo local) |

**Simple bhasha mein:** Ye backend ek **Stock / Inventory / Purchase management system** hai. Isme categories bante hain, unke andar products define hote hain, phir un products ka actual stock (inventory items) track hota hai, vendors se quotation manga jata hai, quotation approve hone ke baad purchase order (PO) generate hota hai.

### 1.1 Flow samjho (real-world jaisa)

```
Category बनाओ  →  उसके अंदर Product Definition बनाओ  →  Field Definitions (extra attributes) attach करो
      ↓
Vendor add करो (जो product supply करेगा)
      ↓
Quotation बनाओ (multiple vendors से price मंगाओ)  →  Quotation Review करो (approve/reject per category)
      ↓
Purchase Order (PO) बनाओ approved quotation items से  →  PO approve/reject करो  →  PDF download करो
      ↓
Stock aane par Inventory Item create करो (actual maal जो godown में आया)
```

---

## 2. IMPORTANT — Authentication ka Status ⚠️

> **Is repo mein koi bhi authentication/authorization middleware implement NAHI hai.**

- Koi JWT, session, ya API-key check nahi hota.
- Controllers mein `req.user?._id` ya `req.userId` use hota hai (jaise `createdBy`, `deletedBy`, `reviewedBy` fields fill karne ke liye), lekin kahin bhi `req.user` set nahi hota — isliye ye hamesha `null` ban jaata hai.
- Iska matlab: ye backend **kisi bade parent app ke andar mount hone ke liye designed hai**, jahan auth middleware bahar se lagaya jayega (dekho `ROUTE_REGISTRATION.js` file).
- **Abhi ke liye: sab APIs open hain, bina login ke direct call ho sakte hain.**

Agar tum junior engineer ho aur "Authorization header" dhoondh rahe ho — wo sirf CORS config mein allow hai, use validate karne wala code kahin nahi hai.

---

## 3. Common Response Format (सब APIs में same pattern)

Har API ka response ek fix structure follow karta hai (`helpers/response.helper.js` se aata hai):

### Success Response
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": { }
}
```

### Paginated List Response (jahan list APIs hain)
```json
{
  "success": true,
  "message": "Categories fetched successfully",
  "data": [ ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Category not found",
  "error": "stack trace (sirf development mode mein dikhta hai)"
}
```

**Status code kaise decide hota hai (message text se):**
| Message mein ye word ho | Status Code |
|---|---|
| "not found" | 404 |
| "required" / "invalid" / "must be" / "cannot" / "immutable" | 400 |
| baaki sab | 500 |

---

## 4. Soft-Delete Pattern (bahut important — sab modules mein hai)

Is project mein **kabhi bhi data hard-delete (permanently) nahi hota**. Jab bhi tum `DELETE` API call karte ho:

- Record delete NAHI hota, balki uska field `isActive = false` ho jata hai.
- `deletedAt` (kab delete hua) aur `deletedBy` (kisne delete kiya) set ho jate hain.
- Ye record normal GET list mein dikhna band ho jata hai (jab tak `showInactive=true` query na bhejo).
- Isi record ko wapas active karne ke liye har module mein ek `/restore` API hai (`PATCH .../:id/restore`).

**Junior engineer ke liye simple example:** Jaise Gmail mein "Trash" hota hai — delete karne se mail turant permanently nahi udta, trash mein chala jata hai, wahan se restore kar sakte ho.

---

## 5. Modules List (Quick Index)

| # | Module | Base Path | Total APIs |
|---|---|---|---|
| A | Field Definitions | `/field-definitions` | 6 |
| B | Categories | `/categories` | 10 |
| C | Product Definitions | `/product-definitions` | 8 |
| D | Vendors | `/vendors` | 6 |
| E | Inventory Items | `/inventory-items` | 9 |
| F | Quotations | `/quotations` | 11 |
| G | Purchase Orders | `/purchase-orders` | 10 |
| H | Health Check | `/` (bina prefix ke) | 1 |

**Total = 51 APIs**

Sab paths ke aage `/api/v1/stock` lagana hai. Example: Category create karne ka full URL hoga:
`POST http://localhost:5000/api/v1/stock/categories`

---

## A. Field Definitions APIs

**Ye kya hai?** Field Definition matlab ek "custom attribute template" — jaise "Color", "Size", "Warranty (months)" waghera. In fields ko baad mein Product Definitions ke saath attach karte hain, taaki har product type ke apne custom fields ho sakein (dynamic form jaisa).

**Simple example:** Socho tumhe ek Product Add karna hai — "Laptop" ke liye "RAM", "Processor" fields chahiye, lekin "Shirt" ke liye "Size", "Color" chahiye. Field Definitions is dynamic behaviour ko enable karti hain.

| # | Method | Path | Kya karta hai |
|---|---|---|---|
| A1 | POST | `/field-definitions` | Naya field definition banata hai (jaise "Color" field, type=dropdown) |
| A2 | GET | `/field-definitions` | Sab field definitions ki paginated list deta hai (search/filter ke saath) |
| A3 | GET | `/field-definitions/:id` | Ek specific field definition ki detail deta hai |
| A4 | PUT | `/field-definitions/:id` | Field definition ko update karta hai (label, inputType waghera badal sakte ho) |
| A5 | DELETE | `/field-definitions/:id` | Field definition ko soft-delete karta hai |
| A6 | PATCH | `/field-definitions/:id/restore` | Delete kiye hue field definition ko wapas active karta hai |

### A1. `POST /field-definitions` — Naya field banao
**Body (JSON):**
```json
{
  "code": "ram_size",          // required, sirf lowercase+underscore (a-z, 0-9, _)
  "label": "RAM Size",         // required, user ko dikhne wala naam
  "inputType": "dropdown",     // required — text/textarea/number/decimal/dropdown/multi_select/date/datetime/boolean/color
  "order": 1,                  // optional — form mein kis position pe dikhega
  "optionsSource": [],         // dropdown/multi_select ke liye options
  "isRequired": true,          // optional
  "isFilterable": false        // optional — list filter mein use hoga ya nahi
}
```
**Response:** created field definition object.
**Note:** `code` ek baar set hone ke baad **kabhi change nahi hota** (immutable) — ye system internally is code se field ko identify karta hai.

### A2. `GET /field-definitions` — List dekho
**Query params (sab optional):** `page`, `limit`, `search`, `inputType`, `showInactive`
**Response:** paginated list.

### A3. `GET /field-definitions/:id` — Single field detail

### A4. `PUT /field-definitions/:id` — Update karo
Body mein `label`, `inputType` waghera bhej sakte ho, lekin `code` bhejoge to error aayega (immutable field hai).

### A5. `DELETE /field-definitions/:id` — Soft delete
### A6. `PATCH /field-definitions/:id/restore` — Restore karo

---

## B. Categories APIs

**Ye kya hai?** Categories ek **tree structure** (parent-child) hoti hain, jaise:
```
Electronics (GROUP)
   └── Laptops (LEAF)
   └── Mobiles (LEAF)
```
- `type: GROUP` → sirf ek container hai, ismein directly products nahi rakh sakte, sirf sub-categories.
- `type: LEAF` → yahan directly products add ho sakte hain (LEAF = pedh ka aakhri patta, no further children).

| # | Method | Path | Kya karta hai |
|---|---|---|---|
| B1 | POST | `/categories` | Nayi category banata hai |
| B2 | GET | `/categories` | Poora category **tree** (nested) return karta hai |
| B3 | GET | `/categories/flat` | Category list ko **flat** (bina nesting ke) paginated form mein deta hai |
| B4 | PATCH | `/categories/reorder` | Same-level (sibling) categories ka order badalta hai (drag-drop jaisa) |
| B5 | GET | `/categories/:id` | Single category ki detail |
| B6 | PUT | `/categories/:id` | Category ka naam/description update karta hai |
| B7 | PATCH | `/categories/:id/toggle-type` | GROUP ↔ LEAF ke beech type switch karta hai |
| B8 | PATCH | `/categories/:id/move` | Category ko dusre parent ke andar move karta hai |
| B9 | DELETE | `/categories/:id` | Soft-delete karta hai |
| B10 | PATCH | `/categories/:id/restore` | Restore karta hai |

### B1. `POST /categories` — Nayi category
```json
{
  "name": "Laptops",         // required
  "type": "LEAF",            // required — GROUP or LEAF
  "description": "...",      // optional
  "parentId": "64f...abc"    // optional — agar root category hai to null/empty bhejo
}
```

### B2. `GET /categories` — Tree view
Query: `showInactive` (true/false). Response mein nested tree milta hai — parent ke andar `children[]` array hoga.
**Use-case:** Frontend mein sidebar/tree-view banane ke liye.

### B3. `GET /categories/flat` — Simple list
Query: `page`, `limit`, `search`, `type`, `showInactive`, `hasProducts` (sirf wo categories jinke andar products hain).
**Use-case:** Dropdown ya table view ke liye — tree nahi chahiye to ye use karo.

### B4. `PATCH /categories/reorder` — Order badlo
```json
{
  "siblings": [
    { "_id": "id1", "sortOrder": 1 },
    { "_id": "id2", "sortOrder": 2 }
  ]
}
```
**Use-case:** Jab user drag-and-drop se categories reorder kare.

### B5. `GET /categories/:id` — Single detail

### B6. `PUT /categories/:id` — Update
`name` bhej sakte ho, lekin `type` change karne ke liye ye API mat use karo (uske liye alag API hai B7 — kyunki type change karna risky operation hai, extra checks lagte hain).

### B7. `PATCH /categories/:id/toggle-type` — GROUP/LEAF switch
```json
{ "type": "GROUP" }
```
System check karta hai — agar LEAF category mein already active products hain to GROUP mein switch nahi hone dega (data integrity ke liye).

### B8. `PATCH /categories/:id/move` — Parent change
```json
{ "newParentId": "64f...xyz" }   // root banana ho to null bhejo
```

### B9. `DELETE /categories/:id` — Soft delete
### B10. `PATCH /categories/:id/restore` — Restore

---

## C. Product Definitions APIs

**Ye kya hai?** Product Definition matlab ek "product ka template/blueprint" — jaise "iPhone 15" ek product definition hai, jisme category (Mobiles), tracking method, image, GST rate, unit waghera define hota hai. Iske baad actual stock (individual pieces) **Inventory Items** mein aata hai.

**Important:** Ye APIs **multipart/form-data** use karte hain (kyunki image upload hoti hai), sirf plain JSON nahi.

| # | Method | Path | Kya karta hai |
|---|---|---|---|
| C1 | POST | `/product-definitions` | Naya product definition banata hai (image ke saath) |
| C2 | GET | `/product-definitions` | Sab product definitions ki list |
| C3 | GET | `/product-definitions/gst-rates` | Available GST rate options deta hai (0/5/12/18/28) |
| C4 | GET | `/product-definitions/by-category/:catId` | Ek category ke andar ke saare products |
| C5 | GET | `/product-definitions/:id` | Single product definition ki detail |
| C6 | PUT | `/product-definitions/:id` | Product definition update karta hai |
| C7 | DELETE | `/product-definitions/:id` | Soft-delete karta hai |
| C8 | PATCH | `/product-definitions/:id/restore` | Restore karta hai |

### C1. `POST /product-definitions` — Naya product
**Request:** `multipart/form-data`
- Field `image` → actual image file (jpg/png/webp/pdf, max 5MB)
- Field `data` → JSON string (agar form-data se bhej rahe ho) ya seedha JSON body:
```json
{
  "categoryId": "64f...",              // required
  "name": "iPhone 15",                 // required
  "trackingMethod": "individual",      // required — "individual" (IMEI jaisa unique tracking) ya "quantity" (bulk count)
  "selectedFields": [                  // required, non-empty
    { "fieldDefId": "64f...", "order": 1, "isRequired": true }
  ],
  "companyUseOnly": false,
  "gstRate": "18",                     // enum: "0","5","12","18","28"
  "unit": "pieces",                    // enum: pieces/meter/kg/box/litre/dozen
  "stockAlertThreshold": 5             // kitna stock kam ho to alert dena hai
}
```
**Trick:** Agar validation fail ho jaye but image already upload ho chuki thi, to system us orphan image file ko automatically delete kar deta hai (disk space waste na ho).

### C2. `GET /product-definitions` — List
Query: `page`, `limit`, `search`, `categoryId`, `showInactive`, `trackingMethod`, `productId`

### C3. `GET /product-definitions/gst-rates` — GST options
Simple static list return karta hai — dropdown banane ke liye.

### C4. `GET /product-definitions/by-category/:catId` — Category-wise products

### C5. `GET /product-definitions/:id` — Detail

### C6. `PUT /product-definitions/:id` — Update
Same fields jaise create, lekin `categoryId` change nahi kar sakte (immutable — ek baar category set hone ke baad fix hai).

### C7. `DELETE /product-definitions/:id` — Soft delete
### C8. `PATCH /product-definitions/:id/restore` — Restore

**Image URL kaise access hogi:** Upload hone ke baad image `http://localhost:5000/uploads/stock/products/product_<timestamp>_<random><ext>` pe accessible hoti hai.

---

## D. Vendors APIs

**Ye kya hai?** Vendor matlab **supplier/seller company** jo humein product supply karti hai. Har vendor ka apna GST number, bank account, contacts, address hota hai.

| # | Method | Path | Kya karta hai |
|---|---|---|---|
| D1 | POST | `/vendors` | Naya vendor add karta hai |
| D2 | GET | `/vendors` | Sab vendors ki list |
| D3 | GET | `/vendors/:id` | Single vendor detail |
| D4 | PUT | `/vendors/:id` | Vendor update karta hai |
| D5 | DELETE | `/vendors/:id` | Soft-delete karta hai |
| D6 | PATCH | `/vendors/:id/restore` | Restore karta hai |

### D1. `POST /vendors` — Naya vendor
```json
{
  "name": "ABC Traders",                       // required
  "vendorCode": "V001",                        // optional, ek baar set hua to immutable
  "vendorAlias": "ABC",
  "paymentTerms": "Net 30",                     // required
  "panNumber": "ABCDE1234F",
  "gst": { "isAvailable": true, "gstNumber": "27AAAAA0000A1Z5" },  // gstNumber required agar isAvailable=true
  "contacts": [                                 // required, non-empty
    { "label": "PRIMARY", "name": "Ramesh", "email": "r@abc.com", "phone": "9999999999" }
  ],
  "address": {                                  // sab sub-fields required
    "fullAddress": "...", "area": "...", "city": "...", "pinCode": "400001"
  },
  "bankAccounts": [                              // required, non-empty
    { "label": "PRIMARY", "ifsc": "HDFC0001234", "accountNumber": "123456789012" }
  ],
  "assignedProducts": [                          // vendor kaun-kaun se products supply karta hai
    { "categoryId": "64f...", "productIds": ["64f...", "64f..."] }
  ],
  "notes": "..."
}
```
**Zaroori rule:** `contacts` array mein kam-se-kam ek contact ka `label: "PRIMARY"` hona chahiye. Same rule `bankAccounts` ke liye bhi hai.

### D2. `GET /vendors` — List
Query: `page`, `limit`, `search`, `showInactive`, `categoryId`, `productId` (kis product ko supply karne wale vendors chahiye, us se filter).

### D3. `GET /vendors/:id` — Detail
### D4. `PUT /vendors/:id` — Update
Same as create, lekin `vendorCode` bhejoge to error aayega (immutable).
### D5. `DELETE /vendors/:id` — Soft delete
### D6. `PATCH /vendors/:id/restore` — Restore

---

## E. Inventory Items APIs

**Ye kya hai?** Ye **actual physical stock** hai jo godown/warehouse mein aaya hai. Product Definition ek "template" hai, Inventory Item us template ka **real piece/quantity** hai jo vendor se receive hua.

**Example:** "iPhone 15" (Product Definition) ka ek IMEI number wala actual phone jo stock mein aaya — wo ek Inventory Item hai.

| # | Method | Path | Kya karta hai |
|---|---|---|---|
| E1 | POST | `/inventory-items/bulk` | Ek saath multiple inventory items create karta hai |
| E2 | POST | `/inventory-items` | Single inventory item create karta hai |
| E3 | GET | `/inventory-items` | List (filter ke saath) |
| E4 | GET | `/inventory-items/summary/:defId` | Ek product ke stock ka summary (kitna available, allocated waghera) |
| E5 | GET | `/inventory-items/:id` | Single item detail |
| E6 | PUT | `/inventory-items/:id` | Item update karta hai |
| E7 | PATCH | `/inventory-items/:id/status` | Sirf status change karta hai (jaise AVAILABLE → ALLOCATED) |
| E8 | DELETE | `/inventory-items/:id` | Soft-delete karta hai |
| E9 | PATCH | `/inventory-items/:id/restore` | Restore karta hai |

### E1. `POST /inventory-items/bulk` — Bulk stock entry
```json
{
  "productDefinitionId": "64f...",   // required
  "receivedAt": "2026-07-14",        // required
  "items": [ { }, { } ]              // required, non-empty array — har item ki details
}
```
**Use-case:** Jab ek saath 50 mobile phones stock mein aaye ho, to ek-ek karke API call karne ki jagah ek hi call mein sab add ho jayenge.

### E2. `POST /inventory-items` — Single item
```json
{
  "productDefinitionId": "64f...",  // required
  "receivedAt": "2026-07-14",       // required
  "vendorId": "64f...",             // optional — kis vendor se aaya
  "fieldValues": { },               // custom field values (jo Field Definitions mein define kiye the)
  "quantity": 1,
  "status": "AVAILABLE"
}
```

### E3. `GET /inventory-items` — List
Query: `page`, `limit`, `productDefinitionId`, `status`, `search`, `showInactive`

### E4. `GET /inventory-items/summary/:defId` — Stock summary
`defId` = productDefinitionId. Response mein status-wise counts milte hain (kitna AVAILABLE hai, kitna ALLOCATED hai waghera) — dashboard/reporting ke liye useful.

### E5. `GET /inventory-items/:id` — Detail

### E6. `PUT /inventory-items/:id` — Update
Kisi bhi field ko update kar sakte ho, koi strict validation nahi hai is API mein (dusre modules ke comparison mein).

### E7. `PATCH /inventory-items/:id/status` — Status change
```json
{ "status": "ALLOCATED" }
```
Possible values: `AVAILABLE`, `ALLOCATED`, `IN_REPAIR`, `SCRAPPED`, `IN_TRANSIT`
**Use-case:** Jab item kisi customer/order ko allocate ho, ya repair mein jaye, ya scrap ho jaye.

### E8. `DELETE /inventory-items/:id` — Soft delete
### E9. `PATCH /inventory-items/:id/restore` — Restore

---

## F. Quotations APIs

**Ye kya hai?** Jab humein kuch products purchase karne hain, to hum multiple vendors se **price quote mangwate hain**. Quotation mein multiple line items ho sakte hain (alag-alag products/categories), aur har category ke liye **alag-alag approve/reject decision** liya ja sakta hai.

| # | Method | Path | Kya karta hai |
|---|---|---|---|
| F1 | POST | `/quotations` | Naya quotation banata hai |
| F2 | GET | `/quotations` | List (filter ke saath) |
| F3 | GET | `/quotations/status-summary` | Status-wise count (Pending/Approved/Rejected waghera) |
| F4 | GET | `/quotations/vendors-for-category/:catId` | Ek category ke liye eligible vendors deta hai |
| F5 | GET | `/quotations/:id` | Single quotation detail |
| F6 | PUT | `/quotations/:id` | Quotation update karta hai |
| F7 | PATCH | `/quotations/:id/review` | Quotation ko review karta hai — approve/reject per category |
| F8 | PATCH | `/quotations/:quotationId/disable-vendor` | Kisi vendor ko is quotation ke liye disable karta hai |
| F9 | PATCH | `/quotations/:quotationId/enable-vendor` | Disabled vendor ko wapas enable karta hai |
| F10 | DELETE | `/quotations/:id` | Soft-delete karta hai |
| F11 | PATCH | `/quotations/:id/restore` | Restore karta hai |

### F1. `POST /quotations` — Naya quotation
```json
{
  "items": [                          // required, non-empty
    {
      "productDefinitionId": "64f...",
      "vendorId": "64f...",
      "categoryId": "64f...",
      "quantity": 10,                  // > 0 hona chahiye
      "unitPrice": 500                 // >= 0 hona chahiye
    }
  ],
  "notes": "Urgent requirement"
}
```
System khud `categoryIds` list nikaal leta hai items se — tumhe alag se bhejne ki zaroorat nahi.

### F2. `GET /quotations` — List
Query: `page`, `limit`, `search`, `status`, `categoryId`, `vendorId`, `productId`, `dateFrom`, `dateTo`

### F3. `GET /quotations/status-summary` — Dashboard summary
Response:
```json
{ "PENDING": 5, "APPROVED": 10, "PARTIALLY_APPROVED": 2, "REJECTED": 1, "ALL": 18 }
```

### F4. `GET /quotations/vendors-for-category/:catId` — Vendor suggestions
Us category ke saath assign kiye hue vendors ki list deta hai, taaki quotation banate waqt pata chale kise price maangni hai.

### F5. `GET /quotations/:id` — Detail
Response mein product/vendor/category ke naam bhi populate hoke aate hain (sirf IDs nahi).

### F6. `PUT /quotations/:id` — Update
`items` ya `notes` update kar sakte ho.

### F7. `PATCH /quotations/:id/review` — Sabse important API! Approve/Reject
```json
{
  "decisions": [
    {
      "categoryId": "64f...",
      "status": "APPROVED",              // ya "REJECTED"
      "remarks": "Best price mila",
      "selection": {                      // sirf APPROVED ke case mein required
        "productDefinitionId": "64f...",
        "vendorId": "64f..."
      }
    }
  ]
}
```
**Kaise kaam karta hai:** Ek quotation mein alag-alag categories ho sakti hain (jaise Laptops + Mobiles), aur management har category ke liye alag decision le sakta hai — kuch approve, kuch reject. Overall quotation status khud calculate ho jata hai (`APPROVED` agar sab approve, `PARTIALLY_APPROVED` agar kuch approve kuch reject, `REJECTED` agar sab reject).

### F8. `PATCH /quotations/:quotationId/disable-vendor` — Vendor disable
```json
{ "vendorId": "64f...", "reason": "Vendor stopped responding" }
```
**Note:** Interesting cheez — ye API technically Purchase Order controller ka function use karta hai, lekin mounted hai `/quotations` path ke andar.

### F9. `PATCH /quotations/:quotationId/enable-vendor` — Vendor wapas enable
```json
{ "vendorId": "64f..." }
```

### F10. `DELETE /quotations/:id` — Soft delete
### F11. `PATCH /quotations/:id/restore` — Restore

---

## G. Purchase Orders (PO) APIs

**Ye kya hai?** Jab quotation approve ho jaata hai, to us par actual **Purchase Order (PO)** generate hota hai — ye legal document hota hai jo vendor ko bheja jaata hai order confirm karne ke liye. PO mein GST calculation (CGST/SGST ya IGST), totals, aur ek **PDF** bhi auto-generate hoti hai.

| # | Method | Path | Kya karta hai |
|---|---|---|---|
| G1 | GET | `/purchase-orders/board` | Kanban-style board — approved quotation items vendor-wise group karke dikhata hai |
| G2 | GET | `/purchase-orders/candidates` | Wo approved items jo abhi tak kisi PO mein nahi gaye |
| G3 | POST | `/purchase-orders` | Naya PO banata hai |
| G4 | GET | `/purchase-orders` | PO list |
| G5 | GET | `/purchase-orders/:id/pdf` | PO ki PDF file stream karta hai (download/view) |
| G6 | GET | `/purchase-orders/:id` | Single PO detail |
| G7 | PUT | `/purchase-orders/:id` | PO update karta hai |
| G8 | PATCH | `/purchase-orders/:id/approve` | PO ko approve karta hai |
| G9 | PATCH | `/purchase-orders/:id/reject` | PO ko reject karta hai |
| G10 | DELETE | `/purchase-orders/:id` | Soft-delete karta hai |

> ⚠️ **Note:** Baaki sab modules mein `/restore` API hai, lekin **Purchase Orders mein restore API nahi hai** — ye is module mein missing feature hai.

### G1. `GET /purchase-orders/board` — Kanban board view
Query: `search`, `vendorId`, `categoryId`, `productId`, `entityAlias`, `status`, `dateFrom`, `dateTo`, `sourceQuotationId`
**Use-case:** Purchase team ko ek visual board chahiye jaha dikhe ki kaunse approved items abhi PO ban chuke hain aur kaunse baaki hain — vendor-wise grouped.

### G2. `GET /purchase-orders/candidates` — PO banane layak items
Query: `sourceQuotationId` (optional)
Response: approved/partially-approved quotation items jo abhi tak kisi PO se attach nahi hue, vendor-wise grouped — "in items pe ab PO bana sakte ho".

### G3. `POST /purchase-orders` — Naya PO banao
```json
{
  "sourceQuotationId": "64f...",       // required
  "vendorId": "64f...",                // required
  "quotationItemIds": ["64f...", "64f..."],  // required, non-empty
  "buyerEntity": {                     // required
    "stateCode": "27",                 // GST state code — IGST vs CGST/SGST decide karne ke liye
    "...": "..."
  },
  "requester": "Ramesh Kumar",         // required
  "skippedItems": [ { "itemId": "64f...", "reason": "Price too high" } ],  // optional
  "shipmentPreference": "...",
  "paymentTerms": "Net 30",
  "terms": "...",
  "notes": "..."
}
```
**Server automatically kya karta hai:**
1. Buyer ka state code aur vendor ka state code compare karta hai — same state ho to CGST+SGST lagta hai, different state ho to IGST lagta hai (India GST rule).
2. Sab totals calculate karta hai (subTotal, gstTotal, grandTotal).
3. Unique PO number generate karta hai.
4. PDF file bana ke save karta hai (`pdfPath` field mein path store hota hai).

### G4. `GET /purchase-orders` — List
Query: `page`, `limit`, `search`, `status`, `vendorId`, `sourceQuotationId`

### G5. `GET /purchase-orders/:id/pdf` — PDF dekho/download karo
Response: seedha PDF file stream hota hai (`Content-Type: application/pdf`) — browser mein khulega ya download hoga.
Agar PDF file disk pe missing hai to error milega.

### G6. `GET /purchase-orders/:id` — Detail

### G7. `PUT /purchase-orders/:id` — Update

### G8. `PATCH /purchase-orders/:id/approve` — Approve karo
Body: kuch nahi chahiye, sirf `id` param.
Effect: status → `APPROVED`, aur `reviewedBy`/`reviewedByName`/`reviewedAt` set ho jata hai.

### G9. `PATCH /purchase-orders/:id/reject` — Reject karo
```json
{ "rejectedReason": "Vendor price mismatch" }   // optional
```
Effect: status → `REJECTED`

### G10. `DELETE /purchase-orders/:id` — Soft delete

---

## H. Health Check

| Method | Path | Kya karta hai |
|---|---|---|
| GET | `/` (bina `/api/v1/stock` prefix ke) | Server zinda hai ya nahi, ye check karne ke liye |

Response:
```json
{ "status": "Stock API running" }
```

---

## 6. Database Models Summary (short cheat-sheet)

| Model | Kya store karta hai |
|---|---|
| `categories` | Category tree (GROUP/LEAF) |
| `field_definitions` | Custom attribute templates (Color, Size, waghera) |
| `product_definitions` | Product ka blueprint/template |
| `inventory_items` | Actual physical stock jo warehouse mein hai |
| `vendors` | Supplier companies ki details |
| `quotations` | Vendors se manga gaya price quote, category-wise approval ke saath |
| `purchase_orders` | Final confirmed order jo vendor ko bheja jata hai |
| `vendor_product_purchase_history` | Purane purchases ka record (abhi sirf read hota hai, write karne wala API nahi hai) |
| `vendor_reviews` | Vendor ki rating/review (abhi sirf read hota hai, write karne wala API nahi hai) |

**Note for future dev:** Last do models (`vendor_product_purchase_history`, `vendor_reviews`) ke liye koi POST/create API nahi hai abhi — Quotation module inko sirf read karke purani price/rating dikhata hai. Agar future mein purchase history ya review add karna ho to naya API banana padega.

---

## 7. Quick Reference Table — Sab APIs Ek Jagah

> Sab paths ke aage `http://localhost:5000/api/v1/stock` lagao.

| Module | Method | Path |
|---|---|---|
| Field Def | POST | `/field-definitions` |
| Field Def | GET | `/field-definitions` |
| Field Def | GET | `/field-definitions/:id` |
| Field Def | PUT | `/field-definitions/:id` |
| Field Def | DELETE | `/field-definitions/:id` |
| Field Def | PATCH | `/field-definitions/:id/restore` |
| Category | POST | `/categories` |
| Category | GET | `/categories` |
| Category | GET | `/categories/flat` |
| Category | PATCH | `/categories/reorder` |
| Category | GET | `/categories/:id` |
| Category | PUT | `/categories/:id` |
| Category | PATCH | `/categories/:id/toggle-type` |
| Category | PATCH | `/categories/:id/move` |
| Category | DELETE | `/categories/:id` |
| Category | PATCH | `/categories/:id/restore` |
| Product Def | POST | `/product-definitions` |
| Product Def | GET | `/product-definitions` |
| Product Def | GET | `/product-definitions/gst-rates` |
| Product Def | GET | `/product-definitions/by-category/:catId` |
| Product Def | GET | `/product-definitions/:id` |
| Product Def | PUT | `/product-definitions/:id` |
| Product Def | DELETE | `/product-definitions/:id` |
| Product Def | PATCH | `/product-definitions/:id/restore` |
| Vendor | POST | `/vendors` |
| Vendor | GET | `/vendors` |
| Vendor | GET | `/vendors/:id` |
| Vendor | PUT | `/vendors/:id` |
| Vendor | DELETE | `/vendors/:id` |
| Vendor | PATCH | `/vendors/:id/restore` |
| Inventory | POST | `/inventory-items/bulk` |
| Inventory | POST | `/inventory-items` |
| Inventory | GET | `/inventory-items` |
| Inventory | GET | `/inventory-items/summary/:defId` |
| Inventory | GET | `/inventory-items/:id` |
| Inventory | PUT | `/inventory-items/:id` |
| Inventory | PATCH | `/inventory-items/:id/status` |
| Inventory | DELETE | `/inventory-items/:id` |
| Inventory | PATCH | `/inventory-items/:id/restore` |
| Quotation | POST | `/quotations` |
| Quotation | GET | `/quotations` |
| Quotation | GET | `/quotations/status-summary` |
| Quotation | GET | `/quotations/vendors-for-category/:catId` |
| Quotation | GET | `/quotations/:id` |
| Quotation | PUT | `/quotations/:id` |
| Quotation | PATCH | `/quotations/:id/review` |
| Quotation | PATCH | `/quotations/:quotationId/disable-vendor` |
| Quotation | PATCH | `/quotations/:quotationId/enable-vendor` |
| Quotation | DELETE | `/quotations/:id` |
| Quotation | PATCH | `/quotations/:id/restore` |
| Purchase Order | GET | `/purchase-orders/board` |
| Purchase Order | GET | `/purchase-orders/candidates` |
| Purchase Order | POST | `/purchase-orders` |
| Purchase Order | GET | `/purchase-orders` |
| Purchase Order | GET | `/purchase-orders/:id/pdf` |
| Purchase Order | GET | `/purchase-orders/:id` |
| Purchase Order | PUT | `/purchase-orders/:id` |
| Purchase Order | PATCH | `/purchase-orders/:id/approve` |
| Purchase Order | PATCH | `/purchase-orders/:id/reject` |
| Purchase Order | DELETE | `/purchase-orders/:id` |
| Health | GET | `/` (bina prefix) |

---

## 8. Common Gotchas (Junior Engineers ke liye tips)

1. **Route order matters:** `routes/v1.stock.routes.js` mein specific paths (jaise `/categories/flat`, `/quotations/status-summary`) hamesha `:id` wale generic routes se **pehle** likhe gaye hain. Agar tum naya route add karo to yehi pattern follow karo, warna Express `flat` ko `id` samajh lega.
2. **Immutable fields:** Kuch fields ek baar set hone ke baad change nahi hote — `field_definitions.code`, `categories.type` (seedhe PUT se), `product_definitions.categoryId`, `vendors.vendorCode`. In field ko update request mein bhejoge to error milega.
3. **Soft-delete hi hota hai, hard-delete nahi:** Kabhi bhi socho data "gayab" ho gaya, pehle `showInactive=true` query laga ke check karo — wo trash mein hoga.
4. **Auth abhi nahi hai:** Testing karte waqt Postman mein token bhejne ki zaroorat nahi (kyunki backend check hi nahi karta). Production deploy se pehle ye zaroor add karna padega.
5. **Purchase Order mein restore API missing hai** — ye ek known gap hai, agar future mein zaroorat pade to add karna hoga.

---

*Document generated: 2026-07-14*
