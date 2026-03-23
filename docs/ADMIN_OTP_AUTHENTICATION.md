# Admin OTP Authentication System

## Overview

Hệ thống xác thực OTP cho tài khoản admin khi đăng nhập từ IP lạ. Khi admin đăng nhập từ một IP chưa từng sử dụng, hệ thống sẽ gửi mã OTP qua email để xác thực.

## Flow Diagram

```
┌─────────────┐
│ Admin Login │
└──────┬──────┘
       │
       ▼
┌─────────────────┐      YES    ┌──────────────────┐
│ Check Role &    │─────────────▶│ Generate OTP     │
│ IP Exists?      │              │ Send Email       │
└─────────────────┘              └────────┬─────────┘
       │                                  │
       │ NO (Normal user                  │
       │ or known IP)                     ▼
       │                         ┌──────────────────┐
       │                         │ Return response  │
       │                         │ requireOtp: true │
       │                         └────────┬─────────┘
       │                                  │
       │                                  ▼
       │                         ┌──────────────────┐
       │                         │ User submits OTP │
       │                         └────────┬─────────┘
       │                                  │
       │                                  ▼
       │                         ┌──────────────────┐
       │                         │ Verify OTP       │
       │                         │ - Check expiry   │
       │                         │ - Check code     │
       │                         └────────┬─────────┘
       │                                  │
       │                                  ▼
       │                         ┌──────────────────┐
       │                         │ Log IP & Login   │
       │                         │ Set Cookie       │
       │                         └──────────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────────────────────────────────┐
│         Successful Login                 │
└──────────────────────────────────────────┘
```

## API Endpoints

### 1. Login (POST /auth/login)

Đăng nhập bình thường. Nếu là admin và IP mới, sẽ trả về yêu cầu OTP.

**Request:**

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (Normal Login):**

```json
{
  "statusCode": 200,
  "content": {
    "account": {
      /* account info */
    }
  }
}
```

**Response (OTP Required):**

```json
{
  "statusCode": 200,
  "content": {
    "requireOtp": true,
    "message": "OTP has been sent to your email. Please verify to continue.",
    "email": "admin@example.com"
  }
}
```

### 2. Verify OTP (POST /auth/verify-otp)

Xác thực mã OTP để hoàn tất đăng nhập.

**Request:**

```json
{
  "email": "admin@example.com",
  "otp": "123456"
}
```

**Response (Success):**

```json
{
  "statusCode": 200,
  "content": {
    "account": {
      /* account info */
    },
    "message": "Login successful"
  }
}
```

**Response (Error):**

```json
{
  "statusCode": 400,
  "message": "Invalid OTP code"
}
```

### 3. Resend OTP (POST /auth/resend-otp)

Gửi lại mã OTP mới nếu mã cũ đã hết hạn hoặc không nhận được.

**Request:**

```json
{
  "email": "admin@example.com"
}
```

**Response:**

```json
{
  "message": "New OTP has been sent to your email"
}
```

## Database Schema Changes

### Account Metadata

Thêm các field mới vào `AccountMetadata`:

```typescript
interface AccountMetadata {
  // ... existing fields
  otpCode?: string; // Mã OTP (6 chữ số)
  otpExpiry?: Date; // Thời gian hết hạn (10 phút)
  otpVerified?: boolean; // Trạng thái đã verify
  pendingLoginIp?: string; // IP đang pending login
}
```

## Security Features

1. **IP Tracking**: Hệ thống lưu lại tất cả IP đã đăng nhập thành công trong `account.ips[]`

2. **OTP Expiry**: Mã OTP có hiệu lực 10 phút

3. **Admin Only**: Chỉ áp dụng cho tài khoản có role = ADMIN

4. **Random 6-digit Code**: OTP là số ngẫu nhiên 6 chữ số

5. **Email Notification**: Gửi email với format đẹp, hiển thị IP đang cố đăng nhập

## Client Implementation Example

```typescript
// Login flow
async function login(email: string, password: string) {
  const response = await fetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (data.content.requireOtp) {
    // Show OTP input form
    const otp = await showOtpInput();
    return await verifyOtp(email, otp);
  }

  return data;
}

async function verifyOtp(email: string, otp: string) {
  const response = await fetch('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });

  return await response.json();
}

async function resendOtp(email: string) {
  const response = await fetch('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

  return await response.json();
}
```

## Email Template

Email được gửi có format HTML đẹp với:

- Header "🔐 Admin Login Verification"
- Hiển thị IP address đang cố đăng nhập
- Mã OTP lớn, dễ đọc (letter-spacing: 8px)
- Thông báo thời gian hết hạn (10 phút)
- Cảnh báo nếu không phải user tự đăng nhập

## Testing

### Test Case 1: Admin đăng nhập từ IP cũ

- **Input**: Admin login với IP đã có trong `account.ips`
- **Expected**: Đăng nhập thành công ngay, không cần OTP

### Test Case 2: Admin đăng nhập từ IP mới

- **Input**: Admin login với IP chưa có trong `account.ips`
- **Expected**: Nhận response yêu cầu OTP, email được gửi

### Test Case 3: Verify OTP đúng

- **Input**: Email + OTP code đúng và chưa hết hạn
- **Expected**: Đăng nhập thành công, IP được add vào `account.ips`

### Test Case 4: Verify OTP sai

- **Input**: Email + OTP code sai
- **Expected**: Lỗi "Invalid OTP code"

### Test Case 5: OTP hết hạn

- **Input**: Email + OTP code đã quá 10 phút
- **Expected**: Lỗi "OTP has expired. Please request a new one."

### Test Case 6: Resend OTP

- **Input**: Email có pending OTP request
- **Expected**: Mã OTP mới được gửi qua email

### Test Case 7: User thường đăng nhập từ IP mới

- **Input**: User (không phải admin) login từ IP mới
- **Expected**: Đăng nhập thành công ngay, không cần OTP

## Notes

- OTP chỉ áp dụng cho **ADMIN** accounts
- User thường vẫn đăng nhập bình thường không cần OTP
- IP được lưu vào database sau khi verify OTP thành công
- Có thể điều chỉnh thời gian hết hạn OTP tại line generate OTP: `Date.now() + 10 * 60 * 1000`
- Có thể điều chỉnh độ dài OTP (hiện tại là 6 chữ số)
