import { defineConfig } from "@monti-cms/core/server";
import type { TestServer } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { schema } from "../site";

/**
 * In an app this is `monti.config.ts` (`database: postgres()`, `auth: auth(…)`); the recipe takes the server options as a parameter so a test can give it its own
 * database. The type of the instance, `BlogCms`, is what makes `cms.read` typed: it follows the config you pass, with no registration step.
 */
export const createBlogCms = (server: TestServer["server"]) => defineConfig({ schema, plugins: [mdx()], ...server });

export type BlogCms = ReturnType<typeof createBlogCms>;
