export const TECHNOLOGIES = [
  { key: "wordpress", name: "WordPress", category: "CMS" },
  { key: "elementor", name: "Elementor Pro", category: "Page Builder" },
  { key: "shopify", name: "Shopify", category: "Ecommerce" },
  { key: "ga4", name: "GA4", category: "Analytics" },
  { key: "gtm", name: "Google Tag Manager", category: "Analytics" },
  { key: "gsc", name: "Google Search Console", category: "SEO" },
  { key: "clarity", name: "Microsoft Clarity", category: "Analytics" },
  { key: "klaviyo", name: "Klaviyo", category: "Email" },
  { key: "printify", name: "Printify (Print-on-Demand)", category: "Fulfillment" },
  { key: "ghl", name: "GoHighLevel", category: "CRM" },
  { key: "meta_ads", name: "Meta Ads", category: "Advertising" },
] as const;

export type TechnologyKey = (typeof TECHNOLOGIES)[number]["key"];
