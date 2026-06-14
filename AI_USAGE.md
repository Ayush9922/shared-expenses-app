# AI Usage and Corrections Log

This log documents the usage of AI systems during the development of SplitwisePro, including prompts, incorrect behaviors, and corrections applied.

---

## AI Tools Used
- **Gemini 3.5 Flash (Medium)**: Primary collaborator for design, architecture, and code generation.

---

## Key Prompts Used
1. *"Create database schema models for User, Group, GroupMember, Expense, ExpenseParticipant, Settlement, ImportSession, and ImportIssue using Prisma ORM with proper relations."*
2. *"Implement a clean Group Management Express controller with routes for creating groups, viewing groups, adding members by email, and leaving groups while preserving timeline history."*

---

## AI Error Correction Cases

### Case 1: Incomplete GroupMember History Preservation
- **AI-Generated Code**: The AI initially wrote an `addMember` controller that searched for an existing `GroupMember` record and, if found, simply updated the `leftAt` field back to `null`.
- **How Identified**: During code review, it was observed that if a user joined a group, left, and rejoined, the original `joinedAt` timestamp would be overwritten, destroying the historical timeline of their initial membership period.
- **Correction Made**: The controller logic was rewritten to always create a **new** `GroupMember` record upon join/rejoin, while keeping the old ones with their respective `joinedAt` and `leftAt` values intact. This preserves the complete, auditable timeline history.

### Case 2: Silent Float Inaccuracies in Splits
- **AI-Generated Code**: The AI defined `amount` and `amountOwed` as `Float` in the Prisma schema and used JavaScript's native division (`/`) for splits.
- **How Identified**: In test scenarios (splitting ₹1000 equally among 3 members), the sum of the individual split amounts (`333.33 * 3 = 999.99`) left an unallocated remainder of ₹0.01, creating balancing issues.
- **Correction Made**: Modified the Prisma schema to use `Decimal` for financial amounts. Implemented logic to calculate the remainder (`totalAmount - sum(shares)`) and allocate the remaining cents to the payer or first participant to ensure no money is lost or gained.

### Case 3: Token Validation Failures on Expiry
- **AI-Generated Code**: The authentication middleware caught JWT validation errors but did not handle token expiration specifically, returning a generic `500 Server Error` instead of an explicit `401/403` status.
- **How Identified**: In manual testing, expired tokens caused the server to respond with `500 Unhandled Error`, preventing the frontend from identifying the need to redirect the user to the Login screen.
- **Correction Made**: Updated the token validation catch block in the middleware to explicitly inspect the error type (e.g., `TokenExpiredError`) and send a clear `403 Forbidden` status, allowing the Axios interceptor on the frontend to execute the logout cleanup and login redirect.
