import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { afterAll, beforeAll } from "vitest";
import schema from "../site/schema";
import { refuseBadSlug } from "./rules";

const test = testServer();
export const cms = defineConfig({ schema, on: { entry: { beforeSave: [refuseBadSlug] } }, ...test.server });
beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});
