import blog from "./cms.config";
import otherSite from "./other-site.config";
import { siteUnderTest } from "./site-under-test";

/** The reference blog (`cms.config.ts`), or the other-site config (`other-site.config.ts`); collection, field and block names are looked up through `any-site.ts`. A test that asserts the blog config as is is named `*.blog.test.ts`. */
export const { testConfig, testSite } = siteUnderTest({ blog, "other-site": otherSite });
