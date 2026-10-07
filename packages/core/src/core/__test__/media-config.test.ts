import { describe, expect, it } from "vitest";
import { defineCollection, defineConfig, fields } from "../..";
import { createSite } from "../../site";
import { validateMediaConfig } from "../media-types";

const site = createSite(
	defineConfig({
		collections: {
			page: defineCollection({
				label: "Page",
				kind: "document",
				fields: {
					title: fields.text({ label: "Title", required: true }),
					slug: fields.slug({ label: "Slug", from: "title", required: true }),
				},
			}),
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
		media: {
			maxImageBytes: 2048,
			maxPixels: 100,
			maxFileBytes: 4096,
			imageTypes: ["image/png"],
			fileTypes: ["application/pdf"],
		},
	}),
);
const api = site.api;

describe("media settings", () => {
	it("reads limits and formats from the site config", () => {
		expect(api.MAX_MEDIA_BYTES).toBe(2048);
		expect(api.MAX_MEDIA_PIXELS).toBe(100);
		expect(api.MAX_FILE_BYTES).toBe(4096);
		expect(api.ALLOWED_IMAGE_MIME_TYPES).toEqual(["image/png"]);
		expect(api.ALLOWED_FILE_MIME_TYPES).toEqual(["application/pdf"]);
		expect(api.FILE_ACCEPT).toBe(".pdf");
		expect(api.fileTypeFor("a.pdf")).toBe("application/pdf");
		expect(api.fileTypeFor("a.zip")).toBeNull();
	});

	it("rejects formats excluded in the config in upload requests", () => {
		const { mediaUploadBodySchema } = api;
		const base = { filename: "a", byteSize: 10 };
		expect(mediaUploadBodySchema.safeParse({ ...base, mimeType: "image/png" }).success).toBe(true);
		expect(mediaUploadBodySchema.safeParse({ ...base, mimeType: "image/jpeg" }).success).toBe(false);
		expect(mediaUploadBodySchema.safeParse({ ...base, filename: "a.pdf", mimeType: "application/pdf" }).success).toBe(
			true,
		);
		expect(mediaUploadBodySchema.safeParse({ ...base, filename: "a.zip", mimeType: "application/zip" }).success).toBe(
			false,
		);
	});

	it("an invalid config is an error", () => {
		expect(() => validateMediaConfig(undefined)).not.toThrow();
		expect(() => validateMediaConfig({ maxImageBytes: 0 })).toThrow(/maxImageBytes/);
		expect(() => validateMediaConfig({ maxPixels: 1.5 })).toThrow(/maxPixels/);
		expect(() => validateMediaConfig({ imageTypes: ["image/svg+xml" as "image/png"] })).toThrow(/unsupported/);
		expect(() => validateMediaConfig({ fileTypes: ["text/html" as "text/plain"] })).toThrow(/unsupported/);
		expect(() => validateMediaConfig({ imageTypes: [] })).toThrow(/empty/);
		expect(() => validateMediaConfig({ fileTypes: [] })).not.toThrow();
	});
});
