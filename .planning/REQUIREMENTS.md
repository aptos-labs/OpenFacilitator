# Requirements: OpenFacilitator

**Defined:** 2026-01-22
**Core Value:** Users who process volume through OpenFacilitator get rewarded with $OPEN tokens. Facilitator owners get seamless subscription management with multi-chain support.

## v1.2 Requirements

Requirements for Subscription Wallet Overhaul milestone.

### UI Cleanup

- [ ] **UICL-01**: Legacy embedded wallet removed from app header
- [ ] **UICL-02**: Existing embedded wallet component archived (not deleted)
- [ ] **UICL-03**: No orphaned wallet connection code in header

### Subscriptions Dashboard

- [ ] **SUBD-01**: Subscriptions tab added to dashboard navigation
- [ ] **SUBD-02**: Subscription status displayed (active/inactive/pending)
- [ ] **SUBD-03**: Next billing date shown
- [ ] **SUBD-04**: Subscription tier and pricing displayed
- [ ] **SUBD-05**: Payment history with date, amount, chain, tx hash

### Multi-Chain Wallets

- [ ] **WALL-01**: Base wallet implemented alongside Solana wallet
- [ ] **WALL-02**: Each wallet displays balance and chain identifier
- [ ] **WALL-03**: Wallet addresses visible for direct funding
- [ ] **WALL-04**: Real-time balance updates on funding

### Chain Preference

- [ ] **PREF-01**: Chain preference defaults based on initial payment chain
- [ ] **PREF-02**: Prominent preference toggle in Subscriptions section
- [ ] **PREF-03**: Fallback logic checks alternate chain if preferred is insufficient

### Recurring Payment Engine

- [ ] **RECR-01**: Daily billing cron job queries due subscriptions
- [ ] **RECR-02**: Auto-deduction from preferred chain wallet
- [ ] **RECR-03**: Fallback to alternate chain if preferred insufficient
- [ ] **RECR-04**: 7-day grace period before service suspension
- [ ] **RECR-05**: Payment marked "pending" when both wallets insufficient
- [ ] **RECR-06**: All subscription payments logged with tx details

### Notifications

- [ ] **NOTF-01**: Payment successful confirmation shown
- [ ] **NOTF-02**: Low balance warning when balance < 2x subscription cost
- [ ] **NOTF-03**: Payment failed / insufficient funds alert
- [ ] **NOTF-04**: Subscription expiring reminder (3 days before)

## Future Requirements

Deferred to later milestones.

### Rewards Enhancements

- **RWRD-01**: Dashboard features spotlight for discoverability
- **RWRD-02**: Email notifications when threshold reached
- **RWRD-03**: Sybil cluster detection dashboard for admins

### Subscription Enhancements

- **SUBE-01**: Prorated refunds for mid-cycle cancellation
- **SUBE-02**: Fund button with checkout flow (alternative to direct addresses)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Prorated refunds | Simplicity — subscription runs until end of paid period |
| Fund via checkout | Direct addresses preferred for power users, defer to future |
| Monthly funding cap | Pre-fund any amount allowed per user decision |
| Email notifications (subscriptions) | In-app notifications first, email later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UICL-01 | Pending | Pending |
| UICL-02 | Pending | Pending |
| UICL-03 | Pending | Pending |
| SUBD-01 | Pending | Pending |
| SUBD-02 | Pending | Pending |
| SUBD-03 | Pending | Pending |
| SUBD-04 | Pending | Pending |
| SUBD-05 | Pending | Pending |
| WALL-01 | Pending | Pending |
| WALL-02 | Pending | Pending |
| WALL-03 | Pending | Pending |
| WALL-04 | Pending | Pending |
| PREF-01 | Pending | Pending |
| PREF-02 | Pending | Pending |
| PREF-03 | Pending | Pending |
| RECR-01 | Pending | Pending |
| RECR-02 | Pending | Pending |
| RECR-03 | Pending | Pending |
| RECR-04 | Pending | Pending |
| RECR-05 | Pending | Pending |
| RECR-06 | Pending | Pending |
| NOTF-01 | Pending | Pending |
| NOTF-02 | Pending | Pending |
| NOTF-03 | Pending | Pending |
| NOTF-04 | Pending | Pending |

**Coverage:**
- v1.2 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 ⚠️

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-01-22 after initial definition*
