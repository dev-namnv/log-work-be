# Copilot Instructions — log-work-be

## Project Overview

**log-work-be** is a NestJS REST API backend for the **Log Work** application — a work-time tracking system for employees. Core features:

- **Work log**: Record daily working hours per employee.
- **Monthly report**: Aggregate total hours worked in a given month.
- **Organization-based log**: Track logs per workplace/organization.
- **Standard workday calculation**: Compute working days in a month by excluding Saturdays and Sundays (weekends).
- **Authentication**: JWT + HTTP-only cookie, email verification, OTP for admin login.
- **Real-time notifications**: Socket.IO gateway + Telegram bot integration.

---

## Tech Stack

| Layer          | Technology                                                       |
| -------------- | ---------------------------------------------------------------- |
| Framework      | NestJS 10 (TypeScript)                                           |
| Database       | MongoDB via `@nestjs/mongoose` + Mongoose                        |
| Auth           | `@nestjs/passport` + `passport-jwt`, bcryptjs, HTTP-only cookies |
| Cache          | `@nestjs/cache-manager` + Redis (`ioredis`)                      |
| Scheduler      | `@nestjs/schedule`                                               |
| WebSocket      | `@nestjs/websockets` + Socket.IO                                 |
| Mail           | Resend (`resend`)                                                |
| Telegram       | Custom Telegram Bot (polling in dev / webhook in prod)           |
| Date utilities | `date-fns`, `date-fns-tz`                                        |
| Validation     | `class-validator` + `class-transformer`                          |
| API Docs       | `@nestjs/swagger`                                                |
| Rate limiting  | `@nestjs/throttler`                                              |

---

## Project Structure

```
src/
├── common/           # Shared low-level utilities (database, logger, helpers)
├── config/           # Environment configuration (single source via environment.ts)
├── decorators/       # Custom decorators (@Auth, @CurrentAccount, @SkipCache, etc.)
├── dto/              # Shared DTOs (PaginationDto, MongoIdDto)
├── filters/          # Global exception filters
├── guards/           # JWT auth guards, throttle guard, strategies
├── interceptors/     # HttpCache, TransformInterceptor
├── interfaces/       # TypeScript interfaces (Account, MongoId)
├── middleware/       # Express middleware
├── modules/          # Feature modules (auth, account, notice, mail, telegram, ...)
│   ├── app.module.ts # Root module — register all feature modules here
│   └── <feature>/
│       ├── <feature>.module.ts
│       ├── <feature>.controller.ts
│       ├── <feature>.service.ts
│       └── dto/
├── schemas/          # Mongoose schemas (account.ts, notice.ts, ...)
├── shared/           # Shared app-level concerns (transform interceptor, error filter)
└── utils/            # Utility classes (PaginationUtil, TimeUtil, HashUtil, etc.)
```

---

## Code Conventions

### Module Anatomy

Every feature follows **Controller → Service → Schema** layers:

```typescript
// feature.module.ts
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Feature.name, schema: FeatureSchema }]),
  ],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
```

Register new modules in `src/modules/app.module.ts` imports array.

### Mongoose Schema

```typescript
// src/schemas/feature.ts
@Schema({ timestamps: true, collection: 'features' })
export class Feature extends Document {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  account: Types.ObjectId;

  @Prop({ required: true })
  someField: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const FeatureSchema = SchemaFactory.createForClass(Feature);
```

Always add relevant indexes after `SchemaFactory.createForClass(...)`.

### DTOs

- Use `class-validator` decorators for every field.
- Use `@ApiProperty()` from `@nestjs/swagger` for every field.
- Extend `PaginationDto` for list/search endpoints.
- MongoId params use `MongoIdDto` from `src/dto/mongoId.dto.ts`.

```typescript
export class CreateWorkLogDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  organizationId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(24)
  hours: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
```

### Controller Patterns

```typescript
@SkipCache()
@Auth() // Requires JWT cookie
@Controller('work-log')
export class WorkLogController {
  constructor(private readonly workLogService: WorkLogService) {}

  @ApiTags('WorkLog')
  @ApiOperation({ summary: 'Create a work log entry' })
  @Post()
  async create(
    @CurrentAccount() account: Account,
    @Body() dto: CreateWorkLogDto,
  ) {
    return this.workLogService.create(account, dto);
  }

  @ApiTags('WorkLog')
  @Post('/search')
  async search(@Body() dto: SearchWorkLogDto) {
    return this.workLogService.search(dto);
  }
}
```

### Service Patterns

```typescript
@Injectable()
export class WorkLogService {
  constructor(
    @InjectModel(WorkLog.name) private workLogModel: Model<WorkLog>,
  ) {}
}
```

Throw NestJS HTTP exceptions directly:

- `NotFoundException` — resource not found
- `BadRequestException` — invalid input
- `ForbiddenException` — access denied
- `ConflictException` — duplicate resource
- `UnauthorizedException` — unauthenticated

### Authentication & Authorization

| Decorator                  | Usage                                           |
| -------------------------- | ----------------------------------------------- |
| `@Auth()`                  | Require authenticated user (any role)           |
| `@Auth(AccountRole.ADMIN)` | Require ADMIN role                              |
| `@AuthOptional()`          | JWT optional — user may or may not be logged in |
| `@CurrentAccount()`        | Inject the current authenticated `Account`      |
| `@SkipCache()`             | Disable HTTP cache for endpoint                 |
| `@SkipThrottle()`          | Disable rate limiting for endpoint              |

JWT is transmitted via HTTP-only cookie `accessToken`.

### Pagination

Use `PaginationUtil` from `src/utils/pagination.util.ts` for all list endpoints:

```typescript
async search(dto: SearchWorkLogDto): Promise<PaginationResponse<WorkLog>> {
  const filterQuery: FilterQuery<WorkLog> = {};
  const { keyword, page, limit, match, skip, sort } =
    PaginationUtil.getQueryByPagination(dto, filterQuery);

  const data = await this.workLogModel
    .aggregate()
    .match(keyword ? { $text: { $search: keyword } } : match)
    .sort(sort)
    .skip(skip)
    .limit(limit);

  const total = await this.workLogModel.countDocuments(
    keyword ? { $text: { $search: keyword } } : match,
  );

  return PaginationUtil.getPaginationResponse({ data, limit, page, total });
}
```

### Date & Time Utilities

Use `date-fns` and `date-fns-tz` for all date operations. `TimeUtil` is available at `src/utils/time.util.ts`.

**Standard working days calculation** (excluding Saturday=6, Sunday=0):

```typescript
import {
  eachDayOfInterval,
  getDay,
  getDaysInMonth,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

function getStandardWorkingDays(year: number, month: number): number {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end }).filter(
    (day) => getDay(day) !== 0 && getDay(day) !== 6,
  ).length;
}
```

### Notifications

Send in-app, email, and Telegram notifications through `NoticeService`:

```typescript
await this.noticeService.createAndSend({
  dto: {
    type: NoticeType.APPLICATION,
    variant: NoticeVariant.SUCCESS,
    message: `<p>Your work log for <b>March 2026</b> has been submitted.</p>`,
  },
  account,
});
```

---

## Domain Model (planned schemas)

### WorkLog Schema

```
WorkLog {
  account: ObjectId (ref Account)
  organization: ObjectId (ref Organization)
  date: Date
  hours: number           // hours worked that day (0-24)
  note?: string
  createdAt, updatedAt
}
```

### Organization Schema

```
Organization {
  name: string
  description?: string
  owner: ObjectId (ref Account)
  members: ObjectId[]     // ref Account
  isActive: boolean
  createdAt, updatedAt
}
```

### Monthly Report (computed, not stored)

```
MonthlyReport {
  account: Account
  organization: Organization
  month: number (1-12)
  year: number
  totalHours: number
  standardWorkDays: number   // workdays in month (exclude Sat/Sun)
  loggedDays: number
  logs: WorkLog[]
}
```

---

## API Naming Conventions

- **List/search**: `POST /<resource>/search` with `PaginationDto`
- **Create**: `POST /<resource>`
- **Detail**: `GET /<resource>/:id/detail`
- **Update**: `PATCH /<resource>/:id`
- **Delete**: `DELETE /<resource>/:id/delete`
- **Monthly report**: `GET /work-log/monthly-report?month=3&year=2026&organizationId=...`
- **By organization**: `POST /work-log/by-organization` with organizationId + pagination

---

## Environment Variables

All config is accessed through `src/config/environment.ts` — never read `process.env` directly in services.

```typescript
import environment from 'src/config/environment';
const { appName, webHost } = environment();
```

---

## Adding a New Feature Module

1. Create `src/schemas/<feature>.ts` — Mongoose schema.
2. Create `src/modules/<feature>/` with `module`, `controller`, `service`, `dto/`.
3. Register the module in `src/modules/app.module.ts`.
4. Register the new `NoticeType` enum entry in `src/schemas/notice.ts` if notifications are needed.

---

## Testing

- Unit tests: `*.spec.ts` inside `src/`
- E2E tests: `test/app.e2e-spec.ts`
- Run unit: `yarn test`
- Run e2e: `yarn test:e2e`
