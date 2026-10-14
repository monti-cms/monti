import { siteUnderTest } from "../../core/test/site-under-test";
import blog from "./cms.config";
import directive from "./directive.config";
import otherSite from "./other-site.config";

/** The core package's reference blog config (`cms.config.ts`), the other-site config (`other-site.config.ts`), or the blog config with the directive extension switched on (`directive.config.ts`). A test that asserts the blog config as is is named `*.blog.test.ts`. */
export const { testConfig, testSite } = siteUnderTest({ blog, "other-site": otherSite, configured: directive });
