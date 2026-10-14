import { siteUnderTest } from "../../core/test/site-under-test";
import blog from "./cms.config";

/** The core package's blog config plus the Bareun checker (`cms.config.ts`). */
export const { testConfig, testSite } = siteUnderTest({ blog });
