/** JSON values accepted by Supabase json/jsonb columns. */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json | undefined };

export type JsonObject = { [key: string]: Json | undefined };
export type ISODateString = string;
export type CurrencyCode = string;

export type ProductStatus = "draft" | "active" | "archived";

export interface BrandSummary {
  id: string;
  slug: string;
  name: string;
}

export interface Category {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  size: string | null;
  color: string | null;
  optionValues: JsonObject;
  price: number;
  compareAtPrice: number | null;
  currency: CurrencyCode;
  weightGrams: number | null;
  isActive: boolean;
  /** Null means stock is not publicly available, not that the item is sold out. */
  stockQuantity: number | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;
  taxRate: number;
  brand: BrandSummary | null;
  categoryIds: string[];
  primaryCategoryId: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  metadata: JsonObject;

  /** Storefront-friendly values derived from the active variants and metadata. */
  price: number;
  compareAtPrice: number | null;
  currency: CurrencyCode;
  imageUrl: string;
  sizes: string[];
  colors: string[];
  tags: string[];
  featured: boolean;
  isNew: boolean;
  badge: string | null;
  rating: number | null;
  reviewCount: number;
  inStock: boolean;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  imageUrl: string;
  sku: string;
  size: string | null;
  color: string | null;
  unitPrice: number;
  currency: CurrencyCode;
  quantity: number;
  addedAt: ISODateString;
}

export interface WishlistItem {
  productId: string;
  addedAt: ISODateString;
}

export interface Address {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
}

export type OrderStatus =
  | "pending"
  | "payment_pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refund_requested"
  | "returned"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "partially_refunded"
  | "refunded";

export type FulfillmentStatus =
  | "unfulfilled"
  | "partially_fulfilled"
  | "fulfilled"
  | "returned";

export type PaymentMethod = "razorpay" | "cod" | "other";

export interface OrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  productSlug: string | null;
  imageUrl: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: OrderCustomer;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethod: PaymentMethod;
  currency: CurrencyCode;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  totalAmount: number;
  amountPaid: number;
  amountRefunded: number;
  shippingAddress: Address;
  billingAddress: Address;
  customerNote: string;
  trackingNumber: string | null;
  placedAt: ISODateString;
  paidAt: ISODateString | null;
  cancelledAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * Editable storefront settings. Persistence can map these fields to individual
 * `business_settings` rows, so no server-managed fields leak into an admin form.
 */
export interface BusinessSettings {
  storeName: string;
  tagline: string;
  description: string;
  logoUrl: string;
  currency: CurrencyCode;
  locale: string;
  taxIncluded: boolean;
  supportEmail: string;
  supportPhone: string;
  supportWhatsappEnabled: boolean;
  supportWhatsappNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  freeShippingThreshold: number;
  standardShippingFee: number;
  deliveryEstimate: string;
  returnsWindowDays: number;
  announcementEnabled: boolean;
  announcementText: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroButtonLabel: string;
  heroButtonUrl: string;
  primaryColor: string;
  secondaryColor: string;
  colorMode: "light" | "dark" | "system";
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  mapsUrl: string;
  storeHours: string;
  seoTitle: string;
  seoDescription: string;
  onlineOrdersEnabled: boolean;
  codEnabled: boolean;
  codMin: number;
  codMax: number;
  codFee: number;
  storeVisitDiscount: number;
  storeVisitValidityDays: number;
  storeVisitTerms: string;
  whatsappAutomationEnabled: boolean;
}

export interface DeliveryQuote {
  serviceable: boolean;
  shippingFee: number;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface CustomerProfile {
  id: string;
  email: string | null;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  isActive: boolean;
  metadata: JsonObject;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CustomerAddress extends Address {
  id: string;
  profileId: string;
  label: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: "percent" | "fixed" | "free_shipping";
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount: number | null;
  startsAt: ISODateString | null;
  expiresAt: ISODateString | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usageCount: number;
  isActive: boolean;
}

export interface Offer {
  id: string;
  name: string;
  description: string;
  offerType: "percent" | "fixed" | "buy_x_get_y" | "free_shipping";
  discountValue: number;
  startsAt: ISODateString | null;
  endsAt: ISODateString | null;
  priority: number;
  isStackable: boolean;
  isActive: boolean;
}

export interface DeliveryArea {
  id: string;
  name: string;
  countryCode: string;
  state: string | null;
  city: string | null;
  postalCode: string | null;
  shippingFee: number;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface InventoryItem {
  variantId: string;
  sku: string;
  productName: string;
  size: string | null;
  color: string | null;
  quantityOnHand: number;
  reservedQuantity: number;
  reorderLevel: number;
  updatedAt: ISODateString;
}

export interface AuditLog {
  id: string;
  actorProfileId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: JsonObject | null;
  newValues: JsonObject | null;
  metadata: JsonObject;
  createdAt: ISODateString;
}

export interface BusinessSettingRecord {
  key: string;
  value: Json;
  description: string | null;
  isPublic: boolean;
  updatedAt: ISODateString;
}

export interface StoreVisit {
  id: string;
  profileId: string | null;
  sessionIdHash: string | null;
  path: string;
  referrer: string | null;
  userAgent: string | null;
  metadata: JsonObject;
  occurredAt: ISODateString;
}

export interface MetricSeriesPoint {
  label: string;
  value: number;
}

export interface TopProductMetric {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export interface AdminMetrics {
  currency: CurrencyCode;
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalVisits: number;
  conversionRate: number;
  averageOrderValue: number;
  activeProducts: number;
  lowStockProducts: number;
  pendingOrders: number;
  revenueChangePercent: number;
  ordersChangePercent: number;
  customersChangePercent: number;
  visitsChangePercent: number;
  salesSeries: MetricSeriesPoint[];
  visitsSeries: MetricSeriesPoint[];
  topProducts: TopProductMetric[];
  generatedAt: ISODateString;
}

/* Supabase table rows used by the browser's read-only catalog API. */
export interface DbBusinessSettingRow {
  setting_key: string;
  setting_value: Json;
  description: string | null;
  is_public: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCategoryRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbBrandRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbProductRow {
  id: string;
  brand_id: string | null;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  status: ProductStatus;
  tax_rate: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DbProductCategoryRow {
  product_id: string;
  category_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface DbProductImageRow {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbProductVariantRow {
  id: string;
  product_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  option_values: Json;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  currency: string;
  weight_grams: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Public catalog projection. It deliberately has no cost_price field. */
export interface DbCatalogVariantRow {
  id: string;
  product_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  option_values: Json;
  price: number;
  compare_at_price: number | null;
  currency: string;
  weight_grams: number | null;
  is_active: boolean;
  stock_quantity: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbOrderRow {
  id: string;
  order_number: string;
  profile_id: string | null;
  cart_id: string | null;
  coupon_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  shipping_total: number;
  total_amount: number;
  amount_paid: number;
  amount_refunded: number;
  shipping_address: Json;
  billing_address: Json;
  customer_note: string | null;
  internal_note: string | null;
  metadata: Json;
  placed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItemRow {
  id: string;
  order_id: string;
  product_variant_id: string | null;
  product_name: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DbStoreVisitRow {
  id: string;
  profile_id: string | null;
  session_id_hash: string | null;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  metadata: Json;
  occurred_at: string;
}

type DbTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type DbLooseTable = DbTable<Record<string, unknown>>;

type DbView<Row> = {
  Row: Row;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      business_settings: DbTable<DbBusinessSettingRow>;
      categories: DbTable<DbCategoryRow>;
      brands: DbTable<DbBrandRow>;
      products: DbTable<DbProductRow>;
      product_categories: DbTable<DbProductCategoryRow>;
      product_images: DbTable<DbProductImageRow>;
      product_variants: DbTable<DbProductVariantRow>;
      profiles: DbLooseTable;
      roles: DbLooseTable;
      permissions: DbLooseTable;
      role_permissions: DbLooseTable;
      profile_roles: DbLooseTable;
      inventory: DbLooseTable;
      inventory_movements: DbLooseTable;
      customer_addresses: DbLooseTable;
      carts: DbLooseTable;
      cart_items: DbLooseTable;
      wishlists: DbLooseTable;
      wishlist_items: DbLooseTable;
      coupons: DbLooseTable;
      coupon_products: DbLooseTable;
      coupon_categories: DbLooseTable;
      offers: DbLooseTable;
      offer_products: DbLooseTable;
      offer_categories: DbLooseTable;
      delivery_areas: DbLooseTable;
      orders: DbTable<DbOrderRow>;
      order_items: DbTable<DbOrderItemRow>;
      payments: DbLooseTable;
      coupon_redemptions: DbLooseTable;
      store_visits: DbTable<DbStoreVisitRow>;
      whatsapp_templates: DbLooseTable;
      notifications: DbLooseTable;
      audit_logs: DbLooseTable;
    };
    Views: {
      catalog_variants: DbView<DbCatalogVariantRow>;
    };
    Functions: {
      my_access: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      create_checkout: {
        Args: {
          _items: Json;
          _details: Json;
          _coupon: string | null;
          _idempotency_key: string;
        };
        Returns: Json;
      };
      check_delivery: {
        Args: { _postal_code: string; _city?: string; _state?: string };
        Returns: Json;
      };
      register_store_visit: {
        Args: { _details: Json };
        Returns: DbStoreVisitRow;
      };
      save_product: {
        Args: { _product: Json };
        Returns: string;
      };
      set_order_status: {
        Args: { _order_id: string; _status: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
