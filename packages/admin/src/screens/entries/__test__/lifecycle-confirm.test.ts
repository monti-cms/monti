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

describe("상태 전환 확인 문구", () => {
	it("공개본에서 쓰는 곳만 세어 알린다", () => {
		const confirm = lifecycleConfirm("archive", null, [
			{ state: "published" },
			{ state: "published" },
			{ state: "draft" },
		] as never);
		expect(confirm.description).toBe(
			`${t("lifecycle.archive.ask", { translation: 0 })}${t("lifecycle.usage", { count: 2 })}`,
		);
	});

	it("원문을 휴지통으로 보내면 휴지통에 없는 번역본 언어를 알린다", () => {
		const confirm = lifecycleConfirm("trash", source, []);
		expect(confirm).toEqual({
			title: t("lifecycle.trash"),
			description: `${t("lifecycle.trash.ask", { translation: 0 })}${t("lifecycle.trash.group", { locales: "EN" })}`,
			confirmLabel: t("lifecycle.trash"),
			destructive: true,
		});
	});

	it("원문을 보관하면 번역본도 보관한다고 알린다", () => {
		expect(lifecycleConfirm("archive", source, []).description).toBe(
			`${t("lifecycle.archive.ask", { translation: 0 })}${t("lifecycle.archive.group")}`,
		);
	});

	it("번역본을 옮길 때는 묶음 안내가 없다", () => {
		expect(lifecycleConfirm("trash", translation, []).description).toBe(t("lifecycle.trash.ask", { translation: 1 }));
	});

	it("묻지 않는 전환도 끝나면 알릴 문구가 있다", () => {
		expect(LIFECYCLE_SUCCESS.unarchive).toBe(t("lifecycle.success.unarchive"));
		expect(LIFECYCLE_SUCCESS.restore).toBe(t("lifecycle.success.restore"));
	});
});
