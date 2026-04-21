# Clock API — Mobile Integration Guide

> Tài liệu này dành cho **mobile developer** tích hợp tính năng quét QR để đăng nhập thiết bị đồng hồ chấm công, và xây dựng màn hình hiển thị kết quả chấm công.

---

## Mục lục

1. [Tổng quan luồng QR Login](#1-tổng-quan-luồng-qr-login)
2. [API QR — Thiết bị đồng hồ](#2-api-qr--thiết-bị-đồng-hồ)
   - 2.1 [Tạo phiên QR](#21-tạo-phiên-qr)
   - 2.2 [Polling trạng thái phiên](#22-polling-trạng-thái-phiên)
3. [API QR — Mobile (phía nhân viên)](#3-api-qr--mobile-phía-nhân-viên)
   - 3.1 [Xác nhận quét QR](#31-xác-nhận-quét-qr)
4. [API Clock — Dành cho đồng hồ](#4-api-clock--dành-cho-đồng-hồ)
   - 4.1 [Check-in](#41-check-in)
   - 4.2 [Check-out](#42-check-out)
   - 4.3 [Trạng thái hôm nay](#43-trạng-thái-hôm-nay)
   - 4.4 [Log gần đây](#44-log-gần-đây)
5. [Mã lỗi & xử lý](#5-mã-lỗi--xử-lý)

---

## 1. Tổng quan luồng QR Login

Thiết bị đồng hồ **không có màn hình đăng nhập bằng mật khẩu**. Xác thực được thực hiện qua QR code mà nhân viên quét từ app mobile đã đăng nhập.

```
┌─────────────────────────────────────────────────────────────────┐
│                        QR LOGIN FLOW                            │
├───────────────────────┬─────────────────────────────────────────┤
│   Thiết bị đồng hồ   │              Mobile App                 │
├───────────────────────┼─────────────────────────────────────────┤
│                       │                                         │
│  1. POST /auth/qr/generate                                      │
│     ← { sessionId, qrUrl, expiresAt }                          │
│                       │                                         │
│  2. Hiển thị QR code  │                                         │
│     từ `qrUrl`        │                                         │
│                       │                                         │
│                       │  3. Nhân viên mở app, chọn "Quét QR"   │
│                       │     Quét QR code trên màn hình          │
│                       │     Đọc `sessionId` từ URL              │
│                       │                                         │
│                       │  4. POST /auth/qr/confirm               │
│                       │     { sessionId }                       │
│                       │     ← { message: "confirmed" }          │
│                       │                                         │
│  5. GET /auth/qr/status/:sessionId  (poll mỗi 2–3s)            │
│     ← { status: "confirmed", token: "<jwt>" }                   │
│                       │                                         │
│  6. Lưu token, dùng   │                                         │
│     Authorization:    │                                         │
│     Bearer <token>    │                                         │
│     cho Clock APIs    │                                         │
└───────────────────────┴─────────────────────────────────────────┘
```

**Lưu ý:**

- Phiên QR có hiệu lực trong **5 phút** kể từ khi tạo.
- Token JWT của đồng hồ có hiệu lực **7 ngày**.
- Đồng hồ cần tạo lại phiên QR khi token hết hạn hoặc người dùng logout.

---

## 2. API QR — Thiết bị đồng hồ

### 2.1 Tạo phiên QR

> Thiết bị gọi endpoint này để hiển thị QR code. **Không cần auth.**

```
POST /auth/qr/generate
```

**Response `200`**

```json
{
  "statusCode": 200,
  "content": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "qrUrl": "https://app.logwork.io/qr-login?session=550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2026-04-21T08:10:00.000Z"
  }
}
```

| Field       | Mô tả                                         |
| ----------- | --------------------------------------------- |
| `sessionId` | UUID định danh phiên, dùng để poll trạng thái |
| `qrUrl`     | URL encode vào QR code để mobile đọc          |
| `expiresAt` | Thời điểm phiên hết hạn (5 phút từ lúc tạo)   |

**Gợi ý UI:** Thiết bị nên tự động làm mới QR sau ~4 phút 30 giây (trước khi `expiresAt`).

---

### 2.2 Polling trạng thái phiên

> Thiết bị poll endpoint này sau khi hiển thị QR. **Không cần auth.**

```
GET /auth/qr/status/:sessionId
```

**Response khi đang chờ quét**

```json
{
  "statusCode": 200,
  "content": {
    "status": "pending"
  }
}
```

**Response khi nhân viên đã quét và xác nhận**

```json
{
  "statusCode": 200,
  "content": {
    "status": "confirmed",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response khi phiên hết hạn**

```json
{
  "statusCode": 200,
  "content": {
    "status": "expired"
  }
}
```

| `status`    | Ý nghĩa                                 | Hành động thiết bị                          |
| ----------- | --------------------------------------- | ------------------------------------------- |
| `pending`   | Chờ nhân viên quét                      | Tiếp tục poll                               |
| `confirmed` | Đã xác nhận — `token` có trong response | Lưu token, dừng poll, cho phép check-in/out |
| `expired`   | Phiên hết hạn                           | Gọi lại `/auth/qr/generate` để tạo QR mới   |

**Khuyến nghị poll:** Interval 2–3 giây, dừng khi nhận `confirmed` hoặc `expired`.

---

## 3. API QR — Mobile (phía nhân viên)

### 3.1 Xác nhận quét QR

> Nhân viên đã đăng nhập trên mobile quét QR của thiết bị đồng hồ và gọi endpoint này. **Yêu cầu JWT của nhân viên** (cookie hoặc Bearer token của mobile).

```
POST /auth/qr/confirm
Authorization: Bearer <employee_token>
```

**Request Body**

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field       | Bắt buộc | Mô tả                                           |
| ----------- | -------- | ----------------------------------------------- |
| `sessionId` | ✅       | UUID lấy từ query param `session` trong `qrUrl` |

**Response `200`**

```json
{
  "statusCode": 200,
  "content": {
    "message": "QR login confirmed successfully"
  }
}
```

**Errors**

| Code  | Trường hợp                                      |
| ----- | ----------------------------------------------- |
| `400` | `sessionId` không tồn tại hoặc phiên đã hết hạn |
| `400` | Phiên đã được confirm trước đó                  |
| `401` | Nhân viên chưa đăng nhập                        |

**Cách lấy `sessionId` từ QR:**

```
qrUrl = "https://app.logwork.io/qr-login?session=550e8400-..."
                                                  ↑
                              parse query param `session`
```

---

## 4. API Clock — Dành cho đồng hồ

> Tất cả endpoints dưới đây yêu cầu **token của thiết bị** (lấy từ bước confirm QR).

```
Authorization: Bearer <device_token>
```

---

### 4.1 Check-in

Ghi nhận giờ vào làm tại thời điểm hiện tại (server time).

```
POST /clock/check-in
Authorization: Bearer <device_token>
```

**Request Body**

```json
{
  "organizationId": "6627abc000000000000000001",
  "note": "Đi làm bình thường"
}
```

| Field            | Bắt buộc | Mô tả                                  |
| ---------------- | -------- | -------------------------------------- |
| `organizationId` | ✅       | ID của tổ chức/chi nhánh cần chấm công |
| `note`           | ❌       | Ghi chú tùy chọn                       |

**Response `201`** — Work log được tạo với `checkIn = now`

```json
{
  "statusCode": 200,
  "content": {
    "_id": "6627abc123",
    "account": "6627000000000000000000001",
    "organization": "6627abc000000000000000001",
    "date": "2026-04-21T00:00:00.000Z",
    "checkIn": "2026-04-21T08:03:42.512Z",
    "checkOut": null,
    "hours": 0,
    "note": "Đi làm bình thường",
    "skipLunchBreak": false,
    "createdAt": "2026-04-21T08:03:42.512Z",
    "updatedAt": "2026-04-21T08:03:42.512Z"
  }
}
```

**Errors**

| Code  | Trường hợp                                               |
| ----- | -------------------------------------------------------- |
| `400` | Đã có work log hôm nay cho tổ chức này (đã check-in rồi) |
| `403` | Tài khoản không phải thành viên của tổ chức              |
| `404` | Không tìm thấy tổ chức                                   |

---

### 4.2 Check-out

Ghi nhận giờ ra về tại thời điểm hiện tại. Hệ thống tự tính `hours` dựa trên lịch làm việc của tổ chức (trừ giờ nghỉ trưa).

```
PATCH /clock/check-out
Authorization: Bearer <device_token>
```

**Request Body**

```json
{
  "organizationId": "6627abc000000000000000001",
  "note": "Ra về đúng giờ"
}
```

| Field            | Bắt buộc | Mô tả            |
| ---------------- | -------- | ---------------- |
| `organizationId` | ✅       | ID của tổ chức   |
| `note`           | ❌       | Ghi chú tùy chọn |

**Response `200`** — Work log được cập nhật với `checkOut = now` và `hours` được tính

```json
{
  "statusCode": 200,
  "content": {
    "message": "Work log updated"
  }
}
```

**Errors**

| Code  | Trường hợp                                    |
| ----- | --------------------------------------------- |
| `400` | Đã check-out rồi hôm nay                      |
| `404` | Chưa có check-in hôm nay (cần check-in trước) |

---

### 4.3 Trạng thái hôm nay

Truy vấn trạng thái chấm công của nhân viên trong ngày hiện tại. Dùng để hiển thị trên màn hình đồng hồ ngay sau khi nhân viên đăng nhập qua QR.

```
GET /clock/today?organizationId=<id>
Authorization: Bearer <device_token>
```

**Query Parameters**

| Param            | Bắt buộc | Mô tả                   |
| ---------------- | -------- | ----------------------- |
| `organizationId` | ❌       | Lọc theo tổ chức cụ thể |

**Response `200`**

```json
{
  "statusCode": 200,
  "content": {
    "date": "2026-04-21T00:00:00.000Z",
    "checkedIn": true,
    "checkedOut": false,
    "log": {
      "_id": "6627abc123",
      "checkIn": "2026-04-21T08:03:42.512Z",
      "checkOut": null,
      "hours": 0,
      "note": null,
      "organization": {
        "_id": "6627abc000000000000000001",
        "name": "Công ty ABC"
      }
    }
  }
}
```

**Response khi chưa check-in hôm nay**

```json
{
  "statusCode": 200,
  "content": {
    "date": "2026-04-21T00:00:00.000Z",
    "checkedIn": false,
    "checkedOut": false,
    "log": null
  }
}
```

| Field        | Mô tả                                  |
| ------------ | -------------------------------------- |
| `checkedIn`  | `true` nếu đã có work log hôm nay      |
| `checkedOut` | `true` nếu `checkOut` đã được ghi nhận |
| `log`        | Work log hôm nay hoặc `null`           |

---

### 4.4 Log gần đây

Lấy danh sách các ngày chấm công gần nhất. Dùng để hiển thị lịch sử công trên màn hình đồng hồ.

```
GET /clock/recent-logs?limit=7&organizationId=<id>
Authorization: Bearer <device_token>
```

**Query Parameters**

| Param            | Bắt buộc | Mặc định | Mô tả                   |
| ---------------- | -------- | -------- | ----------------------- |
| `limit`          | ❌       | `7`      | Số log trả về (1–30)    |
| `organizationId` | ❌       | —        | Lọc theo tổ chức cụ thể |

**Response `200`** — Mảng work log, sắp xếp từ mới nhất

```json
{
  "statusCode": 200,
  "content": [
    {
      "_id": "6627abc123",
      "date": "2026-04-21T00:00:00.000Z",
      "checkIn": "2026-04-21T08:03:00.000Z",
      "checkOut": "2026-04-21T17:31:00.000Z",
      "hours": 8.5,
      "note": null,
      "skipLunchBreak": false,
      "organization": {
        "_id": "6627abc000000000000000001",
        "name": "Công ty ABC"
      }
    },
    {
      "_id": "6627abc122",
      "date": "2026-04-20T00:00:00.000Z",
      "checkIn": "2026-04-20T07:55:00.000Z",
      "checkOut": "2026-04-20T17:00:00.000Z",
      "hours": 8.08,
      "note": "Về sớm 30p",
      "skipLunchBreak": false,
      "organization": {
        "_id": "6627abc000000000000000001",
        "name": "Công ty ABC"
      }
    }
  ]
}
```

---

## 5. Mã lỗi & xử lý

Tất cả lỗi trả về cấu trúc:

```json
{
  "statusCode": 400,
  "message": "Mô tả lỗi",
  "error": "Bad Request"
}
```

### Bảng mã lỗi Clock API

| HTTP  | Mã           | Nguyên nhân                                          | Xử lý trên mobile/device                    |
| ----- | ------------ | ---------------------------------------------------- | ------------------------------------------- |
| `400` | Bad Request  | Check-in/check-out trùng ngày, phiên QR hết hạn      | Hiển thị thông báo cho người dùng           |
| `401` | Unauthorized | Token hết hạn hoặc không hợp lệ                      | Xóa token, hiển thị lại QR để đăng nhập lại |
| `403` | Forbidden    | Không phải thành viên tổ chức                        | Hiển thị lỗi, kiểm tra lại `organizationId` |
| `404` | Not Found    | Chưa check-in (khi check-out), tổ chức không tồn tại | Hiển thị thông báo phù hợp                  |

### Xử lý token hết hạn trên thiết bị đồng hồ

```
1. Gọi bất kỳ Clock API → nhận 401
2. Xóa token đã lưu
3. Gọi POST /auth/qr/generate → hiển thị QR mới
4. Chờ nhân viên (có thể là admin) quét lại
```
