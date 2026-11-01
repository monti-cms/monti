import { createElement } from "react";
import { expectTypeOf } from "vitest";
import blog from "../../../test/cms.config";
import other from "../../../test/other-site.config";
import type { DocumentComponentsFor, DocumentComponentsOf } from "../../render";
import type { CmsServerConfig } from "../../server/define";
import { type Cms, createCms } from "../create-cms";

/**
 * Compile-time checks that the instance keeps the type of its config. `tsc` reads this file and Vitest never runs it, so a broken type fails the type
 * check instead of a test that passes without running. The name ends in `.test.types.ts`: the build leaves it out like a test, and Vitest does not collect it.
 */

declare const server: CmsServerConfig;
const cmsBlog = createCms({ config: blog, server });
const cmsOther = createCms({ config: other, server });

// An instance of any config is accepted where `Cms` (any config) is expected.
expectTypeOf(cmsBlog).toMatchTypeOf<Cms>();
expectTypeOf(cmsOther).toMatchTypeOf<Cms>();

// Collection names and metadata come from the config.
void cmsBlog.read.listEntries({ collection: "post" });
void cmsOther.read.listEntries({ collection: "article" });
// @ts-expect-error `article` is not a collection of the blog config
void cmsBlog.read.listEntries({ collection: "article" });
// @ts-expect-error `post` is not a collection of the other-site config
void cmsOther.read.listEntries({ collection: "post" });
expectTypeOf(cmsBlog.site.config).toEqualTypeOf<typeof blog>();

// The component table of an instance, or of a config, names that site's blocks.
void ({
	blocks: { notice: ({ level }: { level: "info" | "warn" }) => createElement("aside", { "data-level": level }) },
} satisfies DocumentComponentsOf<typeof cmsBlog>);
void ({
	blocks: { "quote-card": ({ author }: { author?: string }) => createElement("figure", null, author) },
} satisfies DocumentComponentsFor<typeof other>);
void ({
	// @ts-expect-error `quote-card` is not a block of the blog config
	blocks: { "quote-card": () => null },
} satisfies DocumentComponentsOf<typeof cmsBlog>);
