import type {
  BrandSummary,
  BusinessSettings,
  Category,
  Product,
  ProductImage,
  ProductVariant,
} from "../types";

const DEMO_DATE = "2026-01-15T00:00:00.000Z";
const DEMO_BRAND: BrandSummary = {
  id: "demo-brand-rider-shoes",
  slug: "rider-shoes",
  name: "Rider Shoes",
};

/** Stable, freely usable Unsplash image URLs for the local storefront preview. */
const shoeImage = (photoId: string): string =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1200&q=85`;

export const DEMO_IMAGE_PLACEHOLDER =
  "https://placehold.co/1200x900/f4f1ec/24313a?text=Rider+Shoes";

const category = (
  id: string,
  slug: string,
  name: string,
  description: string,
  imageUrl: string,
  sortOrder: number,
  productCount: number,
): Category => ({
  id,
  parentId: null,
  slug,
  name,
  description,
  imageUrl,
  sortOrder,
  isActive: true,
  seoTitle: `${name} shoes | Rider Shoes`,
  seoDescription: description,
  productCount,
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
});

export const demoCategories: Category[] = [
  category(
    "demo-category-running",
    "running",
    "Running",
    "Lightweight daily miles, responsive cushioning, and easy movement.",
    shoeImage("photo-1542291026-7eec264c27ff"),
    1,
    2,
  ),
  category(
    "demo-category-everyday",
    "everyday",
    "Everyday",
    "Comfort-first sneakers made for commutes, errands, and weekends.",
    shoeImage("photo-1549298916-b41d501d3772"),
    2,
    3,
  ),
  category(
    "demo-category-training",
    "training",
    "Training",
    "Stable, flexible shoes for gym sessions and active routines.",
    shoeImage("photo-1600185365483-26d7a4cc7519"),
    3,
    2,
  ),
  category(
    "demo-category-outdoor",
    "outdoor",
    "Outdoor",
    "Confident grip and durable comfort for paths beyond the pavement.",
    shoeImage("photo-1460353581641-37baddab0fa2"),
    4,
    1,
  ),
  category(
    "demo-category-kids",
    "kids",
    "Kids",
    "Easy-on, easy-off pairs designed for growing feet and busy days.",
    shoeImage("photo-1514989940723-e8e51635b782"),
    5,
    1,
  ),
];

interface DemoProductSeed {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  price: number;
  compareAtPrice: number | null;
  currency?: string;
  sizes: string[];
  colors: string[];
  imageIds: string[];
  tags: string[];
  featured?: boolean;
  isNew?: boolean;
  badge?: string | null;
  rating: number;
  reviewCount: number;
  metadata?: Record<string, string | number | boolean>;
};

const makeVariants = (seed: DemoProductSeed): ProductVariant[] =>
  seed.sizes.flatMap((size, sizeIndex) =>
    seed.colors.map((color, colorIndex) => ({
      id: `${seed.id}-variant-${size.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${color.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      productId: seed.id,
      sku: `RS-${String(sizeIndex + 1).padStart(2, "0")}-${String(colorIndex + 1).padStart(2, "0")}-${seed.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
      size,
      color,
      optionValues: { size, color },
      price: seed.price,
      compareAtPrice: seed.compareAtPrice,
      currency: seed.currency ?? "INR",
      weightGrams: 620,
      isActive: true,
      stockQuantity: 8 + ((sizeIndex + colorIndex) % 5) * 3,
    })),
  );

const makeProduct = (seed: DemoProductSeed): Product => {
  const images: ProductImage[] = seed.imageIds.map((id, index) => ({
    id: `${seed.id}-image-${index + 1}`,
    url: shoeImage(id),
    altText: `${seed.name} — view ${index + 1}`,
    sortOrder: index,
    isPrimary: index === 0,
  }));
  const variants = makeVariants(seed);

  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    shortDescription: seed.shortDescription,
    description: seed.description,
    status: "active",
    taxRate: 18,
    brand: DEMO_BRAND,
    categoryIds: [seed.categoryId],
    primaryCategoryId: seed.categoryId,
    images,
    variants,
    metadata: seed.metadata ?? {},
    price: seed.price,
    compareAtPrice: seed.compareAtPrice,
    currency: seed.currency ?? "INR",
    imageUrl: images[0]?.url ?? DEMO_IMAGE_PLACEHOLDER,
    sizes: [...seed.sizes],
    colors: [...seed.colors],
    tags: [...seed.tags],
    featured: seed.featured ?? false,
    isNew: seed.isNew ?? false,
    badge: seed.badge ?? null,
    rating: seed.rating,
    reviewCount: seed.reviewCount,
    inStock: variants.some((variant) => variant.stockQuantity === null || variant.stockQuantity > 0),
    createdAt: DEMO_DATE,
    updatedAt: DEMO_DATE,
  };
};

export const demoProducts: Product[] = [
  makeProduct({
    id: "demo-product-aero-pace",
    slug: "aero-pace-runner",
    name: "Aero Pace Runner",
    shortDescription: "Springy everyday mileage with a breathable knit upper.",
    description:
      "A balanced road runner for morning loops and long city walks. The Aero Pace pairs a soft landing with a stable heel and a flexible forefoot.",
    categoryId: "demo-category-running",
    price: 3499,
    compareAtPrice: 4199,
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: ["Cloud / Coral"],
    imageIds: ["photo-1491553895911-0055eca6402d", "photo-1542291026-7eec264c27ff"],
    tags: ["running", "breathable", "daily miles"],
    featured: true,
    badge: "Best seller",
    rating: 4.8,
    reviewCount: 126,
    metadata: { collection: "Motion", cushioning: "soft", material: "knit" },
  }),
  makeProduct({
    id: "demo-product-drift-knit",
    slug: "drift-knit-walker",
    name: "Drift Knit Walker",
    shortDescription: "Slip into lightweight comfort for the whole day.",
    description:
      "The Drift Knit Walker keeps things simple: a flexible sole, smooth collar, and airy upper that feels at home from the train platform to the coffee shop.",
    categoryId: "demo-category-everyday",
    price: 2799,
    compareAtPrice: 3299,
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["Stone / Sage", "Ink / Sand"],
    imageIds: ["photo-1549298916-b41d501d3772", "photo-1600185365483-26d7a4cc7519"],
    tags: ["everyday", "lightweight", "knit"],
    featured: true,
    isNew: true,
    badge: "New",
    rating: 4.6,
    reviewCount: 74,
    metadata: { collection: "Daily", cushioning: "balanced", material: "recycled knit" },
  }),
  makeProduct({
    id: "demo-product-summit-grip",
    slug: "summit-grip-trail",
    name: "Summit Grip Trail",
    shortDescription: "Confident traction for weekend paths and changing ground.",
    description:
      "A durable trail companion with a protective toe cap, grippy outsole, and cushioned midsole for exploring parks, paths, and light hills.",
    categoryId: "demo-category-outdoor",
    price: 4499,
    compareAtPrice: 4999,
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: ["Pine / Charcoal"],
    imageIds: ["photo-1460353581641-37baddab0fa2", "photo-1539185441755-769473a23570"],
    tags: ["outdoor", "trail", "grip"],
    featured: true,
    badge: "Trail ready",
    rating: 4.7,
    reviewCount: 59,
    metadata: { collection: "Terrain", cushioning: "responsive", material: "ripstop" },
  }),
  makeProduct({
    id: "demo-product-corelift",
    slug: "corelift-training-shoe",
    name: "CoreLift Training Shoe",
    shortDescription: "A stable base for strength days and quick circuits.",
    description:
      "Built for movement in every direction, CoreLift combines a grounded platform with a flexible forefoot and breathable panels for focused training.",
    categoryId: "demo-category-training",
    price: 3899,
    compareAtPrice: null,
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: ["Graphite / Lime"],
    imageIds: ["photo-1608231387042-66d1773070a5", "photo-1595950653106-6c9ebd614d3a"],
    tags: ["training", "gym", "stable"],
    featured: true,
    rating: 4.5,
    reviewCount: 42,
    metadata: { collection: "Motion", cushioning: "firm", material: "mesh" },
  }),
  makeProduct({
    id: "demo-product-metro-flex",
    slug: "metro-flex-slip-on",
    name: "Metro Flex Slip-On",
    shortDescription: "Clean lines and no-fuss comfort for busy days.",
    description:
      "The Metro Flex is an easygoing slip-on with a softly structured heel and a flexible outsole that keeps commutes comfortable.",
    categoryId: "demo-category-everyday",
    price: 2499,
    compareAtPrice: 2899,
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["Black / Fog"],
    imageIds: ["photo-1514989940723-e8e51635b782", "photo-1549298916-b41d501d3772"],
    tags: ["everyday", "slip-on", "commute"],
    isNew: true,
    badge: "Easy on",
    rating: 4.4,
    reviewCount: 31,
    metadata: { collection: "Daily", cushioning: "soft", material: "canvas" },
  }),
  makeProduct({
    id: "demo-product-courtline",
    slug: "courtline-active",
    name: "Courtline Active",
    shortDescription: "A versatile court-inspired pair with a cushioned step.",
    description:
      "Courtline brings a crisp, low-profile shape to active days, with enough cushioning for a full schedule and enough flexibility for quick movement.",
    categoryId: "demo-category-training",
    price: 3299,
    compareAtPrice: 3799,
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: ["White / Ocean", "Sand / Rust"],
    imageIds: ["photo-1539185441755-769473a23570", "photo-1600185365483-26d7a4cc7519"],
    tags: ["training", "court", "versatile"],
    rating: 4.3,
    reviewCount: 28,
    metadata: { collection: "Active", cushioning: "balanced", material: "synthetic leather" },
  }),
  makeProduct({
    id: "demo-product-coast-canvas",
    slug: "coast-canvas-low",
    name: "Coast Canvas Low",
    shortDescription: "An easy canvas low-top for slow weekends.",
    description:
      "Coast Canvas Low is a relaxed, low-profile sneaker with a comfortable footbed and a durable rubber toe for everyday wear.",
    categoryId: "demo-category-everyday",
    price: 2199,
    compareAtPrice: null,
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["Sea Blue / Cream"],
    imageIds: ["photo-1491553895911-0055eca6402d", "photo-1514989940723-e8e51635b782"],
    tags: ["everyday", "canvas", "casual"],
    rating: 4.2,
    reviewCount: 19,
    metadata: { collection: "Daily", cushioning: "light", material: "canvas" },
  }),
  makeProduct({
    id: "demo-product-dash-junior",
    slug: "dash-junior-runner",
    name: "Dash Junior Runner",
    shortDescription: "Play-ready comfort with bright, easy-to-see details.",
    description:
      "Dash Junior is made for growing feet and big afternoons, with a flexible sole, padded collar, and a simple hook-and-loop closure.",
    categoryId: "demo-category-kids",
    price: 1999,
    compareAtPrice: 2399,
    sizes: ["1", "2", "3", "4", "5"],
    colors: ["Sky / Mango"],
    imageIds: ["photo-1595950653106-6c9ebd614d3a", "photo-1542291026-7eec264c27ff"],
    tags: ["kids", "play", "easy closure"],
    isNew: true,
    badge: "Growing feet",
    rating: 4.7,
    reviewCount: 36,
    metadata: { collection: "Junior", cushioning: "soft", material: "mesh" },
  }),
];

/**
 * Safe defaults used before a store has saved its public settings. Every field
 * is intentionally editable by the storefront/admin settings UI.
 */
export const defaultBusinessSettings: BusinessSettings = {
  storeName: "Rider Shoes",
  tagline: "Step into a bolder you.",
  description:
    "Thoughtful footwear for everyday movement, from the first step to the last mile.",
  logoUrl: "",
  currency: "INR",
  locale: "en-IN",
  taxIncluded: true,
  supportEmail: "hello@ridershoes.example",
  supportPhone: "+91 99791 31767",
  supportWhatsappEnabled: false,
  supportWhatsappNumber: "+91 99791 31767",
  addressLine1: "Rider Shoes, Main Market",
  addressLine2: "",
  city: "Dhanera",
  state: "Gujarat",
  postalCode: "385310",
  countryCode: "IN",
  freeShippingThreshold: 2499,
  standardShippingFee: 149,
  deliveryEstimate: "3–7 business days",
  returnsWindowDays: 14,
  announcementEnabled: true,
  announcementText: "Free shipping on orders over ₹2,499",
  heroTitle: "Step into a bolder you.",
  heroSubtitle: "Premium shoes for every step — style, comfort, and performance from Dhanera.",
  heroImageUrl: "",
  heroButtonLabel: "Shop the collection",
  heroButtonUrl: "/shop",
  primaryColor: "#ef6b4f",
  secondaryColor: "#17313a",
  colorMode: "light",
  instagramUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  mapsUrl: "",
  storeHours: "Monday–Saturday, 10:00–22:00",
  seoTitle: "Rider Shoes — Footwear for everyday movement",
  seoDescription: "Shop comfortable everyday, running, training, outdoor, and kids footwear from Rider Shoes.",
  onlineOrdersEnabled: true,
  codEnabled: true,
  codMin: 0,
  codMax: 10000,
  codFee: 0,
  storeVisitDiscount: 0,
  storeVisitValidityDays: 7,
  storeVisitTerms: "Offer eligibility and product availability are confirmed in store.",
  whatsappAutomationEnabled: false,
};

// Upper-case alias is convenient for callers that treat defaults as constants.
export const DEFAULT_BUSINESS_SETTINGS = defaultBusinessSettings;
