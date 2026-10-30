import { formatFileSize } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import {
	acceptedKinds,
	checkUpload,
	enqueue,
	extensionOf,
	nextToUpload,
	patchEntry,
	removeEntry,
	replaceProblem,
	type UploadEntry,
	uploadTileView,
} from "../media-upload";
import { mediaMessages } from "../messages";

const t = testSite.createTranslator(mediaMessages);

const file = (name: string, type: string, size = 10) => {
	const made = new File(["x"], name, { type });
	Object.defineProperty(made, "size", { value: size });
	return made;
};

describe("checking a file before it is sent", () => {
	it("lets pictures and accepted files through", () => {
		expect(checkUpload(testSite, file("a.png", "image/png"))).toBeNull();
		expect(checkUpload(testSite, file("a.pdf", "application/pdf"))).toBeNull();
	});

	it("refuses a type the site does not take, with nothing to fix", () => {
		expect(checkUpload(testSite, file("IMG_2041.HEIC", "image/heic"))).toEqual({ kind: "type" });
		expect(checkUpload(testSite, file("setup.exe", "application/x-msdownload"))).toEqual({ kind: "type" });
	});

	it("says a picture over the limit can be shrunk and another file cannot", () => {
		const big = testSite.api.MAX_MEDIA_BYTES + 1;
		expect(checkUpload(testSite, file("panorama.jpg", "image/jpeg", big))).toEqual({
			kind: "size",
			bytes: big,
			limit: testSite.api.MAX_MEDIA_BYTES,
			shrinkable: true,
		});
		const bigFile = testSite.api.MAX_FILE_BYTES + 1;
		expect(checkUpload(testSite, file("a.pdf", "application/pdf", bigFile))).toMatchObject({
			kind: "size",
			shrinkable: false,
		});
	});

	it("names the kinds the site takes, images first", () => {
		const kinds = acceptedKinds(testSite);
		expect(kinds[0]).toBe("image");
		expect(kinds).toContain("pdf");
	});
});

describe("the queue", () => {
	it("starts with files waiting and the ones with a known problem already failed, and sends one at a time in order", () => {
		const queue = enqueue(
			testSite,
			[file("a.png", "image/png"), file("setup.exe", "application/x-msdownload"), file("b.png", "image/png")],
			"blog",
		);
		expect(queue.map((entry) => entry.status)).toEqual(["waiting", "failed", "waiting"]);
		expect(queue.every((entry) => entry.folderId === "blog")).toBe(true);
		expect(new Set(queue.map((entry) => entry.id)).size).toBe(3);
		expect(nextToUpload(queue)?.file.name).toBe("a.png");
		const going = patchEntry(queue, queue[0]?.id ?? "", { status: "uploading", percent: 40 });
		expect(nextToUpload(going)).toBeUndefined();
		const done = removeEntry(going, queue[0]?.id ?? "");
		expect(nextToUpload(done)?.file.name).toBe("b.png");
	});
});

describe("extension", () => {
	it("is the last part of the name, lowercase", () => {
		expect(extensionOf("Price.List.PDF")).toBe("pdf");
		expect(extensionOf("README")).toBe("");
	});
});

describe("replacing a file", () => {
	it("lets a picture take a picture's place and a file a file of the same type's", () => {
		expect(replaceProblem(testSite, { mimeType: "image/jpeg" }, file("v2.png", "image/png"))).toBeNull();
		expect(replaceProblem(testSite, { mimeType: "application/pdf" }, file("v2.pdf", "application/pdf"))).toBeNull();
	});

	it("refuses a picture for a file, a file for a picture, and a file of another type", () => {
		expect(replaceProblem(testSite, { mimeType: "image/jpeg" }, file("v2.pdf", "application/pdf"))).toBe("kind");
		expect(replaceProblem(testSite, { mimeType: "application/pdf" }, file("v2.png", "image/png"))).toBe("kind");
		expect(replaceProblem(testSite, { mimeType: "application/pdf" }, file("v2.txt", "text/plain"))).toBe("type");
	});
});

describe("the tile of a file in the queue", () => {
	const png = file("hero.png", "image/png");
	const pdf = file("notes.pdf", "application/pdf");
	const entry = (given: Partial<UploadEntry>): UploadEntry => ({
		id: "upload-1",
		file: png,
		folderId: null,
		status: "failed",
		percent: 0,
		...given,
	});
	const kinds = acceptedKinds(testSite)
		.map((kind) => t(`upload.kind.${kind}` as "upload.kind.image"))
		.join(" · ");

	it.each([
		{
			case: "waiting its turn",
			given: { status: "waiting" },
			want: { status: "uploading", detail: t("upload.waiting"), actions: [], preview: "image" },
		},
		{
			case: "going up",
			given: { status: "uploading", percent: 64, file: pdf },
			want: { status: "uploading", detail: t("upload.progress", { percent: 64 }), actions: [], preview: "file" },
		},
		{
			case: "a picture in a format the site does not take: no preview, only remove",
			given: { file: file("IMG_2041.HEIC", "image/heic"), problem: { kind: "type" } },
			want: { status: "failed", detail: t("upload.unsupported"), actions: ["remove"], preview: "none" },
		},
		{
			case: "another file the site does not take: what it takes",
			given: { file: file("setup.exe", "application/x-msdownload"), problem: { kind: "type" } },
			want: { status: "failed", detail: t("upload.acceptedKinds", { kinds }), actions: ["remove"], preview: "file" },
		},
		{
			case: "a picture over the limit can be shrunk",
			given: { problem: { kind: "size", bytes: 30_000_000, limit: 20_000_000, shrinkable: true } },
			want: {
				status: "interrupted",
				detail: t("upload.tooLarge", { size: formatFileSize(30_000_000), limit: formatFileSize(20_000_000) }),
				actions: ["shrink", "remove"],
				preview: "image",
			},
		},
		{
			case: "another file over the limit can only be taken out",
			given: { file: pdf, problem: { kind: "size", bytes: 3, limit: 2, shrinkable: false } },
			want: { status: "interrupted", actions: ["remove"], preview: "file" },
		},
		{
			case: "an upload that failed says why and can be tried again",
			given: { problem: { kind: "failed", message: "The storage said no" } },
			want: { status: "interrupted", detail: "The storage said no", actions: ["retry", "remove"], preview: "image" },
		},
		{
			case: "an upload that failed for good can only be taken out",
			given: { problem: { kind: "failed", message: "Gone", retry: false } },
			want: { status: "interrupted", detail: "Gone", actions: ["remove"] },
		},
		{
			case: "a failure with no reason",
			given: {},
			want: { status: "interrupted", detail: t("upload.failed"), actions: ["retry", "remove"] },
		},
	] as const)("$case", ({ given, want }) => {
		expect(uploadTileView(testSite, entry(given as Partial<UploadEntry>))).toMatchObject(want);
	});
});
