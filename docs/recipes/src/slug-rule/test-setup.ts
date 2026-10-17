import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { afterAll, beforeAll } from "vitest";
import schema from "../site/schema";
import { slugRule } from "./hooks";

const test = testServer();
export const cms = defineConfig({ schema, hooks: slugRule, ...test.server });
beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});
