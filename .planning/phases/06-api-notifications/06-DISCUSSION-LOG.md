# Phase 6: API & Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 06-api-notifications
**Areas discussed:** API design, Email notifications, Job lifecycle, Backward compatibility

---

## API Design & Response Format

### How should POST /api/scrape work?

| Option | Description | Selected |
|--------|-------------|----------|
| Same payload, return jobId | Keep { accountId, targetUsernames, projetoId }. Return 202 with { jobId }. accountId optional. | ✓ |
| New payload, auto account only | Remove accountId entirely. Always auto-select. | |
| Keep accountId required | Same as current, no auto-selection. | |

**User's choice:** Same payload, return jobId (Recommended)

### What should GET /api/jobs/:id return?

| Option | Description | Selected |
|--------|-------------|----------|
| Full status with progress | jobId, status, progress (% + stage), result, error, timestamps | ✓ |
| Simple status only | jobId, status, createdAt only | |
| Status + child jobs | Include list of spawned post-details jobs | |

**User's choice:** Full status with progress details (Recommended)

---

## Email Notification Trigger & Content

### When should the email be sent?

| Option | Description | Selected |
|--------|-------------|----------|
| Once per re-queued job | Send email each time a job hits "no accounts" and gets 30min delay | ✓ |
| Throttled max 1/hour | Max 1 alert per hour regardless of job count | |
| Once per account invalidation | Email when cookie_valid flips to false | |

**User's choice:** Once when job is re-queued (Recommended)

### Who receives the email?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed email from .env | ALERT_EMAIL env var, single admin | ✓ |
| Multiple emails from .env | Comma-separated list | |
| Per-project from database | alert_email column per projeto | |

**User's choice:** Fixed email from .env (Recommended)

---

## Job Lifecycle & Progress Tracking

### Where should job data live?

| Option | Description | Selected |
|--------|-------------|----------|
| Redis only with TTL | BullMQ keeps jobs 24h. Scraped data already in Supabase. | ✓ |
| Also persist to Supabase | Create jobs table for history/analytics | |
| Redis only, no cleanup | Keep indefinitely in Redis | |

**User's choice:** Redis only with TTL (Recommended)

---

## Backward Compatibility

### What happens to current /api/scrape?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with async version | SSE endpoint becomes 202 async. Frontend polls instead. | ✓ |
| Keep both old + new | Maintain two endpoints | |
| Replace + add polling helper | Replace but create frontend polling utility | |

**User's choice:** Replace it with async version (Recommended)

---

## Claude's Discretion

- API route file structure
- Resend SDK integration approach
- BullMQ job TTL values
- Error response format
- Notification utility placement

## Deferred Ideas

None — discussion stayed within phase scope.
