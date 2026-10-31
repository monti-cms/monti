import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { entryEditorShellMessages } from "../entry-editor-shell.messages";
import { primaryLifecycleAction } from "../header-action";

const t = testSite.createTranslator(entryEditorShellMessages);
const tc = testSite.createTranslator(commonMessages);

const idle = { hasPublishDate: false, unpublished: false, busy: null, publishing: false, submitting: false } as const;

describe("primaryLifecycleAction", () => {
	it.each([
		{
			case: "a trashed entry is restored",
			given: { status: "trashed", hasPublishDate: true },
			want: { action: "restore", label: tc("lifecycle.restore"), disabled: false },
		},
		{
			case: "a trashed entry while its status changes",
			given: { status: "trashed", busy: "status", submitting: true },
			want: { action: "restore", label: t("restoring"), disabled: true },
		},
		{
			case: "an archived entry is unarchived",
			given: { status: "archived", hasPublishDate: true },
			want: { action: "unarchive", label: tc("lifecycle.unarchive"), disabled: false },
		},
		{
			case: "an archived entry while its status changes",
			given: { status: "archived", busy: "status", submitting: true },
			want: { action: "unarchive", label: t("unarchiving"), disabled: true },
		},
		{
			case: "a new entry is published",
			given: { status: undefined },
			want: { action: "publish", label: t("publish"), disabled: false },
		},
		{
			case: "a draft while it is published",
			given: { status: "draft", busy: "publish", publishing: true, submitting: true },
			want: { action: "publish", label: t("publishing"), disabled: true },
		},
		{
			case: "a published entry with nothing changed reads published, dimmed",
			given: { status: "published", hasPublishDate: true },
			want: { action: "split", label: t("publishedState"), disabled: true },
		},
		{
			case: "a published entry with changes",
			given: { status: "published", hasPublishDate: true, unpublished: true },
			want: { action: "split", label: t("publish"), disabled: false },
		},
		{
			case: "an entry published before and now a draft again",
			given: { status: "draft", hasPublishDate: true },
			want: { action: "split", label: t("publish"), disabled: false },
		},
		{
			case: "a published entry while it is published again",
			given: { status: "published", hasPublishDate: true, publishing: true, submitting: true },
			want: { action: "split", label: t("publishing"), disabled: true },
		},
		{
			case: "a published entry with changes while something else runs",
			given: { status: "published", hasPublishDate: true, unpublished: true, submitting: true },
			want: { action: "split", label: t("publish"), disabled: true },
		},
	] as const)("WRITE-W4 $case", ({ given, want }) => {
		expect(primaryLifecycleAction(testSite, { ...idle, ...given })).toEqual(want);
	});
});
