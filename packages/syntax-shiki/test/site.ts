import { siteUnderTest } from "../../core/test/site-under-test";
import blog from "./cms.config";
import shiki from "./shiki.config";

/** The core package's reference blog config (`cms.config.ts`), or the blog config with the Shiki notation extension and a `focus` line effect switched on (`shiki.config.ts`). */
export const { testConfig, testSite } = siteUnderTest({ blog, configured: shiki });
