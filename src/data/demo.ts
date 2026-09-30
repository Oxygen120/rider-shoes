import type { BusinessSettings, Category, Product } from "../types";

/** Production catalog starts empty; no demo products/categories are rendered. */
export const DEMO_IMAGE_PLACEHOLDER = "https://placehold.co/1200x1000/f4f1ec/24313a?text=Rider+Shoes";
export const demoProducts: Product[] = [];
export const demoCategories: Category[] = [];

export const defaultBusinessSettings: BusinessSettings = {
  storeName: "Rider Shoes", tagline: "Step into a bolder you.", description: "Rider Shoes — footwear for everyday movement.", logoUrl: "", currency: "INR", locale: "en-IN", taxIncluded: true,
  supportEmail: "", supportPhone: "+91 99791 31767", supportWhatsappEnabled: true, supportWhatsappNumber: "+91 99791 31767",
  addressLine1: "", addressLine2: "", city: "Dhanera", state: "Gujarat", postalCode: "385310", countryCode: "IN",
  freeShippingThreshold: 2499, standardShippingFee: 149, deliveryEstimate: "3–7 business days", returnsWindowDays: 7,
  announcementEnabled: false, announcementText: "", heroTitle: "Move your way.", heroSubtitle: "", heroImageUrl: "", heroButtonLabel: "Shop now", heroButtonUrl: "/shop",
  primaryColor: "#ef6b4f", secondaryColor: "#17272a", colorMode: "light", instagramUrl: "", facebookUrl: "", youtubeUrl: "", mapsUrl: "", storeHours: "",
  seoTitle: "Rider Shoes", seoDescription: "Rider Shoes online store.", onlineOrdersEnabled: true, codEnabled: true, codMin: 0, codMax: 100000, codFee: 0,
  storeVisitEnabled: true, storeVisitDiscount: 0, storeVisitDiscountType: "percent", storeVisitValidityDays: 7,
  storeVisitTerms: "Present your valid visit reference at checkout in store.", whatsappAutomationEnabled: false,
};
