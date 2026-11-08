import { describe, expect, it } from "vitest";
import { acceptFile, isMediaKey, MAX_UPLOAD_BYTES, splitName } from "./accept";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0);
const WEBP = text("RIFF\0\0\0\0WEBPVP8 ");
const GIF = text("GIF89a");
const PDF = text("%PDF-1.7");
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0);
const ftyp = (major: string, ...compatible: string[]) => {
	const brands = [major, "\0\0\0\0", ...compatible].join("");
	const size = 8 + brands.length;
	return new Uint8Array([0, 0, 0, size, ...text(`ftyp${brands}`)]);
};

const accept = (name: string, head: Uint8Array, size = head.length) => acceptFile({ name, size, head });

describe("what the library takes", () => {
	it.each([
		["desk.png", PNG, "image/png", "image"],
		["desk.JPG", JPEG, "image/jpeg", "image"],
		["desk.jpeg", JPEG, "image/jpeg", "image"],
		["desk.webp", WEBP, "image/webp", "image"],
		["desk.gif", GIF, "image/gif", "image"],
		["desk.avif", ftyp("avif", "mif1"), "image/avif", "image"],
		["desk.avif", ftyp("mif1", "avif"), "image/avif", "image"],
		["price.pdf", PDF, "application/pdf", "file"],
		["bundle.zip", ZIP, "application/zip", "file"],
		["notes.txt", text("안녕하세요"), "text/plain", "file"],
		["notes.md", text("# 제목"), "text/markdown", "file"],
		["prices.csv", text("a,b\n1,2"), "text/csv", "file"],
	])("09-1 takes %s as %s", (name, head, mime, kind) => {
		expect(accept(name, head)).toMatchObject({ ok: true, mime, kind });
	});

	it.each([
		["photo.heic", ftyp("heic", "mif1")],
		["photo.heif", ftyp("mif1", "heic")],
		["photo.avif", ftyp("heic", "mif1")],
		["photo.jpg", ftyp("hevc")],
		["photo.HEIC", text("not what its name says")],
	])("09-1 %s is a photo in a format the library does not take: its own reason, not 'images only'", (name, head) => {
		expect(accept(name, head)).toEqual({ ok: false, reason: "heic" });
	});

	it("09-1 a pasted picture with no extension gets the one its bytes say", () => {
		expect(accept("image", PNG)).toMatchObject({ ok: true, mime: "image/png", extension: ".png" });
	});

	it.each([
		["logo.svg", text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
		["page.html", text("<!doctype html><script>alert(1)</script>")],
		["setup.exe", bytes(0x4d, 0x5a, 0x90, 0)],
		["setup.png", bytes(0x4d, 0x5a, 0x90, 0)],
		["setup.exe", PNG],
		["sheet.docx", ZIP],
		["app.jar", ZIP],
		["notes.pdf", text("not a pdf")],
		["binary.txt", bytes(0x41, 0, 0x42)],
		["latin.txt", bytes(0xff, 0xfe, 0x41)],
		["noextension", text("just words")],
	])("09-1 refuses %s", (name, head) => {
		expect(accept(name, head)).toEqual({ ok: false, reason: "type" });
	});

	it("09-1 a multibyte character cut by the end of the head is still text", () => {
		const cut = text("가나다").subarray(0, 7);
		expect(accept("notes.txt", cut)).toMatchObject({ ok: true });
	});

	it("09-1 10 MB is the last size it takes, and past it the answer keeps the kind so an image can offer shrinking", () => {
		expect(accept("desk.png", PNG, MAX_UPLOAD_BYTES)).toMatchObject({ ok: true });
		expect(accept("desk.png", PNG, MAX_UPLOAD_BYTES + 1)).toMatchObject({ ok: false, reason: "size", kind: "image" });
		expect(accept("price.pdf", PDF, MAX_UPLOAD_BYTES + 1)).toMatchObject({ ok: false, reason: "size", kind: "file" });
	});
});

describe("names and keys", () => {
	it("09-1 a name splits at its last dot", () => {
		expect(splitName("a.b.JPG")).toEqual({ stem: "a.b", extension: ".jpg" });
		expect(splitName("plain")).toEqual({ stem: "plain", extension: "" });
		expect(splitName(".hidden")).toEqual({ stem: ".hidden", extension: "" });
	});

	it("09-1 a key is an id and an extension, nothing that walks out of a folder", () => {
		expect(isMediaKey("3f2a1c9e-1111-4222-8333-444455556666.jpg")).toBe(true);
		expect(isMediaKey("3f2a1c9e-1111-4222-8333-444455556666")).toBe(true);
		expect(isMediaKey("../../etc/passwd")).toBe(false);
		expect(isMediaKey("3f2a1c9e-1111-4222-8333-444455556666/../x")).toBe(false);
		expect(isMediaKey("")).toBe(false);
	});
});
