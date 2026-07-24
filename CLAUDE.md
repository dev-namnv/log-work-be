# Project rules

## Scheduling / cron

- Do NOT put `@Cron` decorators inside services. Services define the business
  logic method; a dedicated `*.scheduler.ts` provider holds the `@Cron` and
  calls the service method.
- Register the scheduler in its module `providers`.
- Example: `work-log.scheduler.ts` → `WorkLogService.autoCheckoutMissed()`.
