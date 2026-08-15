import { discoveryTemplate, qaTemplate, handoffTemplate } from "./cross-cutting";
import { wordpressTemplate } from "./wordpress";
import { elementorTemplate } from "./elementor";
import { shopifyTemplate } from "./shopify";
import { gtmTemplate } from "./gtm";
import { ga4Template } from "./ga4";
import { gscTemplate } from "./gsc";
import { clarityTemplate } from "./clarity";
import { klaviyoTemplate } from "./klaviyo";
import { printifyTemplate } from "./printify";
import { ghlTemplate } from "./ghl";
import { metaAdsTemplate } from "./meta-ads";
import type { TemplateDef } from "./types";

export const ALL_TEMPLATES: TemplateDef[] = [
  discoveryTemplate,
  qaTemplate,
  handoffTemplate,
  wordpressTemplate,
  elementorTemplate,
  shopifyTemplate,
  gtmTemplate,
  ga4Template,
  gscTemplate,
  clarityTemplate,
  klaviyoTemplate,
  printifyTemplate,
  ghlTemplate,
  metaAdsTemplate,
];

export * from "./types";
