/** The one rule for what the media library takes (doc 09): the browser asks it before sending a file, the server again with the file's own bytes. */

/** The largest file the library takes. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** The longest side of an image's web size (doc 09). */
export const WEB_LONGEST_SIDE = 2400;

export type MediaKind = "image" | "file";

/** What a file is, by its bytes and name. */
type Identified = { mime: string; kind: MediaKind; extension: string };

export type Acceptance =
	| ({ ok: true } & Identified)
	/** Not a kind the library takes. */
	| { ok: false; reason: "type" }
	/** A photo in HEIC, what an iPhone takes: a picture all the same, so it needs its own reason. */
	| { ok: false; reason: "heic" }
	/** A kind it takes, over the limit. The kind says whether shrinking can help. */
	| ({ ok: false; reason: "size" } & Identified);

/** What a file chooser offers. It is a hint: what the library takes is `acceptFile`'s to say, and a file it refuses stays on the page with the reason (flow 6·04). */
export const FILE_CHOOSER_ACCEPT = "image/*,.pdf,.zip,.txt,.md,.csv";

/** How much of a file the check needs from its start. */
export const HEAD_BYTES = 4096;

const IMAGE_EXTENSIONS: Record<string, readonly string[]> = {
	"image/jpeg": [".jpg", ".jpeg"],
	"image/png": [".png"],
	"image/webp": [".webp"],
	"image/gif": [".gif"],
	"image/avif": [".avif"],
};
const TEXT_MIMES: Record<string, string> = { ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv" };

const starts = (head: Uint8Array, bytes: readonly number[], at = 0) =>
	bytes.every((byte, index) => head[at + index] === byte);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const asciiAt = (head: Uint8Array, at: number, length: number) =>
	String.fromCharCode(...head.subarray(at, at + length));

/** An ISO media file's brands, from its `ftyp` box: AVIF and the HEIC the library does not take look alike but for these. */
function brandsOf(head: Uint8Array): string[] {
	if (!starts(head, ascii("ftyp"), 4)) return [];
	const size = ((head[0] ?? 0) << 24) | ((head[1] ?? 0) << 16) | ((head[2] ?? 0) << 8) | (head[3] ?? 0);
	const end = Math.min(size, head.length);
	const brands = [asciiAt(head, 8, 4)];
	for (let at = 16; at + 4 <= end; at += 4) brands.push(asciiAt(head, at, 4));
	return brands;
}

const isAvif = (head: Uint8Array) => brandsOf(head).some((brand) => brand === "avif" || brand === "avis");

const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"]);

/** A refused file that is a HEIC photo, by its bytes or by its name. */
const isHeic = (name: string, head: Uint8Array) =>
	[".heic", ".heif"].includes(splitName(name).extension) || brandsOf(head).some((brand) => HEIC_BRANDS.has(brand));

function imageMime(head: Uint8Array): string | null {
	if (starts(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
	if (starts(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
	if (starts(head, ascii("GIF87a")) || starts(head, ascii("GIF89a"))) return "image/gif";
	if (starts(head, ascii("RIFF")) && starts(head, ascii("WEBP"), 8)) return "image/webp";
	if (isAvif(head)) return "image/avif";
	return null;
}

/** Text the library can show as text: it decodes as UTF-8 and has no NUL. The end of `head` may cut a character in two, which is not an error. */
function isText(head: Uint8Array): boolean {
	if (head.includes(0)) return false;
	try {
		new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true });
		return true;
	} catch {
		return false;
	}
}

/** `"a.b.JPG"` is `"a.b"` and `".jpg"`; a name with no extension has `""`. */
export function splitName(name: string): { stem: string; extension: string } {
	const dot = name.lastIndexOf(".");
	if (dot <= 0) return { stem: name, extension: "" };
	return { stem: name.slice(0, dot), extension: name.slice(dot).toLowerCase() };
}

function identify(name: string, head: Uint8Array): Identified | null {
	const { extension } = splitName(name);
	const image = imageMime(head);
	if (image) {
		const allowed = IMAGE_EXTENSIONS[image] ?? [];
		// A pasted picture may have no extension. Any other name must not say it is something else.
		if (extension !== "" && !allowed.includes(extension)) return null;
		return { mime: image, kind: "image", extension: extension || (allowed[0] ?? "") };
	}
	if (starts(head, ascii("%PDF-")))
		return extension === ".pdf" ? { mime: "application/pdf", kind: "file", extension } : null;
	if (starts(head, [0x50, 0x4b, 0x03, 0x04]) || starts(head, [0x50, 0x4b, 0x05, 0x06]))
		return extension === ".zip" ? { mime: "application/zip", kind: "file", extension } : null;
	const text = TEXT_MIMES[extension];
	return text && isText(head) ? { mime: text, kind: "file", extension } : null;
}

/** Whether the library takes a file: by its first bytes and its name, then its size. `head` is the file's start, at least `HEAD_BYTES` when it has them. */
export function acceptFile(file: { name: string; size: number; head: Uint8Array }): Acceptance {
	const found = identify(file.name, file.head);
	if (!found) return { ok: false, reason: isHeic(file.name, file.head) ? "heic" : "type" };
	return file.size > MAX_UPLOAD_BYTES ? { ok: false, reason: "size", ...found } : { ok: true, ...found };
}

/** A storage key the server made: an id and an extension, nothing that can walk out of a folder. */
export const isMediaKey = (key: string) => /^[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/.test(key);
