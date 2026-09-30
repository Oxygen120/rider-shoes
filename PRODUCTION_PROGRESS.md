# Rider Shoes — Production Progress

This build continues from the supplied project without rebuilding the storefront.

## Implemented in this pass

- Added an atomic Supabase `create_checkout` RPC.
- Checkout prices are read from database product variants instead of trusting browser prices.
- Inventory availability is checked under row locks and reserved atomically.
- COD orders commit stock immediately.
- Razorpay orders reserve stock until payment capture.
- Added checkout idempotency support.
- Added durable order status history and staff `set_order_status` RPC.
- Added persistent product save/delete wiring for the admin catalog.
- Added persistent business-settings writes to Supabase.
- Added current-order loading from Supabase for authenticated users/staff.
- Added real Razorpay Checkout.js initialization + payment verification calls.
- Razorpay verification/webhook now commits reserved inventory on captured payment.
- Replaced the demo admin session flag with Supabase Auth + permission checks.
- Wrapped the application in `AuthProvider` (the previous app was not mounting it).
- Added safe online-order/delivery defaults for a fresh database install.

## Important deployment steps

1. Apply all migrations in order, including:
   `supabase/migrations/20260930020000_checkout_and_admin_rpc.sql`
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend.
3. Deploy the Supabase Edge Functions.
4. Set Razorpay secrets in Supabase Edge Function secrets.
5. Configure the Razorpay webhook to point to `razorpay-webhook` and use the same webhook secret.
6. Create at least one active Supabase user and assign an admin/owner role for `/admin`.
7. Run `npm install` from a clean checkout, then `npm run typecheck` and `npm run build`.

## Verification note

The supplied ZIP contained an incomplete/broken `node_modules` tree, so this deliverable intentionally does **not** include `node_modules`. A clean dependency install is required on the target computer before building.

The source TypeScript/TSX files were transpile-checked after the changes. A full dependency-backed Vite build could not be executed in the audit environment because the bundled dependency tree was incomplete and package installation timed out.
