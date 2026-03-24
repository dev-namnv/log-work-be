# Log Work — API Documentation

> For the **Frontend** team. All responses follow the project's standard envelope; errors return `{ message: string, statusCode: number }`.

---

## Table of Contents

1. [Base URL & Auth](#1-base-url--auth)
2. [App](#2-app)
3. [Auth](#3-auth)
4. [Account (Admin)](#4-account-admin)
5. [Notice](#5-notice)
6. [Organization](#6-organization)
7. [Work Log](#7-work-log)
   - 7.1 [Work Log Share](#71-work-log-share)
8. [Telegram](#8-telegram)

---

## 1. Base URL & Auth

| Key            | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Base URL       | `http://localhost:8080` (configure via `APP_HOST` + `PORT`)          |
| Auth mechanism | HTTP-only cookie `accessToken` (set automatically on login/register) |
| Content-Type   | `application/json`                                                   |

**Cookie is sent automatically by the browser** as long as requests are made with `credentials: 'include'` (fetch) or `withCredentials: true` (axios).

### Account Roles

| Role    | Description                                                             |
| ------- | ----------------------------------------------------------------------- |
| `USER`  | Regular user (default)                                                  |
| `ADMIN` | Administrator — required for account management, sending system notices |

---

## 2. App

### `GET /clear-caching`

Clear all server-side response cache.

> No auth required.

**Response**

```
"Cache was clear!"
```

---

### `GET /test-auth`

Test endpoint to verify cookie-based auth is working.

> Requires: **login** (any role)

**Response**

```json
{
  "message": "Auth works with cookie!",
  "account": {
    "id": "665f...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

### `GET /test-auth-optional`

Test endpoint that works with or without a logged-in session.

> No auth required.

**Response**

```json
{
  "message": "AuthOptional works!",
  "isAuthenticated": true,
  "account": {
    "id": "665f...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

## 3. Auth

All auth endpoints are under the `/auth` prefix.

---

### `POST /auth/register`

Register a new account. Sets the `accessToken` cookie on success.

> No auth required.

**Request Body**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "Secret123",
  "inviteCode": "abc123"
}
```

| Field       | Type     | Required | Notes                      |
| ----------- | -------- | -------- | -------------------------- |
| `firstName` | `string` | ✅       | Trimmed                    |
| `lastName`  | `string` | ✅       | Trimmed                    |
| `email`     | `string` | ✅       | Must be a valid email      |
| `password`  | `string` | ✅       | Min 6 chars, no whitespace |

**Response** — `201 Created`

```json
{
  "account": { ...Account }
}
```

---

### `POST /auth/login`

Login with email and password. Sets the `accessToken` cookie on success. Admin accounts with 2FA will receive an OTP via Telegram instead.

> No auth required.

**Request Body**

```json
{
  "email": "john.doe@example.com",
  "password": "Secret123"
}
```

| Field      | Type     | Required | Notes                      |
| ---------- | -------- | -------- | -------------------------- |
| `email`    | `string` | ✅       | Valid email                |
| `password` | `string` | ✅       | Min 6 chars, no whitespace |

**Response** — `200 OK`

```json
{
  "account": { ...Account }
}
```

> For ADMIN accounts with OTP enabled, you will receive a `202` or error prompting OTP verification via `/auth/verify-otp`.

---

### `GET /auth/profile`

Get the currently authenticated user's profile.

> Requires: **login**

**Response** — `200 OK`

```json
{
  "_id": "665f1a2b3c4d5e6f7a8b9c0d",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": null,
  "avatar": null,
  "role": "USER",
  "isVerified": false,
  "metadata": {
    "sendMail": true,
    "telegramChatId": null,
    "sendTelegram": false
  },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-03-01T00:00:00.000Z"
}
```

---

### `PATCH /auth/change-password`

Change the current user's password.

> Requires: **login**

**Request Body**

```json
{
  "password": "OldPassword123",
  "newPassword": "NewPassword456",
  "newPasswordConfirm": "NewPassword456"
}
```

| Field                | Type     | Required | Notes                         |
| -------------------- | -------- | -------- | ----------------------------- |
| `password`           | `string` | ✅       | Current password, min 6 chars |
| `newPassword`        | `string` | ✅       | New password, min 6 chars     |
| `newPasswordConfirm` | `string` | ✅       | Must match `newPassword`      |

**Response** — `200 OK`

```json
{ "message": "Password changed successfully" }
```

---

### `PUT /auth/update-profile`

Update the authenticated user's profile.

> Requires: **login**

**Request Body**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "languages": ["en", "vi"]
}
```

| Field       | Type       | Required | Notes                   |
| ----------- | ---------- | -------- | ----------------------- |
| `firstName` | `string`   | ✅       |                         |
| `lastName`  | `string`   | ✅       |                         |
| `email`     | `string`   | ✅       | Valid email             |
| `languages` | `string[]` | ✅       | Array of language codes |

**Response** — `200 OK` — Updated `Account` object.

---

### `PATCH /auth/update-metadata`

Update user metadata settings (notification preferences, etc.).

> Requires: **login**

**Request Body**

```json
{
  "sendMail": true,
  "sendTelegram": false
}
```

**Response** — `200 OK` — Updated `Account` object.

---

### `PATCH /auth/update-telegram`

Set Telegram Chat ID to receive real-time notifications. Send `null` or empty string to disable.

> Requires: **login**

**Request Body**

```json
{
  "telegramChatId": "123456789"
}
```

| Field            | Type             | Required | Notes                                    |
| ---------------- | ---------------- | -------- | ---------------------------------------- |
| `telegramChatId` | `string \| null` | ✅       | Telegram chat ID; send `null` to disable |

**Response** — `200 OK` — Updated `Account` object.

---

### `POST /auth/forgot-password`

Send a password reset email.

> No auth required.

**Request Body**

```json
{
  "email": "john.doe@example.com"
}
```

**Response** — `200 OK`

```json
{ "message": "Reset password email sent" }
```

---

### `POST /auth/reset-password`

Reset the password using the key received in the reset email.

> No auth required.

**Request Body**

```json
{
  "key": "reset-token-from-email",
  "password": "NewPassword456"
}
```

| Field      | Type     | Required | Notes                      |
| ---------- | -------- | -------- | -------------------------- |
| `key`      | `string` | ✅       | Token from the reset email |
| `password` | `string` | ✅       | New password               |

**Response** — `200 OK`

```json
{ "message": "Password reset successfully" }
```

---

### `POST /auth/verify/check/:token`

Verify email address using the token sent in the verification email.

> No auth required.

**URL Params**

| Param   | Type     | Notes                   |
| ------- | -------- | ----------------------- |
| `token` | `string` | From verification email |

**Response** — `200 OK`

```json
{ "message": "Account verified successfully" }
```

---

### `POST /auth/verify/resend`

Resend the email verification link.

> Requires: **login**

**Response** — `200 OK`

```json
{ "message": "Verification email sent" }
```

---

### `DELETE /auth/request-delete`

Request deletion of the current account.

> Requires: **login**

**Response** — `200 OK`

```json
{ "message": "Account deletion requested" }
```

---

### `POST /auth/verify-otp`

Verify OTP code for ADMIN two-factor login. Sets the `accessToken` cookie on success.

> No auth required.

**Request Body**

```json
{
  "email": "admin@example.com",
  "otp": "123456"
}
```

| Field   | Type     | Required | Notes            |
| ------- | -------- | -------- | ---------------- |
| `email` | `string` | ✅       | Admin email      |
| `otp`   | `string` | ✅       | 6-digit OTP code |

**Response** — `200 OK`

```json
{
  "account": { ...Account }
}
```

---

### `POST /auth/resend-otp`

Resend OTP for ADMIN login.

> No auth required.

**Request Body**

```json
{
  "email": "admin@example.com"
}
```

**Response** — `200 OK`

```json
{ "message": "OTP sent" }
```

---

### `POST /auth/logout`

Logout the current session. Clears the `accessToken` cookie.

> No auth required.

**Response** — `200 OK`

```json
{ "message": "Logged out successfully" }
```

---

## 4. Account (Admin)

All endpoints under `/account` require **ADMIN** role.

---

### `POST /account/search`

Search and paginate all accounts.

> Requires: **ADMIN**

**Request Body**

```json
{
  "keyword": "john",
  "page": 1,
  "limit": 20
}
```

| Field     | Type     | Required | Notes                                          |
| --------- | -------- | -------- | ---------------------------------------------- |
| `keyword` | `string` | ❌       | Full-text search on email, firstName, lastName |
| `page`    | `number` | ❌       | Default: `1`                                   |
| `limit`   | `number` | ❌       | Default: `20`                                  |

**Response** — `200 OK`

```json
{
  "data": [ ...Account[] ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

---

### `GET /account/:id/detail`

Get a single account by its MongoDB ID.

> Requires: **ADMIN**

**URL Params**

| Param | Type     | Notes            |
| ----- | -------- | ---------------- |
| `id`  | `string` | MongoDB ObjectId |

**Response** — `200 OK` — `Account` object.

---

### `DELETE /account/:id/delete`

Permanently delete an account.

> Requires: **ADMIN**

**URL Params**

| Param | Type     | Notes            |
| ----- | -------- | ---------------- |
| `id`  | `string` | MongoDB ObjectId |

**Response** — `200 OK`

```json
{ "message": "Account deleted" }
```

---

## 5. Notice

In-app notification system. Notices are delivered in real-time via **Socket.IO** and stored in the database.

---

### `GET /notice/all`

Get all unread notices for the current user.

> Requires: **login**

**Response** — `200 OK`

```json
[
  {
    "_id": "665f...",
    "account": "665f...",
    "type": "Work Log",
    "message": "<p>Your work log for <b>March 2026</b> has been submitted.</p>",
    "viewed": false,
    "variant": "success",
    "link": null,
    "createdAt": "2026-03-23T09:00:00.000Z",
    "updatedAt": "2026-03-23T09:00:00.000Z"
  }
]
```

**Notice `type` values:** `Registered` | `Application` | `Error` | `Work Log`

**Notice `variant` values:** `default` | `success` | `warning` | `error`

---

### `PATCH /notice/:id/mask-as-read`

Mark a specific notice as read.

> Requires: **login**

**URL Params**

| Param | Type     | Notes                          |
| ----- | -------- | ------------------------------ |
| `id`  | `string` | MongoDB ObjectId of the notice |

**Response** — `200 OK` — Updated `Notice` object.

---

### `POST /notice/clear-all`

Delete all notices for the current user.

> Requires: **login**

**Response** — `200 OK`

```json
{ "message": "All notices cleared" }
```

---

### `POST /notice/notice-to-all-users`

Broadcast a notice to every user in the system.

> Requires: **ADMIN**

**Request Body**

```json
{
  "type": "Application",
  "variant": "success",
  "message": "<p>System maintenance scheduled for Sunday.</p>",
  "link": "https://example.com"
}
```

| Field     | Type            | Required | Notes                                                  |
| --------- | --------------- | -------- | ------------------------------------------------------ |
| `type`    | `NoticeType`    | ✅       | `Registered` \| `Application` \| `Error` \| `Work Log` |
| `variant` | `NoticeVariant` | ❌       | `default` \| `success` \| `warning` \| `error`         |
| `message` | `string`        | ✅       | HTML string                                            |
| `link`    | `string`        | ❌       | Optional action URL                                    |

**Response** — `200 OK`

```json
{ "message": "Notice sent to all users" }
```

---

### `POST /notice/notice-to-user`

Send a notice to a specific user.

> Requires: **ADMIN**

**Request Body**

```json
{
  "id": "665f1a2b3c4d5e6f7a8b9c0d",
  "type": "Application",
  "variant": "warning",
  "message": "<p>Your account will be suspended.</p>",
  "link": null
}
```

| Field     | Type            | Required | Notes                           |
| --------- | --------------- | -------- | ------------------------------- |
| `id`      | `string`        | ✅       | Target account MongoDB ObjectId |
| `type`    | `NoticeType`    | ✅       |                                 |
| `variant` | `NoticeVariant` | ❌       |                                 |
| `message` | `string`        | ✅       | HTML string                     |
| `link`    | `string`        | ❌       |                                 |

**Response** — `200 OK` — Notice object.

---

### `POST /notice/notice-to-some-users`

Send a notice to multiple specific users.

> Requires: **ADMIN**

**Request Body**

```json
{
  "ids": ["665f...", "666a..."],
  "type": "Application",
  "variant": "default",
  "message": "<p>Reminder: submit your work logs.</p>",
  "link": null
}
```

| Field     | Type            | Required | Notes                             |
| --------- | --------------- | -------- | --------------------------------- |
| `ids`     | `string[]`      | ✅       | Array of target account ObjectIds |
| `type`    | `NoticeType`    | ✅       |                                   |
| `variant` | `NoticeVariant` | ❌       |                                   |
| `message` | `string`        | ✅       | HTML string                       |
| `link`    | `string`        | ❌       |                                   |

**Response** — `200 OK`

```json
{ "message": "Notices sent" }
```

---

## 6. Organization

Manage workplaces/organizations. Each organization has an owner, members, and a configurable work schedule used for computing standard hours.

---

### `POST /organization`

Create a new organization. The creator becomes the `owner`.

> Requires: **login**

**Request Body**

```json
{
  "name": "Acme Corp",
  "description": "Main office",
  "workSchedule": {
    "workStartTime": "08:00",
    "workEndTime": "17:30",
    "lunchBreakMinutes": 60
  }
}
```

| Field          | Type              | Required | Notes                                   |
| -------------- | ----------------- | -------- | --------------------------------------- |
| `name`         | `string`          | ✅       |                                         |
| `description`  | `string`          | ❌       |                                         |
| `workSchedule` | `WorkScheduleDto` | ❌       | Defaults to `08:00–17:30, 60 min lunch` |

**WorkScheduleDto fields**

| Field               | Type     | Required | Notes                                     |
| ------------------- | -------- | -------- | ----------------------------------------- |
| `workStartTime`     | `string` | ✅       | Format: `HH:mm` (24-hour), e.g. `"08:00"` |
| `workEndTime`       | `string` | ✅       | Format: `HH:mm` (24-hour), e.g. `"17:30"` |
| `lunchBreakMinutes` | `number` | ✅       | Integer 0–240                             |

**Response** — `201 Created`

```json
{
  "_id": "665f...",
  "name": "Acme Corp",
  "description": "Main office",
  "avatar": null,
  "owner": "665f1a2b3c4d5e6f7a8b9c0d",
  "members": [],
  "isActive": true,
  "workSchedule": {
    "workStartTime": "08:00",
    "workEndTime": "17:30",
    "lunchBreakMinutes": 60
  },
  "createdAt": "2026-03-01T00:00:00.000Z",
  "updatedAt": "2026-03-01T00:00:00.000Z"
}
```

---

### `POST /organization/search`

Search organizations where the current user is owner or member.

> Requires: **login**

**Request Body**

```json
{
  "keyword": "acme",
  "page": 1,
  "limit": 20
}
```

| Field     | Type     | Required | Notes                                 |
| --------- | -------- | -------- | ------------------------------------- |
| `keyword` | `string` | ❌       | Full-text search on name, description |
| `page`    | `number` | ❌       | Default: `1`                          |
| `limit`   | `number` | ❌       | Default: `20`                         |

**Response** — `200 OK`

```json
{
  "data": [ ...Organization[] ],
  "total": 5,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### `GET /organization/:id/detail`

Get organization details.

> Requires: **login**

**URL Params**

| Param | Type     | Notes            |
| ----- | -------- | ---------------- |
| `id`  | `string` | MongoDB ObjectId |

**Response** — `200 OK` — `Organization` object (with `owner` and `members` populated).

---

### `PATCH /organization/:id`

Update organization info. **Owner only.**

> Requires: **login** (must be owner)

**URL Params**

| Param | Type     | Notes            |
| ----- | -------- | ---------------- |
| `id`  | `string` | MongoDB ObjectId |

**Request Body** — all fields optional

```json
{
  "name": "Acme Corp Updated",
  "description": "New description",
  "isActive": true,
  "workSchedule": {
    "workStartTime": "09:00",
    "workEndTime": "18:00",
    "lunchBreakMinutes": 60
  }
}
```

**Response** — `200 OK` — Updated `Organization` object.

---

### `DELETE /organization/:id/delete`

Delete an organization. **Owner only.**

> Requires: **login** (must be owner)

**URL Params**

| Param | Type     | Notes            |
| ----- | -------- | ---------------- |
| `id`  | `string` | MongoDB ObjectId |

**Response** — `200 OK`

```json
{ "message": "Organization deleted" }
```

---

### `POST /organization/:id/add-member`

Add a member to the organization. **Owner only.**

> Requires: **login** (must be owner)

**URL Params**

| Param | Type     | Notes                         |
| ----- | -------- | ----------------------------- |
| `id`  | `string` | Organization MongoDB ObjectId |

**Request Body**

```json
{
  "memberId": "665f1a2b3c4d5e6f7a8b9c0d"
}
```

| Field      | Type     | Required | Notes                                      |
| ---------- | -------- | -------- | ------------------------------------------ |
| `memberId` | `string` | ✅       | Account MongoDB ObjectId of the new member |

**Response** — `200 OK` — Updated `Organization` object.

---

### `POST /organization/:id/remove-member`

Remove a member from the organization. **Owner only.**

> Requires: **login** (must be owner)

**URL Params**

| Param | Type     | Notes                         |
| ----- | -------- | ----------------------------- |
| `id`  | `string` | Organization MongoDB ObjectId |

**Request Body**

```json
{
  "memberId": "665f1a2b3c4d5e6f7a8b9c0d"
}
```

**Response** — `200 OK` — Updated `Organization` object.

---

### `PATCH /organization/:id/work-schedule`

Update the work schedule configuration for an organization. **Owner only.**

The backend automatically computes `standardHoursPerDay` from these values when generating reports:

```
standardHoursPerDay = (workEndTime − workStartTime) − lunchBreakMinutes / 60
```

Example: `08:00 → 17:30` minus `60 min` = **8.5 h/day**

> Requires: **login** (must be owner)

**URL Params**

| Param | Type     | Notes                         |
| ----- | -------- | ----------------------------- |
| `id`  | `string` | Organization MongoDB ObjectId |

**Request Body**

```json
{
  "workSchedule": {
    "workStartTime": "08:00",
    "workEndTime": "17:30",
    "lunchBreakMinutes": 60
  }
}
```

| Field                            | Type     | Required | Notes                   |
| -------------------------------- | -------- | -------- | ----------------------- |
| `workSchedule.workStartTime`     | `string` | ✅       | `HH:mm` format, 24-hour |
| `workSchedule.workEndTime`       | `string` | ✅       | `HH:mm` format, 24-hour |
| `workSchedule.lunchBreakMinutes` | `number` | ✅       | Integer, 0–240 minutes  |

**Response** — `200 OK` — Updated `Organization` object.

---

## 7. Work Log

Daily check-in/check-out records for employees. The backend automatically computes `hours` from `checkIn` and `checkOut`.

```
hours = differenceInMinutes(checkOut, checkIn) / 60   (rounded to 2 decimal places)
```

One entry per `(account, organization, date)` — duplicates are rejected.

---

### `POST /work-log`

Create a work log entry for the current day.

> Requires: **login**

**Request Body**

```json
{
  "organizationId": "665f...",
  "checkIn": "2026-03-23T08:00:00.000Z",
  "checkOut": "2026-03-23T17:30:00.000Z",
  "note": "Normal work day"
}
```

| Field            | Type     | Required | Notes                                       |
| ---------------- | -------- | -------- | ------------------------------------------- |
| `organizationId` | `string` | ✅       | MongoDB ObjectId of the organization        |
| `checkIn`        | `string` | ✅       | ISO 8601 datetime                           |
| `checkOut`       | `string` | ✅       | ISO 8601 datetime — must be after `checkIn` |
| `note`           | `string` | ❌       | Optional note                               |

**Response** — `201 Created`

```json
{
  "_id": "666a...",
  "account": "665f...",
  "organization": "665f...",
  "date": "2026-03-23T00:00:00.000Z",
  "checkIn": "2026-03-23T08:00:00.000Z",
  "checkOut": "2026-03-23T17:30:00.000Z",
  "hours": 9.5,
  "note": "Normal work day",
  "createdAt": "2026-03-23T17:35:00.000Z",
  "updatedAt": "2026-03-23T17:35:00.000Z"
}
```

**Errors**

| Status | Reason                                                             |
| ------ | ------------------------------------------------------------------ |
| `400`  | `checkOut` is not after `checkIn`                                  |
| `409`  | A work log already exists for that `(account, organization, date)` |
| `404`  | Organization not found                                             |

---

### `POST /work-log/search`

Search/paginate work log entries for the current user.

> Requires: **login**

**Request Body**

```json
{
  "keyword": "",
  "page": 1,
  "limit": 20
}
```

| Field     | Type     | Required | Notes                      |
| --------- | -------- | -------- | -------------------------- |
| `keyword` | `string` | ❌       | Full-text search on `note` |
| `page`    | `number` | ❌       | Default: `1`               |
| `limit`   | `number` | ❌       | Default: `20`              |

**Response** — `200 OK`

```json
{
  "data": [ ...WorkLog[] ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### `GET /work-log/monthly-report`

Get the monthly work summary for the current user. Optionally filter by organization.

> Requires: **login**

**Query Params**

| Param            | Type     | Required | Notes                           |
| ---------------- | -------- | -------- | ------------------------------- |
| `month`          | `number` | ✅       | 1–12                            |
| `year`           | `number` | ✅       | e.g. `2026`                     |
| `organizationId` | `string` | ❌       | Filter by organization ObjectId |

**Example request:** `GET /work-log/monthly-report?month=3&year=2026&organizationId=665f...`

**Response** — `200 OK`

```json
{
  "month": 3,
  "year": 2026,
  "workSchedule": {
    "workStartTime": "08:00",
    "workEndTime": "17:30",
    "lunchBreakMinutes": 60
  },
  "standardHoursPerDay": 8.5,
  "standardWorkDays": 21,
  "totalStandardHours": 178.5,
  "totalHours": 165.0,
  "loggedDays": 20,
  "overtimeHours": 0,
  "missingHours": 13.5,
  "attendanceRate": 92.44,
  "logs": [
    {
      "_id": "666a...",
      "account": "665f...",
      "organization": "665f...",
      "date": "2026-03-03T00:00:00.000Z",
      "checkIn": "2026-03-03T08:00:00.000Z",
      "checkOut": "2026-03-03T17:30:00.000Z",
      "hours": 9.5,
      "note": null,
      "createdAt": "2026-03-03T17:35:00.000Z",
      "updatedAt": "2026-03-03T17:35:00.000Z"
    }
  ]
}
```

**Response fields explained**

| Field                 | Type        | Description                                                      |
| --------------------- | ----------- | ---------------------------------------------------------------- |
| `workSchedule`        | `object`    | Org's schedule config (falls back to default if no org filtered) |
| `standardHoursPerDay` | `number`    | Net hours/day = `(endTime − startTime) − lunchBreakMinutes/60`   |
| `standardWorkDays`    | `number`    | Count of Mon–Fri days in the month (excludes weekends)           |
| `totalStandardHours`  | `number`    | `standardHoursPerDay × standardWorkDays`                         |
| `totalHours`          | `number`    | Sum of `hours` across all logged entries                         |
| `loggedDays`          | `number`    | Number of distinct days with a log entry                         |
| `overtimeHours`       | `number`    | `max(0, totalHours − totalStandardHours)`                        |
| `missingHours`        | `number`    | `max(0, totalStandardHours − totalHours)`                        |
| `attendanceRate`      | `number`    | `(totalHours / totalStandardHours) × 100` — percentage (2 dp)    |
| `logs`                | `WorkLog[]` | All log entries for the period                                   |

---

### `POST /work-log/by-organization`

Get per-member work log analytics for a given organization, month, and year.

> Requires: **login** (must be owner or member of the organization)

**Request Body**

```json
{
  "organizationId": "665f...",
  "month": 3,
  "year": 2026
}
```

| Field            | Type     | Required | Notes            |
| ---------------- | -------- | -------- | ---------------- |
| `organizationId` | `string` | ✅       | MongoDB ObjectId |
| `month`          | `number` | ✅       | 1–12             |
| `year`           | `number` | ✅       | e.g. `2026`      |

**Response** — `200 OK`

```json
{
  "organization": {
    "_id": "665f...",
    "name": "Acme Corp",
    "workSchedule": {
      "workStartTime": "08:00",
      "workEndTime": "17:30",
      "lunchBreakMinutes": 60
    }
  },
  "month": 3,
  "year": 2026,
  "standardHoursPerDay": 8.5,
  "standardWorkDays": 21,
  "totalStandardHours": 178.5,
  "members": [
    {
      "account": {
        "_id": "665f...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "avatar": null
      },
      "totalHours": 165.0,
      "loggedDays": 20,
      "overtimeHours": 0,
      "missingHours": 13.5,
      "attendanceRate": 92.44,
      "logs": [ ...WorkLog[] ]
    }
  ]
}
```

---

### `GET /work-log/:id/detail`

Get a single work log entry.

> Requires: **login** (must be the owner of the log)

**URL Params**

| Param | Type     | Notes            |
| ----- | -------- | ---------------- |
| `id`  | `string` | MongoDB ObjectId |

**Response** — `200 OK` — `WorkLog` object.

---

### `PATCH /work-log/:id`

Update a work log entry. Hours are automatically recomputed from the updated `checkIn`/`checkOut`.

> Requires: **login** (must be the owner of the log)

**URL Params**

| Param | Type     | Notes            |
| ----- | -------- | ---------------- |
| `id`  | `string` | MongoDB ObjectId |

**Request Body** — all fields optional

```json
{
  "checkIn": "2026-03-23T08:30:00.000Z",
  "checkOut": "2026-03-23T18:00:00.000Z",
  "note": "Started late"
}
```

| Field      | Type     | Required | Notes                                       |
| ---------- | -------- | -------- | ------------------------------------------- |
| `checkIn`  | `string` | ❌       | ISO 8601 datetime                           |
| `checkOut` | `string` | ❌       | ISO 8601 datetime — must be after `checkIn` |
| `note`     | `string` | ❌       |                                             |

**Response** — `200 OK` — Updated `WorkLog` object.

---

### `DELETE /work-log/:id/delete`

Delete a work log entry.

> Requires: **login** (must be the owner of the log)

**URL Params**

| Param | Type     | Notes            |
| ----- | -------- | ---------------- |
| `id`  | `string` | MongoDB ObjectId |

**Response** — `200 OK`

```json
{ "message": "Work log deleted" }
```

---

## 7.1 Work Log Share

Cho phép người dùng tạo link chia sẻ báo cáo công việc theo tháng để gửi cho HR hoặc kế toán. Link không yêu cầu đăng nhập khi xem.

---

### `POST /work-log/share`

Tạo một link chia sẻ báo cáo công việc theo tháng.

> Requires: **login**

**Request Body**

```json
{
  "month": 3,
  "year": 2026,
  "organizationId": "665f...",
  "label": "Báo cáo tháng 03/2026 — Nguyễn Văn A",
  "expiresAt": "2026-04-30T23:59:59.000Z"
}
```

| Field            | Type     | Required | Notes                                                                            |
| ---------------- | -------- | -------- | -------------------------------------------------------------------------------- |
| `month`          | `number` | ✅       | 1–12                                                                             |
| `year`           | `number` | ✅       | e.g. `2026`                                                                      |
| `organizationId` | `string` | ❌       | Giới hạn báo cáo trong một cơ quan cụ thể. Bỏ trống để hiển thị tất cả cơ quan. |
| `label`          | `string` | ❌       | Nhãn hiển thị, tối đa 100 ký tự. Tự động tạo nếu bỏ trống.                       |
| `expiresAt`      | `string` | ❌       | ISO 8601 — ngày hết hạn. Bỏ trống để link không bao giờ hết hạn.                |

**Response** — `201 Created`

```json
{
  "_id": "667c...",
  "token": "a3f8b2e1c9d047...",
  "account": "665f...",
  "organization": "665f...",
  "month": 3,
  "year": 2026,
  "label": "Báo cáo tháng 03/2026 — Nguyễn Văn A",
  "expiresAt": "2026-04-30T23:59:59.000Z",
  "isActive": true,
  "createdAt": "2026-03-24T08:00:00.000Z",
  "updatedAt": "2026-03-24T08:00:00.000Z"
}
```

> URL chia sẻ được tạo bởi frontend theo dạng: `https://<frontend-host>/share/<token>`

---

### `GET /work-log/share`

Lấy danh sách tất cả link chia sẻ của người dùng hiện tại.

> Requires: **login**

**Response** — `200 OK`

```json
[
  {
    "_id": "667c...",
    "token": "a3f8b2e1c9d047...",
    "account": "665f...",
    "organization": { "_id": "665f...", "name": "Acme Corp" },
    "month": 3,
    "year": 2026,
    "label": "Báo cáo tháng 03/2026 — Nguyễn Văn A",
    "expiresAt": "2026-04-30T23:59:59.000Z",
    "isActive": true,
    "createdAt": "2026-03-24T08:00:00.000Z",
    "updatedAt": "2026-03-24T08:00:00.000Z"
  }
]
```

---

### `DELETE /work-log/share/:id/delete`

Thu hồi (xoá) một link chia sẻ.

> Requires: **login** (phải là chủ sở hữu của link)

**URL Params**

| Param | Type     | Notes                           |
| ----- | -------- | ------------------------------- |
| `id`  | `string` | MongoDB ObjectId của share link |

**Response** — `200 OK`

```json
{ "message": "Share link revoked" }
```

---

### `GET /work-log/share/:token/view`

Xem báo cáo công việc qua link chia sẻ. **Không yêu cầu đăng nhập** — dùng để gửi cho HR hoặc kế toán.

> No auth required.

**URL Params**

| Param   | Type     | Notes                                    |
| ------- | -------- | ---------------------------------------- |
| `token` | `string` | Token 48 ký tự hex từ share link         |

**Response** — `200 OK`

```json
{
  "share": {
    "_id": "667c...",
    "token": "a3f8b2e1c9d047...",
    "label": "Báo cáo tháng 03/2026 — Nguyễn Văn A",
    "month": 3,
    "year": 2026,
    "expiresAt": "2026-04-30T23:59:59.000Z",
    "createdAt": "2026-03-24T08:00:00.000Z"
  },
  "account": {
    "_id": "665f...",
    "firstName": "Nguyễn Văn",
    "lastName": "A",
    "email": "nguyenvana@example.com",
    "avatar": null
  },
  "organization": {
    "_id": "665f...",
    "name": "Acme Corp",
    "workSchedule": {
      "workStartTime": "08:00",
      "workEndTime": "17:30",
      "lunchBreakMinutes": 60
    }
  },
  "month": 3,
  "year": 2026,
  "workSchedule": {
    "workStartTime": "08:00",
    "workEndTime": "17:30",
    "lunchBreakMinutes": 60
  },
  "standardHoursPerDay": 8.5,
  "standardWorkDays": 21,
  "totalStandardHours": 178.5,
  "totalHours": 165.0,
  "loggedDays": 20,
  "overtimeHours": 0,
  "missingHours": 13.5,
  "attendanceRate": 92.44,
  "logs": [
    {
      "_id": "666a...",
      "account": "665f...",
      "organization": "665f...",
      "date": "2026-03-03T00:00:00.000Z",
      "checkIn": "2026-03-03T08:00:00.000Z",
      "checkOut": "2026-03-03T17:30:00.000Z",
      "hours": 8.5,
      "note": null,
      "createdAt": "2026-03-03T17:35:00.000Z",
      "updatedAt": "2026-03-03T17:35:00.000Z"
    }
  ]
}
```

**Response fields explained**

| Field                 | Type        | Description                                                                    |
| --------------------- | ----------- | ------------------------------------------------------------------------------ |
| `share`               | `object`    | Metadata của share link (không chứa thông tin nhạy cảm)                        |
| `account`             | `object`    | Thông tin người lao động (firstName, lastName, email, avatar)                  |
| `organization`        | `object\|null` | Cơ quan được lọc, `null` nếu link hiển thị tất cả cơ quan                   |
| `workSchedule`        | `object`    | Lịch làm việc áp dụng để tính toán số giờ chuẩn                                |
| `standardHoursPerDay` | `number`    | Giờ làm chuẩn mỗi ngày                                                          |
| `standardWorkDays`    | `number`    | Số ngày làm việc chuẩn trong tháng (Thứ 2–Thứ 6)                               |
| `totalStandardHours`  | `number`    | Tổng giờ làm chuẩn = `standardHoursPerDay × standardWorkDays`                  |
| `totalHours`          | `number`    | Tổng số giờ đã làm thực tế                                                      |
| `loggedDays`          | `number`    | Số ngày đã có log                                                               |
| `overtimeHours`       | `number`    | Giờ OT = `max(0, totalHours − totalStandardHours)`                              |
| `missingHours`        | `number`    | Giờ thiếu = `max(0, totalStandardHours − totalHours)`                           |
| `attendanceRate`      | `number`    | Tỷ lệ chuyên cần (%) = `(totalHours / totalStandardHours) × 100` (2 chữ số)    |
| `logs`                | `WorkLog[]` | Chi tiết từng ngày làm việc                                                     |

**Errors**

| Status | Reason                                  |
| ------ | --------------------------------------- |
| `404`  | Token không tồn tại                     |
| `410`  | Link đã bị thu hồi hoặc đã hết hạn      |

---

## 8. Telegram

Endpoints for Telegram bot integration. The webhook endpoint is called by Telegram servers.

---

### `POST /telegram/webhook`

Receive incoming updates from Telegram (used in production with webhook mode).

> No auth required. Rate limiting is disabled for this endpoint.

**Request Body** — Telegram `Update` object (sent by Telegram servers automatically).

**Response** — `200 OK`

```json
{ "ok": true }
```

---

### `GET /telegram/bot-info`

Get basic information about the configured Telegram bot.

> No auth required.

**Response** — `200 OK` — Telegram `User` object.

```json
{
  "id": 123456789,
  "is_bot": true,
  "first_name": "LogWork Bot",
  "username": "logwork_bot"
}
```

---

### `GET /telegram/webhook-info`

Get the currently configured webhook information.

> No auth required.

**Response** — `200 OK` — Telegram `WebhookInfo` object.

```json
{
  "url": "https://your-domain.com/telegram/webhook",
  "has_custom_certificate": false,
  "pending_update_count": 0
}
```

---

## Appendix — Shared Types

### Account Object

```json
{
  "_id": "665f1a2b3c4d5e6f7a8b9c0d",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": null,
  "avatar": null,
  "role": "USER",
  "isVerified": false,
  "metadata": {
    "sendMail": true,
    "telegramChatId": null,
    "sendTelegram": false
  },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-03-01T00:00:00.000Z"
}
```

> `password` is **never** included in responses.

### Organization Object

```json
{
  "_id": "665f...",
  "name": "Acme Corp",
  "description": "Main office",
  "avatar": null,
  "owner": { ...Account },
  "members": [ ...Account[] ],
  "isActive": true,
  "workSchedule": {
    "workStartTime": "08:00",
    "workEndTime": "17:30",
    "lunchBreakMinutes": 60
  },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-03-01T00:00:00.000Z"
}
```

### WorkLog Object

```json
{
  "_id": "666a...",
  "account": "665f...",
  "organization": "665f...",
  "date": "2026-03-23T00:00:00.000Z",
  "checkIn": "2026-03-23T08:00:00.000Z",
  "checkOut": "2026-03-23T17:30:00.000Z",
  "hours": 9.5,
  "note": null,
  "createdAt": "2026-03-23T17:35:00.000Z",
  "updatedAt": "2026-03-23T17:35:00.000Z"
}
```

### WorkLogShare Object

```json
{
  "_id": "667c...",
  "token": "a3f8b2e1c9d047ab12fe3901cd5678ef90ab1234cd5678ef",
  "account": "665f...",
  "organization": { "_id": "665f...", "name": "Acme Corp" },
  "month": 3,
  "year": 2026,
  "label": "Báo cáo tháng 03/2026 — Nguyễn Văn A",
  "expiresAt": "2026-04-30T23:59:59.000Z",
  "isActive": true,
  "createdAt": "2026-03-24T08:00:00.000Z",
  "updatedAt": "2026-03-24T08:00:00.000Z"
}
```

---

### Notice Object

```json
{
  "_id": "667b...",
  "account": "665f...",
  "type": "Work Log",
  "message": "<p>Your work log has been submitted.</p>",
  "viewed": false,
  "variant": "success",
  "link": null,
  "createdAt": "2026-03-23T09:00:00.000Z",
  "updatedAt": "2026-03-23T09:00:00.000Z"
}
```

### Pagination Response

All `/search` endpoints return this shape:

```json
{
  "data": [],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "checkOut must be after checkIn",
  "error": "Bad Request"
}
```

Common status codes:

| Code  | Meaning                                                              |
| ----- | -------------------------------------------------------------------- |
| `400` | Bad Request — validation error or invalid input                      |
| `401` | Unauthorized — not logged in                                         |
| `403` | Forbidden — insufficient role or not the resource owner              |
| `404` | Not Found                                                            |
| `409` | Conflict — duplicate resource (e.g. duplicate work log for same day) |
| `429` | Too Many Requests — rate limit exceeded                              |
| `500` | Internal Server Error                                                |
