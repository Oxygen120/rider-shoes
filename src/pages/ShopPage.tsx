import { useMemo, useState } from "react";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../app/AppContext";
import { ProductCard, Reveal } from "../components/Ui";
import { Breadcrumbs } from "../components/SiteLayout";

export function ShopPage() {
  const { products, categories, settings } = useApp();
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(slug ?? "");
  const [maxPrice, setMaxPrice] = useState("5000");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "featured");
  const [mobileFilters, setMobileFilters] = useState(false);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const search = `${product.name} ${product.brand?.name ?? ""} ${product.tags.join(" ")}`.toLowerCase();
      const selectedCategory = categories.find((item) => item.slug === category);
      return search.includes(query.trim().toLowerCase()) && (!selectedCategory || product.categoryIds.includes(selectedCategory.id)) && product.price <= Number(maxPrice);
    });
    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      if (sort === "new") return Number(b.isNew) - Number(a.isNew);
      return Number(b.featured) - Number(a.featured);
    });
  }, [category, categories, maxPrice, products, query, sort]);

  const selectedCategory = categories.find((item) => item.slug === category);
  return (
    <>
      <div className="page-hero"><div className="container-wide"><div className="eyebrow">The Rider edit</div><h1 className="display-title">{selectedCategory?.name ?? "All shoes"}</h1><p>{selectedCategory?.description ?? "Comfort-led footwear for commutes, workouts, weekends, and everything between."}</p></div></div>
      <Breadcrumbs current={selectedCategory?.name ?? "Shop"} />
      <section className="section"><div className="container-wide">
        <div className="filter-bar"><button className="button button-outline button-small" onClick={() => setMobileFilters((value) => !value)}><SlidersHorizontal size={14} /> Filters</button><div style={{ position: "relative", flex: "1 1 240px" }}><Search size={14} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} /><input style={{ width: "100%", paddingLeft: 33 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by product, collection or mood" aria-label="Search products" /></div><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Sort: featured</option><option value="new">Sort: new in</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div>
        <div className={mobileFilters ? "filter-drawer open" : "filter-drawer"} style={{ display: mobileFilters ? "flex" : undefined, flexWrap: "wrap", gap: 8, marginBottom: 22 }}><span className="eyebrow" style={{ marginRight: 5 }}>Category</span><button className={`filter-chip ${category === "" ? "active" : ""}`} onClick={() => setCategory("")}>All</button>{categories.map((item) => <button key={item.id} className={`filter-chip ${category === item.slug ? "active" : ""}`} onClick={() => setCategory(item.slug)}>{item.name}</button>)}<label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto", color: "var(--muted)", fontSize: ".72rem" }}>Up to ₹{Number(maxPrice).toLocaleString("en-IN")}<input type="range" min="1500" max="6000" step="100" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} aria-label="Maximum price" /></label>{(query || category || maxPrice !== "5000") && <button className="text-button" onClick={() => { setQuery(""); setCategory(""); setMaxPrice("5000"); }}><X size={13} style={{ verticalAlign: "middle" }} /> Clear</button>}<Filter size={15} color="var(--muted)" /></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, color: "var(--muted)", fontSize: ".72rem" }}><span>{visibleProducts.length} {visibleProducts.length === 1 ? "pair" : "pairs"}</span><span>Free delivery over ₹{settings.freeShippingThreshold.toLocaleString("en-IN")}</span></div>
        {visibleProducts.length > 0 ? <div className="product-grid">{visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div> : <Reveal><div className="empty-state" style={{ border: "1px solid var(--line)", borderRadius: 22, background: "#fff" }}><Search size={30} /><h2>No pairs found</h2><p>Try a broader search or reset your filters to see the full Rider collection.</p><button className="button button-primary" onClick={() => { setQuery(""); setCategory(""); setMaxPrice("5000"); }}>Reset filters</button></div></Reveal>}
      </div></section>
    </>
  );
}
