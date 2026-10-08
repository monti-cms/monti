import { definePlugin } from "@monti-cms/core";

/** `plugins: [markdown()]` adds the formats `markdown` (both ways) and `text` (export only) to the read and write APIs. */
export const markdown = () => definePlugin({ name: "markdown", options: {}, formats: () => import("./formats") });
