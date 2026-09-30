# Rider Shoes backend setup

This directory contains the Supabase backend foundation for Rider Shoes:

- `supabase/migrations/20260930000000_rider_shoes_backend.sql` creates the
  normalized catalog, customer, checkout, promotion, messaging, analytics, and
  audit schema.
- `supabase/functions/create-razorpay-order` creates a provider order from a
  server-read order total.
- `supabase/functions/verify-razorpay-payment` verifies the Razorpay signature
  and confirms the provider-side amount before updating payment/order state.
- `supabase/functions/razorpay-webhook` verifies and idempotently records
  Razorpay webhook deliveries.
- `supabase/functions/whatsapp-send` sends an approved WhatsApp template and
  records a notification without returning the access token.

## 1. Create and link a Supabase project

1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Copy `.env.example` to a local, untracked environment file and fill in the
   public URL/anon key. Keep the service-role key server-side only.
3. Log in and link the project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Apply the migration:

   ```sh
   supabase db push
   ```

The migration expects Supabase's managed `auth.users`, `storage.buckets`, and
`storage.objects` tables to exist. It enables RLS on every application table,
creates four public image buckets, and installs the auth trigger that creates a
`profiles` row and assigns the non-privileged `customer` role to new users.

## 2. Authorization model

Roles and permissions are normalized:

```
profiles -> profile_roles -> roles -> role_permissions -> permissions
```

There is deliberately no client-writable role column on `profiles`. Policies
call the `SECURITY DEFINER` helpers `has_role(text)` and
`has_permission(text)`, so a browser cannot grant itself access by sending a
role field. The migration seeds `customer`, `staff`, `support`, `fulfillment`,
`admin`, and `owner` roles plus the baseline permissions.

The owner role is seeded with every permission, but no account is automatically
made an owner. After signing up, assign the first operator from a trusted SQL
session or a controlled admin provisioning flow. For example, after replacing
the placeholders in a secure SQL editor session:

```sql
insert into public.profile_roles (profile_id, role_id)
select 'USER-UUID-HERE', id
from public.roles
where code = 'owner'
on conflict do nothing;
```

Do not run that statement from a browser client. The migration's RLS and role
assignment trigger intentionally reject self-service role escalation.

## 3. Configure Edge Function secrets

Set secrets in Supabase rather than committing them in the repository:

```sh
supabase secrets set \
  SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
  RAZORPAY_KEY_ID=rzp_test_xxx \
  RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET \
  RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET \
  WHATSAPP_ACCESS_TOKEN=YOUR_WHATSAPP_TOKEN \
  WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID \
  WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_BUSINESS_ACCOUNT_ID \
  WHATSAPP_VERIFY_TOKEN=YOUR_VERIFY_TOKEN \
  WHATSAPP_API_VERSION=v22.0 \
  APP_ORIGIN=https://your-store.example
```

`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, and `WHATSAPP_ACCESS_TOKEN` bypass or protect
security boundaries. They must never be placed in `VITE_*` variables, returned
from an Edge Function, logged, or sent to the browser.

Deploy the functions:

```sh
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase functions deploy whatsapp-send
```

The webhook is the only function intended to accept unauthenticated provider
traffic; it authenticates every request with `RAZORPAY_WEBHOOK_SECRET`. Keep JWT
verification enabled for the other three functions and pass the user's Supabase
access token in the `Authorization: Bearer ...` header.

## 4. Razorpay flow

1. Trusted checkout code creates an `orders` row and `order_items` rows. The
   generated `orders.total_amount` is computed from server-side totals; do not
   accept a client-supplied amount.
2. Call `create-razorpay-order` with `{ "orderId": "..." }`. It checks the
   authenticated owner, reads the database total with the service role, and
   creates a Razorpay order in the smallest currency unit.
3. Complete checkout in the browser using the returned public `keyId` and
   `razorpayOrderId`.
4. Call `verify-razorpay-payment` with the order/payment IDs and Razorpay
   signature. The function verifies the HMAC, fetches the provider payment, and
   compares order ID, amount, and currency before updating local state.
5. Configure the Razorpay dashboard webhook URL as:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook
   ```

   Subscribe to at least `payment.authorized`, `payment.captured`,
   `payment.failed`, `order.paid`, and refund events. The function stores a
   hash and status in `payment_webhook_events` so duplicate deliveries do not
   get applied repeatedly.

The payment functions are intentionally conservative: they do not accept a
client amount, do not store the signature, and only persist a redacted provider
response. Reconciliation/fulfillment should still be treated as a trusted
server workflow.

## 5. WhatsApp setup

1. Create/verify a Meta WhatsApp Business app and phone number.
2. Create and approve the templates represented in
   `public.whatsapp_templates` (the migration creates the table but does not
   invent provider-approved templates).
3. Insert templates from a trusted operator session, for example:

   ```sql
   insert into public.whatsapp_templates
     (name, provider_template_name, language_code, category, body, variables)
   values
     ('order-confirmed', 'order_confirmed', 'en_US', 'UTILITY',
      'Your Rider Shoes order has been confirmed.', '[]'::jsonb);
   ```

4. Call `whatsapp-send` with an authenticated user and
   `{ "profileId": "...", "templateName": "order-confirmed", "components": [] }`.
   Recipient phone numbers are read from `profiles`, must be E.164 formatted,
   and the access token is used only on the server.

The scaffold permits a user to send to their own profile and requires the
database-backed `notifications.send` permission for another profile. Before
production, narrow this to explicit transactional use cases (for example an
order ID) and validate component variables against each template's `variables`
schema.

## 6. Storage buckets

The migration creates public-read buckets:

- `product-images`
- `brand-assets`
- `banners`
- `category-images`

Only authenticated users with `catalog.manage` can upload, update, or delete
objects. Public-read is appropriate for storefront assets; do not put private
customer documents in these buckets. If assets should be private later, change
the bucket visibility and expose signed URLs through a trusted server route.

## 7. Local validation and testing

Use the Supabase local stack before production:

```sh
supabase start
supabase db reset
supabase functions serve create-razorpay-order --env-file .env.local
supabase functions serve verify-razorpay-payment --env-file .env.local
supabase functions serve razorpay-webhook --env-file .env.local
supabase functions serve whatsapp-send --env-file .env.local
```

Test at minimum:

- anonymous users can read only active catalog/delivery/promotional rows;
- a customer can read/update only their own cart, wishlist, addresses, orders,
  and notifications;
- a customer cannot insert/update `profile_roles` or assign an admin role;
- staff permissions are granted through `profile_roles`, not request fields;
- invalid Razorpay signatures, mismatched amounts, duplicate webhooks, and
  provider failures are rejected without leaking secrets;
- storage uploads fail without the catalog permission.

## Production checklist and caveats

- Run the migration against a fresh Supabase project first. The migration is a
  foundation and is not a destructive reset; subsequent schema changes should
  use new timestamped migrations.
- The checkout/order creation transaction and inventory reservation transaction
  are intentionally left to the application/server layer. Implement them as
  an atomic RPC or trusted Edge Function before accepting real orders; never
  let the browser write final totals or stock movements directly.
- Add rate limiting, idempotency keys, retry queues, and alerting around payment
  and messaging functions. `payment_webhook_events` prevents normal duplicate
  processing, but a distributed worker still needs operational monitoring.
- Configure Supabase Auth redirect URLs, email/SMS providers, and password/
  session policies separately.
- Replace test Razorpay credentials with live credentials only after webhook
  signature and reconciliation tests pass.
- The migration assumes the standard Supabase `auth` and `storage` schemas;
  running it in plain PostgreSQL without those managed schemas will fail until
  equivalent objects are provisioned.
