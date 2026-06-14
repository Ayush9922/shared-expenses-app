# Application Scope & Anomaly Log (Spreetail Assignment)

This document maps the database schema and provides the official **Anomaly Log** identifying every data issue found in the provided `Expenses Export.csv` and how the application handles it.

---

## 1. Database Schema

SplitwisePro uses a PostgreSQL relational schema managed via Prisma ORM:
- **User**: ID (UUID), name, email, passwordHash, createdAt, updatedAt.
- **Group**: ID (UUID), name, createdBy (relation to User), createdAt.
- **GroupMember**: ID (UUID), groupId, userId, joinedAt, leftAt (nullable, to track history).
- **Expense**: ID (UUID), title (description), amount, currency, exchangeRate, date, paidBy (User ID), groupId, createdBy, createdAt.
- **ExpenseParticipant**: ID (UUID), expenseId, userId, amountOwed (Decimal), splitType, splitValue.
- **Settlement**: ID (UUID), payerId, receiverId, amount, currency, exchangeRate, date, groupId, createdAt.
- **ImportSession**: ID (UUID), fileName, status, processedCount, anomalyCount, userId, createdAt.
- **ImportIssue**: ID (UUID), importSessionId, rowIndex, rowData, fieldName, issueType, message, severity, policyAction, userApproved, resolvedAt.

---

## 2. CSV Anomaly Log

Below is the exhaustive log of every data problem detected in the provided `Expenses Export.csv` and the corresponding application policy applied.

| Row | Target Field | Anomaly Description | Severity | Policy Action & Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **5 & 6** | `description` | **Duplicate Expense**: Two entries for `Dinner at Marina Bites` / `dinner - marina bites` on `08-02-2026` by Dev for `3200`. | WARNING | Prompt user to `SKIP` the second entry or force import if it was a separate event. |
| **9** | `paid_by` | **Case Normalization**: Payer name is entered as lowercase `priya`. | INFO | Normalizes string to case-insensitive lookup, mapping successfully to user `Priya`. |
| **10** | `amount` | **Float Decimal Places**: Amount is `899.995` (three decimal places). | INFO | Handled by Fixed-Point `Decimal` arithmetic. Rounds owed shares to two decimal places and adds any remainder to the first member. |
| **11** | `paid_by` | **Unknown User**: Payer name is `Priya S` who is not a registered user. | ERROR | Block finalize. User must select `ADJUST` and map `Priya S` to registered user `Priya` or skip the row. |
| **13** | `paid_by` | **Missing Payer**: Paid by field is empty. Notes state "can't remember who paid". | ERROR | Block finalize. User must select `ADJUST` to designate a payer or skip the row. |
| **14** | `split_type` | **Settlement Logged as Expense**: `Rohan paid Aisha back` with empty split type. Notes confirm "this is a settlement". | WARNING | Prompt user to change action to **Import as Settlement**. Rewrites transaction to `Settlement` table instead of `Expense`. |
| **20, 21, 23, 26** | `currency` | **Currency Inconsistency**: Goa booking, shack lunch, and parasailing are in `USD`. | WARNING | System flags USD usage. User can specify an `exchangeRate` adjustment (default 83.0 used for conversion to INR). |
| **22 & 35** | `split_type` | **Custom Share Splits**: Split type is `share` with weights like `Aisha 2; Rohan 1; Priya 1`. | INFO | Handled by our custom **SHARE split engine**. Divides totals proportionally (Aisha pays 2/4 = 50%, Rohan 25%, Priya 25%). |
| **23** | `split_with` | **Unknown Participant**: Split includes `Dev's friend Kabir` who is unregistered. Notes: "Kabir joined for the day". | ERROR | Block finalize. User must select `ADJUST` to map/create stub user for Kabir, adjust the split list, or skip the row. |
| **24 & 25** | `paid_by` | **Payer Collision / Duplicate**: Row 24 is logged by Aisha (`2400`), Row 25 is logged by Rohan (`2450`) for `Thalassa dinner`. | WARNING | Flagged as possible double entry of the same meal. User decides to skip one or adjust. |
| **26** | `amount` | **Negative Amount (Refund)**: Amount is `-30` for `Parasailing refund`. | ERROR | Block finalize. System blocks negative expense values. User can `SKIP` or `ADJUST` to a positive refund credit. |
| **27** | `date` | **Invalid Date Format**: Date is string `Mar-14` (missing year). | ERROR | Block finalize. User must `ADJUST` date to `14-03-2026` or skip the row. |
| **28** | `currency` | **Missing Currency**: Currency column is empty. | WARNING | System flags missing currency (defaulting to INR). |
| **31** | `amount` | **Zero Amount**: `Dinner order Swiggy` amount is `0`. Note: "counted twice earlier". | WARNING | System flags zero expense. User can `SKIP` or import with warning. |
| **36** | `split_with` | **Post-Departure Split**: `Groceries` split includes `Meera` on `02-04-2026`, but Meera left the group on `28-03-2026`. | WARNING | System flags post-departure split. User can select `ADJUST` to exclude Meera and redistribute shares equally among remaining members. |
