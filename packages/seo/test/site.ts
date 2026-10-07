import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import blog from "./cms.config";
import otherSite from "./other-site.config";

/**
 * The site the config-agnostic suites run against: the core package's blog config plus the SEO and AI plugins (`cms.config.ts`) by default, the other-site
 * config (`other-site.config.ts`) when `MONTI_TEST_SITE=other-site` (`vitest.othersite.config.ts`). A test that asserts the blog config as is imports `./cms.config` itself (`blog-seo.test.ts`).
 */
export const testConfig: AnyCmsConfig = process.env.MONTI_TEST_SITE === "other-site" ? otherSite : blog;

export const testSite = createSite(testConfig);
