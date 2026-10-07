import { defineSite } from "@monti-cms/core";
import { aiPlugin } from "../../ai/src";
import base from "../../core/test/other-site.config";
import { seo } from "../src";

/** The core package's other-site config (SEO field names `metaTitle`…, `Search` tab) plus the SEO and AI plugins. */
export default defineSite({
	...base,
	plugins: [seo(), aiPlugin({ siteDescription: "Example site" })],
});
