# PayPal Integration Setup

Neo-CohMetrix uses PayPal for user self-service quota top-up. Users can add funds to their analysis balance directly from the app.

## Prerequisites

- A PayPal account (Business or Personal)
- Access to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)

## Setup Steps

### 1. Create a PayPal REST API App

1. Go to **https://developer.paypal.com** and log in
2. Navigate to **Dashboard → Apps & Credentials**
3. Toggle to **Sandbox** (for testing) or **Live** (for production)
4. Click **Create App**
   - **App Name**: `Neo-CohMetrix` (or any name you prefer)
   - **App Type**: Merchant
5. Click **Create App**

### 2. Copy Credentials

On the app detail page:
- **Client ID** — visible immediately (starts with `A...`)
- **Secret** — click **Show** to reveal (starts with `E...`)

### 3. Configure Environment Variables

Add to your `.env` file:

```env
PAYPAL_CLIENT_ID=AYourClientIdHere
PAYPAL_CLIENT_SECRET=EYourSecretHere
PAYPAL_MODE=sandbox
```

| Variable | Description |
|---|---|
| `PAYPAL_CLIENT_ID` | REST API Client ID from PayPal dashboard |
| `PAYPAL_CLIENT_SECRET` | REST API Secret from PayPal dashboard |
| `PAYPAL_MODE` | `sandbox` for testing, `live` for production |

### 4. Restart the Server

```bash
npm run dev    # development
npm start      # production
```

## Testing with Sandbox

PayPal sandbox provides fake buyer/seller accounts for testing without real money.

1. Go to **https://developer.paypal.com/dashboard/accounts**
2. Find the **Personal (Buyer)** sandbox account
3. Note the email and password (click the `...` menu → View/Edit Account)
4. When testing in the app, use these sandbox buyer credentials in the PayPal popup

### Test Flow

1. Log in to Neo-CohMetrix
2. Click your balance in the top bar → **Add Funds**
3. Select an amount (e.g. $5)
4. Click the PayPal button
5. Log in with sandbox buyer credentials
6. Complete the payment
7. Your balance updates immediately

## Going Live

When ready for real payments:

1. Go to PayPal Developer Dashboard
2. Switch to **Live** (top toggle)
3. Create a **Live** app (or use existing)
4. Copy the **Live** Client ID and Secret
5. Update `.env`:

```env
PAYPAL_CLIENT_ID=ALiveClientIdHere
PAYPAL_CLIENT_SECRET=ELiveSecretHere
PAYPAL_MODE=live
```

6. Restart the server

## How It Works

### User Flow
- Each new user gets a default quota of **$0.50** (configurable via `DEFAULT_USER_QUOTA`)
- Users spend quota when running analyses (cost tracked per LLM call)
- When balance reaches $0, analysis is blocked with a prompt to add funds
- Users can add funds via PayPal at any time from the cost modal

### Admin Controls
- Super admin (`SUPER_ADMIN_EMAIL`) can view all users' quotas in the Admin panel → Usage tab
- Admin can **add quota** (+$) to any user without PayPal
- Admin can **reset spending** to zero for any user

### Storage
- User quota stored in GCS at `users/{email}/quota.json`
- Payment deposits recorded with PayPal order ID for audit trail
- Structure: `{ quota, spent, deposits: [{ amount, method, ref, ts }] }`

## Configuration Reference

| Env Variable | Default | Description |
|---|---|---|
| `PAYPAL_CLIENT_ID` | _(required)_ | PayPal REST API Client ID |
| `PAYPAL_CLIENT_SECRET` | _(required)_ | PayPal REST API Secret |
| `PAYPAL_MODE` | `sandbox` | `sandbox` or `live` |
| `DEFAULT_USER_QUOTA` | `0.50` | Default quota (USD) for new users |
| `SUPER_ADMIN_EMAIL` | _(empty)_ | Email of super admin who can manage quotas |

## Troubleshooting

| Issue | Solution |
|---|---|
| "PayPal is not configured" | `PAYPAL_CLIENT_ID` is empty — add credentials to `.env` and restart |
| PayPal popup doesn't appear | Check browser console for SDK load errors; verify Client ID is correct |
| "Failed to create PayPal order" | Check server logs; verify `PAYPAL_CLIENT_SECRET` is correct |
| Payment captured but balance not updated | Check server logs for `[POST /api/quota/capture-order]` errors |
| Sandbox login fails | Use sandbox buyer credentials from developer.paypal.com/dashboard/accounts |
