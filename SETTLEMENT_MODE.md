# SETTLEMENT_MODE

This fork adds a `SETTLEMENT_MODE` environment variable that changes how
balances are tracked and settled.

---

## Values

### `accumulated` (default — original behaviour)

```
SETTLEMENT_MODE=accumulated
```

Balances are computed by summing all unsettled splits across every expense
between a pair of users. If A owes B $30 from expense 1 and B owes A $20
from expense 2, the Balances screen shows A owes B a net $10.

Settling creates a new SETTLEMENT-type expense that cancels out the
accumulated debt. The "Simplify Debts" feature is available in group views.

This is the exact original SplitPro behaviour. No data is changed and no
schema columns are read.

### `per_expense`

```
SETTLEMENT_MODE=per_expense
```

Each expense is isolated. The Balances screen shows a list of individual
unsettled expenses, not a netted total per person.

- Each expense shows: who paid, total amount, each person's share, and
  which participants still owe.
- **"Settle for me"** marks your own share of one specific expense as settled.
- **"Mark settled for [user]"** (payer only) marks another person's share settled.
- No cross-expense netting. A owes B $30 from expense 1 and B owes A $20
  from expense 2 — both must be settled independently.
- "Simplify Debts" is hidden (it conflicts with per-expense isolation).
- Group views show the unsettled expense list for that group instead of a
  netted aggregate.

**Important:** Switching modes on a live instance does not migrate historical
data. If you ran in `accumulated` mode and created SETTLEMENT-type expenses,
those remain in the database but are invisible in `per_expense` mode. All
`ExpenseParticipant` rows have `settledAt = NULL` by default, so everything
will appear unsettled when you first switch to `per_expense` mode.

---

## Deploying from GHCR

Every push to `main` and every `v*` tag builds a multi-platform image
(linux/amd64 + linux/arm64) and pushes it to:

```
ghcr.io/SohamDarekar/split-pro:latest   # main branch
ghcr.io/SohamDarekar/split-pro:1.2.3    # tag v1.2.3
ghcr.io/SohamDarekar/split-pro:main     # branch name
```

### Coolify deployment

1. In Coolify, create a new **Docker Compose** service.
2. Paste the contents of `docker-compose.example.yml`, replacing
   `<placeholder-username>` with `SohamDarekar`.
3. Set your environment variables in Coolify's **Environment** panel
   (copy from `.env.example`). Key ones:

   ```
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=<strong-password>
   POSTGRES_DB=splitpro
   POSTGRES_CONTAINER_NAME=splitpro-db
   DATABASE_URL=postgresql://postgres:<password>@splitpro-db:5432/splitpro
   NEXTAUTH_SECRET=<random-32-char-string>
   NEXTAUTH_URL=https://<your-domain>
   SETTLEMENT_MODE=per_expense
   ```

4. In the splitpro service, uncomment `HOSTNAME=0.0.0.0` so the server
   listens on all interfaces (required for Coolify's reverse proxy).
5. Remove or comment out the `ports` block — Coolify's proxy handles routing.
6. Set your domain in Coolify's domain settings and enable SSL.

### Generating NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

---

## Keeping in sync with upstream

```bash
git remote add upstream https://github.com/oss-apps/split-pro.git
git fetch upstream
git merge upstream/main
```

Conflicts will be minimal because all fork-specific logic is gated behind
`SETTLEMENT_MODE` checks rather than replacing upstream code. The only files
that diverge structurally are:

- `prisma/schema.prisma` — one added field (`settledAt`)
- `src/env.ts` — one added env var
- `src/server/api/routers/expense.ts` — three new procedures + two early-returns
- `src/server/api/routers/user.ts` — one early-return
- `src/server/api/routers/group.ts` — gated balance checks
- `src/pages/balances.tsx` — mode branch in render
- `src/pages/groups/[groupId].tsx` — mode branch in render
- `src/components/Expense/UnsettledExpenseList.tsx` — new file, no conflict

When upstream adds new procedures that also reference balances or the
`ExpenseParticipant` model, check whether they need a `per_expense` gate.

---

## Rollback

To revert to original SplitPro behaviour without redeploying:

```
SETTLEMENT_MODE=accumulated
```

Restart the container. No database changes required — the `settledAt` column
is ignored in accumulated mode and the BalanceView is unchanged.

To revert to the original upstream image entirely:

```yaml
# docker-compose.yml
image: ossapps/splitpro:latest
```

The `settledAt` column added by this fork is nullable and ignored by the
upstream code, so the database remains compatible.
