import { describe, expect, it } from "vitest";
import { defineCollection, defineSite, fields } from "../..";
import { createSite } from "../../site";
import {
	extensionFor,
	fileTypeByExtension,
	isImageType,
	MEDIA_TYPES,
	SUPPORTED_FILE_MIME_TYPES,
	SUPPORTED_IMAGE_MIME_TYPES,
	sniffFile,
} from "../media-types";

const text = (value: string) => new TextEncoder().encode(value);

const siteWith = (media: Parameters<typeof defineSite>[0]["media"]) =>
	createSite(
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
			media,
		}),
	).api;

describe("the media type table", () => {
	it("MEDIA-U2 splits supported types into images and files, with no type in both", () => {
		expect(SUPPORTED_IMAGE_MIME_TYPES).toContain("image/png");
		expect(SUPPORTED_FILE_MIME_TYPES).toContain("application/pdf");
		const files = new Set<string>(SUPPORTED_FILE_MIME_TYPES);
		expect(SUPPORTED_IMAGE_MIME_TYPES.some((mime) => files.has(mime))).toBe(false);
		expect(SUPPORTED_IMAGE_MIME_TYPES.length + SUPPORTED_FILE_MIME_TYPES.length).toBe(Object.keys(MEDIA_TYPES).length);
	});

	it("MEDIA-U5 gives every type an extension for its file key, and no two types share an extension", () => {
		const seen = new Map<string, string>();
		for (const [mime, entry] of Object.entries(MEDIA_TYPES)) {
			expect(extensionFor(mime as keyof typeof MEDIA_TYPES)).toBe(entry.extensions[0]);
			for (const extension of entry.extensions) {
				expect(seen.get(extension), `extension ${extension}`).toBeUndefined();
				seen.set(extension, mime);
			}
		}
	});

	it("MEDIA-U5 finds an attachment type by file name, case-insensitively, including code files stored as text", () => {
		expect(fileTypeByExtension("Report.PDF")).toBe("application/pdf");
		expect(fileTypeByExtension("notes.markdown")).toBe("text/markdown");
		expect(fileTypeByExtension("main.ts")).toBe("text/plain");
		expect(fileTypeByExtension("photo.png")).toBeNull();
		expect(fileTypeByExtension("pdf")).toBeNull();
		expect(fileTypeByExtension("a.exe")).toBeNull();
	});

	it("MEDIA-U5 checks an attachment's bytes against its declared type", () => {
		expect(sniffFile(text("%PDF-1.7"), "application/pdf")).toBe(true);
		expect(sniffFile(text("not a pdf"), "application/pdf")).toBe(false);
		expect(sniffFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "application/zip")).toBe(true);
		expect(sniffFile(new Uint8Array([0x50, 0x4b, 0x05, 0x06]), "application/zip")).toBe(true);
		expect(sniffFile(text("PK"), "application/zip")).toBe(false);
		for (const mime of ["text/plain", "text/markdown", "text/csv", "application/json"] as const) {
			expect(sniffFile(text("héllo, 한글"), mime)).toBe(true);
			expect(sniffFile(new Uint8Array([0x68, 0x00, 0x69]), mime)).toBe(false);
			expect(sniffFile(new Uint8Array([0xff, 0xfe, 0xfd]), mime)).toBe(false);
		}
		expect(sniffFile(new Uint8Array(), "text/plain")).toBe(true);
	});
});

describe("image fact and upload policy", () => {
	const narrowed = siteWith({ imageTypes: ["image/png"], fileTypes: ["application/pdf"] });

	it("MEDIA-U2 isImageType says what a type is, whatever the site accepts", () => {
		for (const mime of SUPPORTED_IMAGE_MIME_TYPES) expect(isImageType(mime)).toBe(true);
		expect(isImageType("application/pdf")).toBe(false);
		expect(isImageType("image/svg+xml")).toBe(false);
		expect(isImageType("toString")).toBe(false);
		expect(isImageType(null)).toBe(false);
		expect(isImageType(undefined)).toBe(false);
		// The site API exposes the same fact; narrowing the config does not change it.
		expect(narrowed.isImageType("image/jpeg")).toBe(true);
		expect(narrowed.isImageType("application/pdf")).toBe(false);
	});

	it("MEDIA-U2 isAllowedImage follows the site's media.imageTypes", () => {
		expect(narrowed.isAllowedImage("image/png")).toBe(true);
		expect(narrowed.isAllowedImage("image/jpeg")).toBe(false);
		expect(narrowed.isAllowedImage("application/pdf")).toBe(false);
		expect(narrowed.isAllowedImage(undefined)).toBe(false);
		expect(siteWith(undefined).isAllowedImage("image/jpeg")).toBe(true);
	});
});
