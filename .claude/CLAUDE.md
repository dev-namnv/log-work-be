# log-work-be

## Project

NestJS + Mongoose (MongoDB) backend for a work-log / time-tracking app.
Users clock in/out per organization; hours are computed against each org's
`workSchedule` (start/end time, lunch break) to produce monthly reports,
overtime/missing-hours metrics, and shareable report links. Also integrates
with GitHub/GitLab to append commits to work-log notes.

- **Runtime**: NestJS 10, TypeScript, MongoDB via `@nestjs/mongoose`.
- **Auth**: JWT (`@nestjs/passport`), guards + decorators in `src/guards`, `src/decorators`.
- **Scheduling**: `@nestjs/schedule` (`ScheduleModule.forRoot()` in `app.module.ts`).
- **Dates**: `date-fns` / `date-fns-tz` — do NOT use raw `Date` math when a
  date-fns helper exists (`addDays`, `differenceInMinutes`, `startOfDay`, …).

## Layout

- `src/modules/<feature>/` — one folder per feature: `*.module.ts`,
  `*.controller.ts`, `*.service.ts`, optional `*.scheduler.ts`, and `dto/`.
- `src/schemas/` — Mongoose schemas (`@Schema`, `SchemaFactory`), with indexes
  declared at the bottom of the file.
- `src/utils/`, `src/common/` — shared helpers (pagination, hashing, time, regex).
- `src/decorators/`, `src/guards/`, `src/filters/`, `src/interceptors/` — cross-cutting.

## Code rules

### Scheduling / cron

- Do NOT put `@Cron` decorators inside services. The service defines the
  business-logic method; a dedicated `*.scheduler.ts` provider holds the
  `@Cron` and calls the service method.
- Register the scheduler in its module `providers`.
- Example: `work-log.scheduler.ts` → `WorkLogService.autoCheckoutMissed()`.

### Services

- Business logic lives in services, never in controllers. Controllers only
  validate input (via DTO) and delegate.
- Throw the semantic Nest exception (`NotFoundException`,
  `ForbiddenException`, `BadRequestException`, `GoneException`) — never return
  error objects or throw plain `Error` for expected failures.
- Guard ownership/membership before mutating (check `account._id` against the
  resource's `account` / org `members`), matching existing services.
- Each service has its own `private readonly logger = new Logger(<Name>.name)`;
  wrap loops over external work in try/catch and `logger.error` per item so one
  failure doesn't abort the batch (see `pollAllIntegrations`).

### DTOs & validation

- Every request body/query is a DTO in the feature's `dto/` folder, validated
  with `class-validator` and documented with `@ApiProperty` (Swagger).
- Validate at the DTO layer, not inside the service, whenever the check is
  structural (format, range, required).

### Mongoose

- Convert string ids with `new Types.ObjectId(id)` in filters.
- Prefer `.lean()` for read-only queries returned to the client.
- Declare indexes in the schema file; keep the unique compound indexes intact.
- Money/hours math: round with the existing `Math.round(x * 100) / 100`
  convention (2 decimals).

### General

- Reuse `src/utils` / `src/common` helpers before writing new ones
  (`PaginationUtil` for list endpoints, time/hash utils, etc.).
- Match the surrounding file's style; keep the shortest diff that works.
- No new dependency for something a few lines of stdlib/date-fns can do.
- Run `npx tsc --noEmit` before finishing; the changed files must be clean
  (pre-existing test-file errors aside).
