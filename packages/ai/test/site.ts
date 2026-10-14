import { siteUnderTest } from "../../core/test/site-under-test";
import blog from "./cms.config";
import otherSite from "./other-site.config";

/** The blog config plus the AI plugin (`cms.config.ts`), or the other-site config (`other-site.config.ts`). A test that asserts the blog config as is imports `./cms.config` itself. */
export const { testConfig, testSite } = siteUnderTest({ blog, "other-site": otherSite });
