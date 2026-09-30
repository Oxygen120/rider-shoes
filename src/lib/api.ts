import {
  DEMO_IMAGE_PLACEHOLDER,
  defaultBusinessSettings,
  demoCategories,
  demoProducts,
} from "../data/demo";
import { getPublicAssetUrl, getSupabaseClient } from "./supabase";
import { normalizeBusinessSettings } from "./storage";
import type {
  BrandSummary,
  BusinessSettings,
  Category,
  DbBrandRow,
  DbBusinessSettingRow,
  DbCategoryRow,
  DbProductCategoryRow,
  DbProductImageRow,
  DbProductRow,
  DbProductVariantRow,
  Json,
  JsonObject,
  Product,
  ProductImage,
  ProductVariant,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  Order,
} from "../types";

const FALLBACK_DATE = "2026-01-15T00:00:00.000Z";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asObject = (value: unknown): JsonObject =>
  isRecord(value) ? (value as JsonObject) : {};

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

const uniqueStrings = (values: readonly (string | null | undefined)[]): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];

const metadataString = (metadata: JsonObject, key: string): string | null => {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
};

const metadataNumber = (metadata: JsonObject, key: string): number | null => {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const metadataStrings = (metadata: JsonObject, key: string): string[] => {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
};

const cloneProduct = (product: Product): Product => ({
  ...product,
  brand: product.brand ? { ...product.brand } : null,
  categoryIds: [...product.categoryIds],
  images: product.images.map((image) => ({ ...image })),
  variants: product.variants.map((variant) => ({
    ...variant,
    optionValues: { ...variant.optionValues },
  })),
  metadata: { ...product.metadata },
  sizes: [...product.sizes],
  colors: [...product.colors],
  tags: [...product.tags],
});

const cloneCategory = (category: Category): Category => ({ ...category });

const cloneSettings = (settings: BusinessSettings): BusinessSettings => ({ ...settings });

const demoProductFallback = (): Product[] => demoProducts.map(cloneProduct);
const demoCategoryFallback = (): Category[] => demoCategories.map(cloneCategory);

const mapCategory = (row: DbCategoryRow): Category => ({
  id: row.id,
  parentId: row.parent_id,
  slug: row.slug,
  name: row.name,
  description: row.description ?? "",
  imageUrl: row.image_url ?? DEMO_IMAGE_PLACEHOLDER,
  sortOrder: asNumber(row.sort_order),
  isActive: row.is_active,
  seoTitle: row.seo_title,
  seoDescription: row.seo_description,
  productCount: null,
  createdAt: asString(row.created_at, FALLBACK_DATE),
  updatedAt: asString(row.updated_at, FALLBACK_DATE),
});

const mapVariant = (row: DbProductVariantRow): ProductVariant => ({
  id: row.id,
  productId: row.product_id,
  sku: row.sku,
  size: row.size,
  color: row.color,
  optionValues: asObject(row.option_values),
  price: asNumber(row.price),
  compareAtPrice:
    row.compare_at_price === null ? null : asNumber(row.compare_at_price),
  currency: row.currency || "INR",
  weightGrams: row.weight_grams === null ? null : asNumber(row.weight_grams),
  isActive: row.is_active,
  // Inventory is intentionally not exposed to anonymous browser readers.
  stockQuantity: null,
});

const mapImage = (row: DbProductImageRow): ProductImage => ({
  id: row.id,
  url: getPublicAssetUrl("product-images", row.storage_path) ?? DEMO_IMAGE_PLACEHOLDER,
  altText: row.alt_text ?? "Rider Shoes product image",
  sortOrder: asNumber(row.sort_order),
  isPrimary: row.is_primary,
});

const mapProduct = (
  row: DbProductRow,
  variants: DbProductVariantRow[],
  images: DbProductImageRow[],
  categoryLinks: DbProductCategoryRow[],
  brand: DbBrandRow | null,
): Product => {
  const metadata = asObject(row.metadata);
  const mappedVariants = variants
    .filter((variant) => variant.is_active)
    .map(mapVariant)
    .sort((left, right) => left.price - right.price);
  const mappedImages = images.map(mapImage).sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    return left.sortOrder - right.sortOrder;
  });
  const firstVariant = mappedVariants[0];
  const metadataPrice = metadataNumber(metadata, "price") ?? 0;
  const price = firstVariant?.price ?? metadataPrice;
  const compareAtPrice =
    firstVariant?.compareAtPrice ?? metadataNumber(metadata, "compareAtPrice");
  const categoryIds = categoryLinks
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary))
    .map((link) => link.category_id);
  const tags = metadataStrings(metadata, "tags");
  const rating = metadataNumber(metadata, "rating");
  const reviewCount = Math.max(0, Math.round(metadataNumber(metadata, "reviewCount") ?? 0));
  const imageUrl = mappedImages[0]?.url ?? DEMO_IMAGE_PLACEHOLDER;

  const brandSummary: BrandSummary | null = brand
    ? { id: brand.id, slug: brand.slug, name: brand.name }
    : null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description ?? "",
    description: row.description ?? row.short_description ?? "",
    status: row.status,
    taxRate: asNumber(row.tax_rate),
    brand: brandSummary,
    categoryIds: uniqueStrings(categoryIds),
    primaryCategoryId:
      categoryLinks.find((link) => link.is_primary)?.category_id ?? categoryIds[0] ?? null,
    images: mappedImages,
    variants: mappedVariants,
    metadata,
    price,
    compareAtPrice,
    currency: firstVariant?.currency ?? "INR",
    imageUrl,
    sizes: uniqueStrings(mappedVariants.map((variant) => variant.size)),
    colors: uniqueStrings(mappedVariants.map((variant) => variant.color)),
    tags,
    featured: asBoolean(metadata.featured),
    isNew: asBoolean(metadata.isNew),
    badge: metadataString(metadata, "badge"),
    rating: rating === null ? null : Math.min(5, Math.max(0, rating)),
    reviewCount,
    inStock: mappedVariants.length > 0,
    createdAt: asString(row.created_at, FALLBACK_DATE),
    updatedAt: asString(row.updated_at, FALLBACK_DATE),
  };
};

const fetchProductsFromSupabase = async (client: NonNullable<ReturnType<typeof getSupabaseClient>>): Promise<Product[]> => {
  const productResult = await client
    .from("products")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (productResult.error) throw productResult.error;

  const productRows = (productResult.data ?? []) as unknown as DbProductRow[];
  if (productRows.length === 0) return [];
  const productIds = productRows.map((row) => row.id);

  const [variantResult, imageResult, categoryResult] = await Promise.all([
    client.from("product_variants").select("*").in("product_id", productIds).eq("is_active", true),
    client.from("product_images").select("*").in("product_id", productIds),
    client.from("product_categories").select("*").in("product_id", productIds),
  ]);
  if (variantResult.error) throw variantResult.error;
  if (imageResult.error) throw imageResult.error;
  if (categoryResult.error) throw categoryResult.error;

  const variantRows = (variantResult.data ?? []) as unknown as DbProductVariantRow[];
  const imageRows = (imageResult.data ?? []) as unknown as DbProductImageRow[];
  const categoryRows = (categoryResult.data ?? []) as unknown as DbProductCategoryRow[];
  const brandIds = uniqueStrings(productRows.map((row) => row.brand_id));
  let brandRows: DbBrandRow[] = [];

  if (brandIds.length > 0) {
    const brandResult = await client.from("brands").select("*").in("id", brandIds);
    if (brandResult.error) throw brandResult.error;
    brandRows = (brandResult.data ?? []) as unknown as DbBrandRow[];
  }

  const brandsById = new Map(brandRows.map((brand) => [brand.id, brand]));
  return productRows.map((row) =>
    mapProduct(
      row,
      variantRows.filter((variant) => variant.product_id === row.id),
      imageRows.filter((image) => image.product_id === row.id),
      categoryRows.filter((link) => link.product_id === row.id),
      row.brand_id ? brandsById.get(row.brand_id) ?? null : null,
    ),
  );
};

const fetchCategoriesFromSupabase = async (
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<Category[]> => {
  const result = await client
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (result.error) throw result.error;
  return ((result.data ?? []) as unknown as DbCategoryRow[]).map(mapCategory);
};

type SettingsField = keyof BusinessSettings;

const setStringSetting = (
  settings: BusinessSettings,
  field: SettingsField,
  value: Json,
): void => {
  if (typeof value === "string") {
    settings[field] = value as never;
  }
};

const applySettingRow = (settings: BusinessSettings, row: DbBusinessSettingRow): void => {
  const value = row.setting_value;
  switch (row.setting_key) {
    case "store.name":
      setStringSetting(settings, "storeName", value);
      break;
    case "store.tagline":
      setStringSetting(settings, "tagline", value);
      break;
    case "store.description":
      setStringSetting(settings, "description", value);
      break;
    case "store.logo_url":
      setStringSetting(settings, "logoUrl", value);
      break;
    case "store.currency":
      setStringSetting(settings, "currency", value);
      break;
    case "store.locale":
      setStringSetting(settings, "locale", value);
      break;
    case "store.tax_included":
      if (typeof value === "boolean") settings.taxIncluded = value;
      break;
    case "store.support_email":
      setStringSetting(settings, "supportEmail", value);
      break;
    case "store.support_phone":
      setStringSetting(settings, "supportPhone", value);
      break;
    case "store.support_whatsapp_enabled":
      if (typeof value === "boolean") settings.supportWhatsappEnabled = value;
      break;
    case "store.support_whatsapp_number":
      setStringSetting(settings, "supportWhatsappNumber", value);
      break;
    case "store.address_line_1":
      setStringSetting(settings, "addressLine1", value);
      break;
    case "store.address_line_2":
      setStringSetting(settings, "addressLine2", value);
      break;
    case "store.city":
      setStringSetting(settings, "city", value);
      break;
    case "store.state":
      setStringSetting(settings, "state", value);
      break;
    case "store.postal_code":
      setStringSetting(settings, "postalCode", value);
      break;
    case "store.country_code":
      setStringSetting(settings, "countryCode", value);
      break;
    case "shipping.free_shipping_threshold":
      if (typeof value === "number" && Number.isFinite(value)) settings.freeShippingThreshold = value;
      break;
    case "shipping.standard_fee":
      if (typeof value === "number" && Number.isFinite(value)) settings.standardShippingFee = value;
      break;
    case "shipping.delivery_estimate":
      setStringSetting(settings, "deliveryEstimate", value);
      break;
    case "returns.window_days":
      if (typeof value === "number" && Number.isFinite(value)) settings.returnsWindowDays = value;
      break;
    case "store.announcement_enabled":
      if (typeof value === "boolean") settings.announcementEnabled = value;
      break;
    case "store.announcement_text":
      setStringSetting(settings, "announcementText", value);
      break;
    case "store.hero_title":
      setStringSetting(settings, "heroTitle", value);
      break;
    case "store.hero_subtitle":
      setStringSetting(settings, "heroSubtitle", value);
      break;
    case "store.instagram_url":
      setStringSetting(settings, "instagramUrl", value);
      break;
    case "store.facebook_url":
      setStringSetting(settings, "facebookUrl", value);
      break;
    case "store.hours":
      setStringSetting(settings, "storeHours", value);
      break;
    case "store.settings":
      if (isRecord(value)) {
        Object.assign(settings, normalizeBusinessSettings({ ...settings, ...value }));
      }
      break;
    default:
      // Unknown keys are retained in Supabase but intentionally ignored by the
      // typed storefront settings object until a UI field is added for them.
      break;
  }
};

const fetchSettingsFromSupabase = async (
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<BusinessSettings> => {
  const result = await client
    .from("business_settings")
    .select("*")
    .eq("is_public", true);
  if (result.error) throw result.error;

  const rows = (result.data ?? []) as unknown as DbBusinessSettingRow[];
  const settings = cloneSettings(defaultBusinessSettings);
  rows.forEach((row) => applySettingRow(settings, row));
  return normalizeBusinessSettings(settings);
};

/** Read active products, using the local catalog when Supabase is unavailable. */
export const fetchActiveProducts = async (): Promise<Product[]> => {
  const client = getSupabaseClient();
  if (!client) return demoProductFallback();
  try {
    const products = await fetchProductsFromSupabase(client);
    return products.length > 0 ? products : demoProductFallback();
  } catch {
    return demoProductFallback();
  }
};

/** Read active categories, using the local catalog when Supabase is unavailable. */
export const fetchActiveCategories = async (): Promise<Category[]> => {
  const client = getSupabaseClient();
  if (!client) return demoCategoryFallback();
  try {
    const categories = await fetchCategoriesFromSupabase(client);
    return categories.length > 0 ? categories : demoCategoryFallback();
  } catch {
    return demoCategoryFallback();
  }
};

/** Read public business settings, merged over editable Rider Shoes defaults. */
export const fetchBusinessSettings = async (): Promise<BusinessSettings> => {
  const client = getSupabaseClient();
  if (!client) return cloneSettings(defaultBusinessSettings);
  try {
    return await fetchSettingsFromSupabase(client);
  } catch {
    return cloneSettings(defaultBusinessSettings);
  }
};

export const fetchProductBySlug = async (slug: string): Promise<Product | null> => {
  const products = await fetchActiveProducts();
  return products.find((product) => product.slug === slug) ?? null;
};

export const fetchProductById = async (id: string): Promise<Product | null> => {
  const products = await fetchActiveProducts();
  return products.find((product) => product.id === id) ?? null;
};

export interface StorefrontData {
  products: Product[];
  categories: Category[];
  settings: BusinessSettings;
}

export const fetchStorefrontData = async (): Promise<StorefrontData> => {
  const [products, categories, settings] = await Promise.all([
    fetchActiveProducts(),
    fetchActiveCategories(),
    fetchBusinessSettings(),
  ]);
  return { products, categories, settings };
};

// Short aliases are useful in route loaders and keep the API surface discoverable.
export const getActiveProducts = fetchActiveProducts;
export const getActiveCategories = fetchActiveCategories;
export const getBusinessSettings = fetchBusinessSettings;
export const getProducts = fetchActiveProducts;
export const getCategories = fetchActiveCategories;
export const getSettings = fetchBusinessSettings;

export interface CreateCheckoutInput {
  variantId: string;
  quantity: number;
}

export interface CreateCheckoutDetails {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  paymentMethod: "cod" | "razorpay";
  customerNote?: string;
}

export const createCheckout = async (
  items: CreateCheckoutInput[],
  details: CreateCheckoutDetails,
  coupon: string | null = null,
): Promise<CreatedCheckoutResult> => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured. Checkout is unavailable in offline mode.");
  if (!items.length) throw new Error("Your bag is empty.");
  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await client.rpc("create_checkout", {
    _items: items,
    _details: details,
    _coupon: coupon,
    _idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message || "Unable to create checkout.");
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Checkout did not return an order.");
  const result = data as Record<string, unknown>;
  if (typeof result.orderId !== "string" || typeof result.orderNumber !== "string") {
    throw new Error("Checkout returned an invalid order response.");
  }
  return {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    status: String(result.status || "pending"),
    paymentStatus: String(result.paymentStatus || "pending"),
    totalAmount: Number(result.totalAmount || 0),
  };
};

export const setOrderStatus = async (orderId: string, status: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { error } = await client.rpc("set_order_status", { _order_id: orderId, _status: status });
  if (error) throw new Error(error.message || "Unable to update order status.");
};

export interface CreatedCheckoutResult {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
}

export interface CreatedOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: number;
  shippingTotal: number;
  totalAmount: number;
  createdAt: string;
}

export const fetchCreatedOrder = async (orderId: string): Promise<CreatedOrderSummary> => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client
    .from("orders")
    .select("id, order_number, status, payment_status, fulfillment_status, subtotal, shipping_total, total_amount, created_at")
    .eq("id", orderId)
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to load the created order.");
  return {
    id: data.id,
    orderNumber: data.order_number,
    status: data.status as OrderStatus,
    paymentStatus: data.payment_status as PaymentStatus,
    fulfillmentStatus: data.fulfillment_status as FulfillmentStatus,
    subtotal: Number(data.subtotal),
    shippingTotal: Number(data.shipping_total),
    totalAmount: Number(data.total_amount),
    createdAt: data.created_at,
  };
};

export const saveBusinessSettings = async (settings: BusinessSettings): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  const rows = [
    ["store.name", settings.storeName], ["store.tagline", settings.tagline],
    ["store.description", settings.description], ["store.logo_url", settings.logoUrl],
    ["store.currency", settings.currency], ["store.locale", settings.locale],
    ["store.tax_included", settings.taxIncluded], ["store.support_email", settings.supportEmail],
    ["store.support_phone", settings.supportPhone], ["store.support_whatsapp_enabled", settings.supportWhatsappEnabled],
    ["store.support_whatsapp_number", settings.supportWhatsappNumber], ["store.address_line_1", settings.addressLine1],
    ["store.address_line_2", settings.addressLine2], ["store.city", settings.city],
    ["store.state", settings.state], ["store.postal_code", settings.postalCode],
    ["store.country_code", settings.countryCode], ["shipping.free_shipping_threshold", settings.freeShippingThreshold],
    ["shipping.standard_fee", settings.standardShippingFee], ["shipping.delivery_estimate", settings.deliveryEstimate],
    ["returns.window_days", settings.returnsWindowDays], ["store.announcement_enabled", settings.announcementEnabled],
    ["store.announcement_text", settings.announcementText], ["store.hero_title", settings.heroTitle],
    ["store.hero_subtitle", settings.heroSubtitle], ["store.instagram_url", settings.instagramUrl],
    ["store.facebook_url", settings.facebookUrl], ["store.hours", settings.storeHours],
    ["store.settings", { onlineOrdersEnabled: true, freeShippingThreshold: settings.freeShippingThreshold, standardShippingFee: settings.standardShippingFee, deliveryEstimate: settings.deliveryEstimate }],
  ].map(([setting_key, setting_value]) => ({ setting_key, setting_value }));
  const { error } = await client.from("business_settings").upsert(rows, { onConflict: "setting_key" });
  if (error) throw new Error(error.message || "Unable to save business settings.");
};

export const fetchCurrentOrders = async (): Promise<Order[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data: rows, error } = await client.from("orders").select("*").order("created_at", { ascending: false });
  if (error || !rows?.length) return [];
  const ids = rows.map((row) => row.id);
  const { data: itemRows } = await client.from("order_items").select("*").in("order_id", ids);
  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }
  return rows.map((row) => {
    const address = (row.shipping_address && typeof row.shipping_address === "object" ? row.shipping_address : {}) as Record<string, unknown>;
    const customer = (row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>).customer : null) as Record<string, unknown> | null;
    return {
      id: row.id, orderNumber: row.order_number,
      customer: { name: String(customer?.name ?? address.recipientName ?? "Customer"), email: String(customer?.email ?? ""), phone: String(customer?.phone ?? address.phone ?? "") },
      items: (itemsByOrder.get(row.id) ?? []).map((item) => ({
        id: item.id, productId: null, variantId: item.product_variant_id, productName: item.product_name,
        productSlug: typeof item.metadata === "object" && item.metadata ? String((item.metadata as Record<string, unknown>).productSlug ?? "") : null,
        imageUrl: "", sku: item.sku, size: item.size, color: item.color, quantity: item.quantity,
        unitPrice: Number(item.unit_price), discountAmount: Number(item.discount_amount), taxAmount: Number(item.tax_amount), lineTotal: Number(item.line_total),
      })),
      status: row.status as OrderStatus, paymentStatus: row.payment_status as PaymentStatus,
      fulfillmentStatus: row.fulfillment_status as FulfillmentStatus,
      paymentMethod: (row.metadata && typeof row.metadata === "object" && (row.metadata as Record<string, unknown>).paymentMethod === "razorpay") ? "razorpay" : "cod",
      currency: row.currency, subtotal: Number(row.subtotal), discountTotal: Number(row.discount_total), taxTotal: Number(row.tax_total),
      shippingTotal: Number(row.shipping_total), totalAmount: Number(row.total_amount), amountPaid: Number(row.amount_paid), amountRefunded: Number(row.amount_refunded),
      shippingAddress: address as Order["shippingAddress"], billingAddress: address as Order["billingAddress"], customerNote: row.customer_note ?? "",
      trackingNumber: typeof row.metadata === "object" && row.metadata ? String((row.metadata as Record<string, unknown>).trackingNumber ?? "") || null : null,
      placedAt: row.placed_at, paidAt: row.paid_at, cancelledAt: row.cancelled_at, createdAt: row.created_at, updatedAt: row.updated_at,
    } as Order;
  });
};

export const saveProduct = async (product: Product): Promise<string> => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.rpc("save_product", { _product: product as unknown as Json });
  if (error) throw new Error(error.message || "Unable to save product.");
  if (typeof data !== "string") throw new Error("Product save did not return an id.");
  return data;
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { error } = await client.from("products").delete().eq("id", productId);
  if (error) throw new Error(error.message || "Unable to delete product.");
};
