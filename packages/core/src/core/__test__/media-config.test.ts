import { describe, expect, it } from "vitest";
import { defineCollection, defineSite, fields } from "../..";
import { createSite } from "../../site";
import { checkMediaConfig } from "../media-types";

const site = createSite(
	defineSite({
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
	it("MEDIA-U2 reads limits and formats from the site config", () => {
		expect(api.MAX_MEDIA_BYTES).toBe(2048);
		expect(api.MAX_MEDIA_PIXELS).toBe(100);
		expect(api.MAX_FILE_BYTES).toBe(4096);
		expect(api.ALLOWED_IMAGE_MIME_TYPES).toEqual(["image/png"]);
		expect(api.ALLOWED_FILE_MIME_TYPES).toEqual(["application/pdf"]);
		expect(api.FILE_ACCEPT).toBe(".pdf");
		expect(api.fileTypeFor("a.pdf")).toBe("application/pdf");
		expect(api.fileTypeFor("a.zip")).toBeNull();
	});

	it("MEDIA-U2 rejects formats excluded in the config in upload requests", () => {
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

	it("MEDIA-U2 an invalid config is reported with the path of each value", () => {
		const codes = (media: Parameters<typeof checkMediaConfig>[0]) =>
			checkMediaConfig(media).map((issue) => `${issue.path}:${issue.code}`);
		expect(checkMediaConfig(undefined)).toEqual([]);
		expect(codes({ maxImageBytes: 0 })).toEqual(["media.maxImageBytes:positive-integer"]);
		expect(codes({ maxPixels: 1.5 })).toEqual(["media.maxPixels:positive-integer"]);
		expect(codes({ imageTypes: ["image/svg+xml" as "image/png"] })).toEqual(["media.imageTypes[0]:unsupported"]);
		expect(codes({ fileTypes: ["text/html" as "text/plain"] })).toEqual(["media.fileTypes[0]:unsupported"]);
		expect(codes({ imageTypes: [] })).toEqual(["media.imageTypes:empty"]);
		expect(codes({ fileTypes: [] })).toEqual([]);
		expect(codes({ maxImage: 5 } as never)).toEqual(["media.maxImage:unknown-key"]);
	});
});
