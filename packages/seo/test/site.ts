import { siteUnderTest } from "../../core/test/site-under-test";
import blog from "./cms.config";
import otherSite from "./other-site.config";

/** The core package's blog config plus the SEO and AI plugins (`cms.config.ts`), or the other-site config (`other-site.config.ts`). A test that asserts the blog config as is imports `./cms.config` itself (`blog-seo.test.ts`). */
export const { testConfig, testSite } = siteUnderTest({ blog, "other-site": otherSite });
