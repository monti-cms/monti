import { defineConfig, postgres } from "@monti-cms/core/server";
import { mdx } from "@monti-cms/mdx";
import schema from "./schema";

export const cms = defineConfig({ schema, plugins: [mdx()], database: postgres() });
export type BlogCms = typeof cms;
