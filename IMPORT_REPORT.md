# CSV Import Engine Report

This report was automatically produced by the SplitwisePro CSV Import Engine upon ingesting `Expenses Export.csv`. It details the validation analysis, detected anomalies, and the resolution policy action applied to each row.

---

## Session Summary

- **File Name**: `Expenses Export.csv`
- **Total Rows Processed**: 38 rows
- **Total Anomalies Found**: 15 anomalies
- **Status**: FINALIZED (Resolutions Applied)

---

## Detailed Anomaly Log & Resolution Report

| Row | Date | Description | Payer | Amount | Detected Anomaly | Severity | Action Taken / Policy Applied |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2** | 01-02-2026 | February rent | Aisha | 48000 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **3** | 03-02-2026 | Groceries BigBasket | Priya | 2340 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **4** | 05-02-2026 | Wifi bill Feb | Rohan | 1199 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **5** | 08-02-2026 | Dinner at Marina Bites | Dev | 3200 | Clean row (First entry) | INFO | `IMPORT` - Imported as Equal Split |
| **6** | 08-02-2026 | dinner - marina bites | Dev | 3200 | **Duplicate Expense** (matches Row 5 date, amount, payer) | WARNING | `SKIP` - Skipped duplicate entry to prevent double counting |
| **7** | 10-02-2026 | Electricity Feb | Aisha | 1200 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **8** | 12-02-2026 | Maid salary Feb | Meera | 3000 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **9** | 14-02-2026 | Movie night snacks | priya | 640 | **Spelling Normalization** (lowercase name) | INFO | `IMPORT` - Normalized `priya` to `Priya` and imported |
| **10** | 15-02-2026 | Cylinder refill | Rohan | 899.995 | **Decimal precision** (3 decimal places) | INFO | `IMPORT` - Rounded owed shares to 2 decimals |
| **11** | 18-02-2026 | Groceries DMart | Priya S | 1875 | **Unknown User** (`Priya S` is not registered) | ERROR | `ADJUST` - Mapped `Priya S` to registered user `Priya` and imported |
| **12** | 20-02-2026 | Aisha birthday cake | Rohan | 1500 | Clean unequal split | INFO | `IMPORT` - Imported as unequal split values |
| **13** | 22-02-2026 | House cleaning supplies | | 780 | **Missing Payer** (paid_by is empty) | ERROR | `ADJUST` - Mapped blank payer to `Priya` (based on notes/review) |
| **14** | 25-02-2026 | Rohan paid Aisha back | Rohan | 5000 | **Settlement Logged as Expense** | WARNING | `ADJUST` - Converted row into a **Settlement** record |
| **15** | 28-02-2026 | Pizza Friday | Aisha | 1440 | Clean percentage split | INFO | `IMPORT` - Imported as percentage split |
| **16** | 01-03-2026 | March rent | Aisha | 48000 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **17** | 03-03-2026 | Groceries BigBasket | Meera | 2810 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **18** | 05-03-2026 | Wifi bill Mar | Rohan | 1199 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **19** | 08-03-2026 | Goa flights | Aisha | 32400 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **20** | 09-03-2026 | Goa villa booking | Dev | 540 (USD) | **Currency Inconsistency** (USD currency) | WARNING | `IMPORT` - Converted to INR using exchange rate 83.0 |
| **21** | 10-03-2026 | Beach shack lunch | Rohan | 84 (USD) | **Currency Inconsistency** (USD currency) | WARNING | `IMPORT` - Converted to INR using exchange rate 83.0 |
| **22** | 10-03-2026 | Scooter rentals | Priya | 3600 | Custom share weights split | INFO | `IMPORT` - Weighted split processed (Aisha: 1, Rohan: 2, Priya: 1) |
| **23** | 11-03-2026 | Parasailing | Dev | 150 (USD) | **Unknown User** (`Dev's friend Kabir` unregistered) | ERROR | `ADJUST` - Excluded Kabir from splits, converted USD to INR |
| **24** | 11-03-2026 | Dinner at Thalassa | Aisha | 2400 | Clean row (First entry) | INFO | `IMPORT` - Imported as Equal Split |
| **25** | 11-03-2026 | Thalassa dinner | Rohan | 2450 | **Duplicate Logging** (same meal logged by Rohan) | WARNING | `SKIP` - Skipped row to avoid duplicate logging |
| **26** | 12-03-2026 | Parasailing refund | Dev | -30 (USD) | **Negative Amount** (Refund transaction) | ERROR | `ADJUST` - Adjusted to positive value and logged as refund credit |
| **27** | Mar-14 | Airport cab | rohan | 1100 | **Invalid Date Format** (`Mar-14`) | ERROR | `ADJUST` - Corrected date to `14-03-2026` |
| **28** | 15-03-2026 | Groceries DMart | Priya | 2105 | **Missing Currency** (blank currency field) | WARNING | `IMPORT` - Defaulted currency to INR and imported |
| **29** | 18-03-2026 | Electricity Mar | Aisha | 1450 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **30** | 20-03-2026 | Maid salary Mar | Meera | 3000 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **31** | 22-03-2026 | Dinner order Swiggy | Priya | 0 | **Zero Amount** (Counted twice warning) | WARNING | `SKIP` - Skipped zero amount row |
| **32** | 25-03-2026 | Weekend brunch | Meera | 2200 | Clean percentage split | INFO | `IMPORT` - Imported as percentage split |
| **33** | 28-03-2026 | Meera farewell dinner | Aisha | 48000 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **34** | 04-05-2026 | Deep cleaning service | Rohan | 2500 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **35** | 01-04-2026 | April rent | Aisha | 48000 | Custom share weights split | INFO | `IMPORT` - Weighted split processed (Aisha: 2, Rohan: 1, Priya: 1) |
| **36** | 02-04-2026 | Groceries BigBasket | Priya | 2640 | **Post-Departure Split** (Meera left on 28-03-2026) | WARNING | `ADJUST` - Excluded Meera from splits, recalculated equally |
| **37** | 05-04-2026 | Wifi bill Apr | Rohan | 1199 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
| **38** | 08-04-2026 | Sam deposit share | Sam | 15000 | Clean direct payment | INFO | `IMPORT` - Imported as single split |
| **39** | 10-04-2026 | Housewarming drinks | Sam | 3100 | Clean row | INFO | `IMPORT` - Imported as Equal Split |
