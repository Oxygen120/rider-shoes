import { defaultBusinessSettings } from "../data/demo";
import type { BusinessSettings, CartItem, WishlistItem } from "../types";

/** Only non-sensitive guest shopping state is persisted in the browser. */
export const STORAGE_KEYS = {
  cart: "rider-shoes:cart:v1",
  wishlist: "rider-shoes:wishlist:v1",
} as const;

const LEGACY_PRIVATE_KEYS = [
  "rider-shoes:orders:v1",
  "rider-shoes:store-visits:v1",
  "rider-shoes:settings:v1",
];

type TypeGuard<T> = (value: unknown) => value is T;

const getStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readArray = <T>(key: string, guard: TypeGuard<T>): T[] => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Browser storage is optional.
    }
    return [];
  }
};

const write = (key: string, value: unknown): boolean => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isCartItem = (value: unknown): value is CartItem => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.productId === "string" &&
    typeof value.variantId === "string" &&
    typeof value.productName === "string" &&
    typeof value.productSlug === "string" &&
    typeof value.imageUrl === "string" &&
    typeof value.sku === "string" &&
    isNullableString(value.size) &&
    isNullableString(value.color) &&
    typeof value.unitPrice === "number" &&
    Number.isFinite(value.unitPrice) &&
    value.unitPrice >= 0 &&
    typeof value.currency === "string" &&
    Number.isInteger(value.quantity) &&
    value.quantity > 0 &&
    typeof value.addedAt === "string"
  );
};

const isWishlistItem = (value: unknown): value is WishlistItem =>
  isRecord(value) && typeof value.productId === "string" && typeof value.addedAt === "string";

export const loadCart = (): CartItem[] => readArray(STORAGE_KEYS.cart, isCartItem);

export const saveCart = (items: CartItem[]): boolean =>
  write(STORAGE_KEYS.cart, items.filter(isCartItem));

export const clearCart = (): boolean => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEYS.cart);
    return true;
  } catch {
    return false;
  }
};

export const loadWishlist = (): WishlistItem[] =>
  readArray(STORAGE_KEYS.wishlist, isWishlistItem);

export const saveWishlist = (items: WishlistItem[]): boolean => {
  const unique = new Map<string, WishlistItem>();
  items.filter(isWishlistItem).forEach((item) => unique.set(item.productId, item));
  return write(STORAGE_KEYS.wishlist, [...unique.values()]);
};

export const clearWishlist = (): boolean => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEYS.wishlist);
    return true;
  } catch {
    return false;
  }
};

export const clearGuestShoppingStorage = (): void => {
  clearCart();
  clearWishlist();
};

/** Remove PII written by older preview builds. It is never read back. */
export const clearLegacyPrivateStorage = (): void => {
  const storage = getStorage();
  if (!storage) return;
  for (const key of LEGACY_PRIVATE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // Continue best-effort cleanup.
    }
  }
  try {
    window.sessionStorage.removeItem("rider-shoes:admin-demo-session");
  } catch {
    // Session storage is optional.
  }
};

const stringValue = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;
const numberValue = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const booleanValue = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

/** Normalize the public `store.settings` JSON document without accepting secrets. */
export const normalizeBusinessSettings = (value: unknown): BusinessSettings => {
  const source = isRecord(value) ? value : {};
  const defaults = defaultBusinessSettings;
  const colorMode = source.colorMode;
  return {
    storeName: stringValue(source.storeName, defaults.storeName),
    tagline: stringValue(source.tagline, defaults.tagline),
    description: stringValue(source.description, defaults.description),
    logoUrl: stringValue(source.logoUrl, defaults.logoUrl),
    currency: stringValue(source.currency, defaults.currency).toUpperCase().slice(0, 3),
    locale: stringValue(source.locale, defaults.locale),
    taxIncluded: booleanValue(source.taxIncluded, defaults.taxIncluded),
    supportEmail: stringValue(source.supportEmail, defaults.supportEmail),
    supportPhone: stringValue(source.supportPhone, defaults.supportPhone),
    supportWhatsappEnabled: booleanValue(source.supportWhatsappEnabled, defaults.supportWhatsappEnabled),
    supportWhatsappNumber: stringValue(source.supportWhatsappNumber, defaults.supportWhatsappNumber),
    addressLine1: stringValue(source.addressLine1, defaults.addressLine1),
    addressLine2: stringValue(source.addressLine2, defaults.addressLine2),
    city: stringValue(source.city, defaults.city),
    state: stringValue(source.state, defaults.state),
    postalCode: stringValue(source.postalCode, defaults.postalCode),
    countryCode: stringValue(source.countryCode, defaults.countryCode).toUpperCase().slice(0, 2),
    freeShippingThreshold: Math.max(0, numberValue(source.freeShippingThreshold, defaults.freeShippingThreshold)),
    standardShippingFee: Math.max(0, numberValue(source.standardShippingFee, defaults.standardShippingFee)),
    deliveryEstimate: stringValue(source.deliveryEstimate, defaults.deliveryEstimate),
    returnsWindowDays: Math.max(0, Math.round(numberValue(source.returnsWindowDays, defaults.returnsWindowDays))),
    announcementEnabled: booleanValue(source.announcementEnabled, defaults.announcementEnabled),
    announcementText: stringValue(source.announcementText, defaults.announcementText),
    heroTitle: stringValue(source.heroTitle, defaults.heroTitle),
    heroSubtitle: stringValue(source.heroSubtitle, defaults.heroSubtitle),
    heroImageUrl: stringValue(source.heroImageUrl, defaults.heroImageUrl),
    heroButtonLabel: stringValue(source.heroButtonLabel, defaults.heroButtonLabel),
    heroButtonUrl: stringValue(source.heroButtonUrl, defaults.heroButtonUrl),
    primaryColor: stringValue(source.primaryColor, defaults.primaryColor),
    secondaryColor: stringValue(source.secondaryColor, defaults.secondaryColor),
    colorMode: colorMode === "dark" || colorMode === "system" || colorMode === "light"
      ? colorMode
      : defaults.colorMode,
    instagramUrl: stringValue(source.instagramUrl, defaults.instagramUrl),
    facebookUrl: stringValue(source.facebookUrl, defaults.facebookUrl),
    youtubeUrl: stringValue(source.youtubeUrl, defaults.youtubeUrl),
    mapsUrl: stringValue(source.mapsUrl, defaults.mapsUrl),
    storeHours: stringValue(source.storeHours, defaults.storeHours),
    seoTitle: stringValue(source.seoTitle, defaults.seoTitle),
    seoDescription: stringValue(source.seoDescription, defaults.seoDescription),
    onlineOrdersEnabled: booleanValue(source.onlineOrdersEnabled, defaults.onlineOrdersEnabled),
    codEnabled: booleanValue(source.codEnabled, defaults.codEnabled),
    codMin: Math.max(0, numberValue(source.codMin, defaults.codMin)),
    codMax: Math.max(0, numberValue(source.codMax, defaults.codMax)),
    codFee: Math.max(0, numberValue(source.codFee, defaults.codFee)),
    storeVisitDiscount: Math.max(0, numberValue(source.storeVisitDiscount, defaults.storeVisitDiscount)),
    storeVisitValidityDays: Math.max(1, Math.round(numberValue(source.storeVisitValidityDays, defaults.storeVisitValidityDays))),
    storeVisitTerms: stringValue(source.storeVisitTerms, defaults.storeVisitTerms),
    whatsappAutomationEnabled: booleanValue(source.whatsappAutomationEnabled, defaults.whatsappAutomationEnabled),
  };
};

export const getCart = loadCart;
export const setCart = saveCart;
export const getWishlist = loadWishlist;
export const setWishlist = saveWishlist;
