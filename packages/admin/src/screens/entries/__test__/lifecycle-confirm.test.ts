import { describe, expect, it } from "vitest";
import { LIFECYCLE_SUCCESS, lifecycleConfirm } from "../lifecycle-confirm";
import { t } from "../translate";

const source = {
	id: "src",
	translationGroupId: "src",
	translations: [
		{ id: "src", locale: "ko", status: "published", isSource: true },
		{ id: "en-1", locale: "en", status: "draft", isSource: false },
		{ id: "ja-1", locale: "ja", status: "trashed", isSource: false },
	],
} as never;
const translation = { id: "en-1", translationGroupId: "src", translations: [] } as never;

describe("status transition confirmation text", () => {
	it("counts and reports only usages in the published version", () => {
		const confirm = lifecycleConfirm("archive", null, [
			{ state: "published" },
			{ state: "published" },
			{ state: "draft" },
		] as never);
		expect(confirm.description).toBe(
			`${t("lifecycle.archive.ask", { translation: 0 })}${t("lifecycle.usage", { count: 2 })}`,
		);
	});

	it("moving the original to trash reports translation languages not in trash", () => {
		const confirm = lifecycleConfirm("trash", source, []);
		expect(confirm).toEqual({
			title: t("lifecycle.trash"),
			description: `${t("lifecycle.trash.ask", { translation: 0 })}${t("lifecycle.trash.group", { locales: "EN" })}`,
			confirmLabel: t("lifecycle.trash"),
			destructive: true,
		});
	});

	it("archiving the original reports that translations are archived too", () => {
		expect(lifecycleConfirm("archive", source, []).description).toBe(
			`${t("lifecycle.archive.ask", { translation: 0 })}${t("lifecycle.archive.group")}`,
		);
	});

	it("there is no group notice when moving a translation", () => {
		expect(lifecycleConfirm("trash", translation, []).description).toBe(t("lifecycle.trash.ask", { translation: 1 }));
	});

	it("transitions that do not ask also have text to announce when done", () => {
		expect(LIFECYCLE_SUCCESS.unarchive).toBe(t("lifecycle.success.unarchive"));
		expect(LIFECYCLE_SUCCESS.restore).toBe(t("lifecycle.success.restore"));
	});
});
