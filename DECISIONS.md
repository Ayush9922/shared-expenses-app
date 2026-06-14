# Architecture and Design Decisions Log

This document records the major design and implementation choices made during the development of SplitwisePro.

---

## Decision 1: Database Model for Membership History

*How do we track user membership timeline in groups when users can leave and rejoin over time?*

- **Options considered**:
  1. **Direct Many-to-Many Table**: Use a simple join table `GroupMembers` containing just `groupId` and `userId`. When a user leaves, delete the row.
  2. **Soft Delete Flag**: A join table with an `isActive` boolean flag.
  3. **Membership Log Timeline (Chosen)**: A join table `GroupMember` with `joinedAt` and a nullable `leftAt` timestamp. When a member leaves, we set `leftAt = now()`. If they rejoin, we insert a **new** record with `joinedAt = now()` and `leftAt = null`.

- **Reasoning**:
  - Option 1 fails to preserve history: if we delete the membership record, we cannot verify if they were a member when an expense was created 3 months ago.
  - Option 2 records the current state but fails to track *multiple join/leave cycles* (e.g., joined in Jan, left in Mar, rejoined in Jun).
  - Option 3 (Chosen) fully preserves history and allows us to determine if a user was a group member on any given historical date (`expense.date >= joinedAt` and `(leftAt == null or expense.date <= leftAt)`). This is critical for auditing and live technical interviews.

---

## Decision 2: Financial Precision for Expense Amounts

*What database data type should be used for storing money amounts and exchange rates?*

- **Options considered**:
  1. **Floating Point (`Float` / `Double`)**: Fast, built-in, but prone to binary representation errors (e.g., `0.1 + 0.2 = 0.30000000000000004`).
  2. **Integers (Cents)**: Store amounts as integers by multiplying by 100 (e.g. 10.50 becomes 1050).
  3. **Decimal (Chosen)**: Database-native fixed-point decimal type (mapped as `Decimal` in Prisma).

- **Reasoning**:
  - Floating point numbers are unacceptable for financial applications because rounding errors accumulate during division (like splits) or currency exchange calculations.
  - Cents (Integers) work well for single-currency applications but become extremely complex when dealing with arbitrary decimals in percentage splits (e.g., 33.333%) or exchange rates (e.g., 1 USD = 83.245 INR).
  - **Decimal** (Chosen) offers native fixed-point arithmetic support, avoiding floating point inaccuracies and natively handling exchange rates with high precision.

---

## Decision 3: Project Structure & Clean Architecture

*How should the project code be organized to facilitate rapid development while remaining explainable for a 45-minute live interview?*

- **Options considered**:
  1. **Monolith Directory**: All files in a single flat directory.
  2. **Domain-Driven Modular Structure**: Organizing code into modules like `auth/`, `groups/`, `expenses/`, containing their own routes, controllers, and models.
  3. **Layered Clean Architecture (Chosen)**: Segregating the codebase into horizontal layers:
     - **Routes**: API endpoints and request mapping.
     - **Controllers**: Parsing inputs, responding with HTTP codes, handling request-response cycles.
     - **Services/Utils**: Core business calculations (e.g. Creditor-Debtor matching, CSV engine).
     - **Models**: Managed by Prisma ORM.

- **Reasoning**:
  - Layered Clean Architecture provides an immediate, clear explanation for any interviewer. You can trace a request from routing, through controllers, into services that run business calculations, down to Prisma queries. This maps exactly to the mental model of software design principles.
