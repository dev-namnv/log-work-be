# WorkLog: `checkIn/checkOut` -> `items[]` (FE migration guide)

Chấm công giờ hỗ trợ **nhiều phiên/ngày** (OT, làm bù). Mỗi WorkLog vẫn là 1 ngày (unique `account + organization + date`), các phiên nằm trong `items[]`.

> BE đã thay đổi. FE **bắt buộc** update theo, nếu không sẽ vỡ ở các chỗ liệt kê trong mục [Regression](#regression---fe-se-vo-o-dau).

## 1. Data shape thay đổi

**Cũ:**
```jsonc
{ "checkIn": "2026-03-23T08:00:00.000Z", "checkOut": "2026-03-23T17:30:00.000Z", "hours": 8 }
```

**Mới:**
```jsonc
{
  "items": [
    { "checkIn": "2026-03-23T08:00:00.000Z", "checkOut": "2026-03-23T12:00:00.000Z" },
    { "checkIn": "2026-03-23T13:00:00.000Z", "checkOut": null } // checkOut null = phiên đang mở
  ],
  "hours": 8
}
```

- `checkIn` / `checkOut` top-level **bị bỏ hẳn**. Đọc qua `items[]`.
- `item.checkOut = null` -> phiên đang mở (đã check-in, chưa check-out). Luôn là phiên **cuối cùng** của mảng.
- `hours` giữ nguyên field + ý nghĩa: tổng giờ net cả ngày (đã trừ nghỉ trưa, 2 số lẻ).

## 2. Regression - FE sẽ vỡ ở đâu

| # | Chỗ vỡ | Triệu chứng | Fix FE |
|---|---|---|---|
| R1 | Đọc `log.checkIn` / `log.checkOut` | `undefined` ở mọi màn hiển thị giờ vào/ra | Đọc `log.items[0].checkIn`, `log.items[last].checkOut` |
| R2 | **Response của `check-out` đổi** | Trước trả full `WorkLog`, giờ trả `{ message: 'Work log updated' }`. Code FE dùng response để update state sẽ nhận `undefined` | Sau check-out, **gọi lại `GET /clock/today`** để lấy log mới (xem R5) |
| R3 | **Response của `check-in` KHÔNG đồng nhất** | Lần đầu/ngày trả full `WorkLog`; lần sau (push item) trả `{ message: 'Work log updated' }` | Đừng dựa vào response check-in. Luôn refetch `GET /clock/today` |
| R4 | `PATCH /work-log/:id` body cũ (`checkIn/checkOut` phẳng) | 400 validation (`items` required) | Gửi `items[]` (xem mục 4) |
| R5 | Tính tổng giờ ở FE từ `checkIn/checkOut` | Sai/NaN | Dùng field `hours` BE trả, hoặc cộng qua `items[]` |

> **R2 + R3 là chí mạng**: `check-in`/`check-out` không còn trả cùng 1 shape. Pattern an toàn: sau mỗi lần clock, **refetch `GET /clock/today`** rồi render từ đó, đừng tin response mutation trả về.

## 3. Endpoints

| Endpoint | Hành vi | Response |
|---|---|---|
| `POST /clock/check-in` | Lần đầu/ngày: tạo log mới. Lần sau: push item mới vào log hôm nay. **400** `Please check out before checking in again` nếu phiên cuối còn mở. | Lần đầu: full `WorkLog`. Lần sau: `{ message }`. (Không đồng nhất -> refetch) |
| `PATCH /clock/check-out` | Đóng phiên cuối (`checkOut = now`), tính lại `hours`. **400** `Already checked out today` nếu phiên cuối đã đóng. **404** nếu chưa check-in hôm nay. | `{ message: 'Work log updated' }` |
| `GET /clock/today` | Trạng thái hôm nay. | `{ date, checkedIn, checkedOut, log }` - xem dưới |
| `GET /clock/recent-logs` | List log gần nhất. | `WorkLog[]` (mỗi phần tử có `items[]`) |
| `POST /work-log` (create) | Tạo thủ công. Body **giữ nguyên** `checkIn/checkOut` đơn - BE tự bọc vào `items`. | Full `WorkLog` |
| `PATCH /work-log/:id` (update) | Sửa log. Body **đổi** sang `items[]`. | `{ message: 'Work log updated' }` |
| `POST /work-log/migrate-to-items` | **Admin, chạy 1 lần.** Chuyển data cũ. | `{ migrated: number }` |

### `GET /clock/today` response
```jsonc
{
  "date": "2026-03-23T00:00:00.000Z",
  "checkedIn": true,   // = items.length > 0
  "checkedOut": true,  // = items.some(i => i.checkOut) - LƯU Ý: true nếu CÓ phiên đã đóng, không phải "phiên cuối đã đóng"
  "log": { /* WorkLog có items[], hoặc null */ }
}
```
> Cảnh báo `checkedOut`: khi đang có phiên mở (vừa check-in lần 2), `checkedOut` vẫn `true` vì phiên trước đã đóng. Muốn biết "đang mở hay không" -> check `log.items[last].checkOut == null`, đừng chỉ nhìn `checkedOut`.

## 4. DTO (request body)

### `POST /clock/check-in` - `ClockCheckInDto` (không đổi)
```jsonc
{
  "organizationId": "665...",  // required, Mongo ID
  "note": "..."                // optional
}
```

### `PATCH /clock/check-out` - `ClockCheckOutDto` (không đổi)
```jsonc
{
  "organizationId": "665...",  // required, Mongo ID
  "note": "..."                // optional
}
```

### `POST /work-log` - `CreateWorkLogDto` (KHÔNG đổi, vẫn phẳng)
```jsonc
{
  "organizationId": "665...",                  // required, Mongo ID
  "checkIn": "2026-03-23T08:00:00.000Z",       // required, ISO 8601
  "checkOut": "2026-03-23T17:30:00.000Z",      // optional, ISO 8601
  "note": "...",                               // optional
  "skipLunchBreak": false                      // optional, default false
}
```

### `PATCH /work-log/:id` - `UpdateWorkLogDto` (ĐỔI)
```jsonc
{
  "items": [                                   // required, array
    { "checkIn": "2026-03-23T08:00:00.000Z", "checkOut": "2026-03-23T12:00:00.000Z" },
    { "checkIn": "2026-03-23T13:00:00.000Z" }  // checkOut optional (để trống = phiên mở)
  ],
  "note": "...",                               // optional
  "skipLunchBreak": true                       // optional
}
```
`HoursLogItemDto`: `checkIn?` (ISO 8601), `checkOut?` (ISO 8601). Validate: mỗi item `checkOut` (nếu có) phải **sau** `checkIn`, nếu không BE trả **400** `checkOut must be after checkIn`.

## 5. Checklist FE

1. [x] Mọi chỗ đọc `log.checkIn` / `log.checkOut` -> đổi sang `log.items[]` (R1).
2. [x] Render `items[]` thành list nhiều phiên trong ngày.
3. [x] Sau `check-in` và `check-out`: refetch report (dùng monthly-report thay `GET /clock/today`), không dùng response trả về để set state (R2, R3).
4. [x] Nút "check-in lại trong ngày": gọi `POST /clock/check-in`, handle **400** `Please check out before checking in again`.
5. [x] Màn edit log: gửi body `items[]` cho `PATCH /work-log/:id` (R4).
6. [x] Trạng thái "đang mở": dùng `log.items[last].checkOut == null` (helper `isOpen`), không dựa `checkedOut`.
7. [x] Tổng giờ: dùng field `hours`, không tự tính từ `checkIn/checkOut` phẳng (R5).

## 6. Migration data cũ

Admin gọi **1 lần**: `POST /work-log/migrate-to-items` (role ADMIN). Chuyển mọi log cũ (`{checkIn, checkOut}`) sang `items[]`, bỏ field cũ.

**Thứ tự deploy (quan trọng):**
1. Deploy BE mới.
2. Gọi `POST /work-log/migrate-to-items` ngay (trước khi user dùng). Doc cũ chưa migrate mà đọc bằng code mới -> `items = undefined` -> lỗi hiển thị.
3. Check response `{ migrated: N }`.
4. Deploy FE mới.

Endpoint idempotent - chạy lại không hại (chỉ touch doc chưa có `items`).
