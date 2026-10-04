import { CmsEditor } from "@monti-cms/admin/editor";
import { createTranslator, defineTextChecker, type TextChecker, type TextCheckSegment } from "@monti-cms/core/client";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import type { PluginKey } from "@tiptap/pm/state";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider, useEditorExtensions } from "../../../admin-components";
import { pressOption } from "../../../test/base-ui";
import { editorMessages } from "../../messages";
import { textCheckMessages } from "../messages";
import { type TextCheckPluginState, textCheckIssues } from "../plugin";
import { AUTO_CHECK_DELAY } from "../use-text-check";

const t = createTranslator(textCheckMessages);
const tEditor = createTranslator(editorMessages);

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

// jsdom has no coordinates for text ranges.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.clearAllMocks();
});

/** Fake checker that finds `틀린말` and suggests `맞는 말`. */
const fakeChecker = (options: Partial<Pick<TextChecker, "auto" | "locales">> = {}) =>
	defineTextChecker({
		id: "fake",
		label: "가짜 검사",
		...options,
		check: vi.fn(async (segments: readonly TextCheckSegment[]) =>
			segments.flatMap((segment) => {
				const start = segment.text.indexOf("틀린말");
				return start < 0
					? []
					: [
							{
								segmentId: segment.id,
								start,
								end: start + 3,
								message: "맞춤법이 틀렸습니다.",
								suggestions: ["맞는 말"],
								severity: "error" as const,
							},
						];
			}),
		),
	});

/** Renders the buttons and popups of admin extensions (`editorExtensions`) next to the editor, like the edit screen. */
function Harness({
	content,
	locale,
	onChange,
	onReady,
}: {
	content: string;
	locale: string;
	onChange: (mdx: string) => void;
	onReady: (editor: Editor | null) => void;
}) {
	const extensions = useEditorExtensions({
		translateLocales: null,
		getEntry: () => ({ title: "", collection: "post", locale }),
	});
	return (
		<>
			<div role="toolbar" aria-label="확장 도구">
				{extensions.toolbar}
			</div>
			<CmsEditor
				content={content}
				onChange={onChange}
				onEditor={(ready) => {
					extensions.onEditor(ready);
					onReady(ready);
				}}
			/>
			{extensions.overlay}
		</>
	);
}

const renderEditor = async (content: string, checkers: readonly TextChecker[], locale = "ko") => {
	let editor: Editor | null = null;
	const onChange = vi.fn();
	render(
		<CmsAdminComponentsProvider components={{ textCheckers: checkers }}>
			<Harness
				content={content}
				locale={locale}
				onChange={onChange}
				onReady={(ready) => {
					editor = ready;
				}}
			/>
		</CmsAdminComponentsProvider>,
	);
	await screen.findByRole("toolbar", { name: tEditor("toolbar.format") });
	await waitFor(() => expect(editor).not.toBeNull());
	return { editor: editor as unknown as Editor, onChange };
};

/** Key name of the underline plugin the check extension adds to the editor (one per extension). */
const pluginKeyOf = (editor: Editor) =>
	editor.state.plugins.find((plugin) => (plugin as unknown as { key: string }).key.startsWith("cmsTextCheck"))?.spec
		.key as PluginKey<TextCheckPluginState> | undefined;

const issuesOf = (editor: Editor) => {
	const key = pluginKeyOf(editor);
	return key ? textCheckIssues(editor.state, key) : [];
};

/** Checker button. Its name is the checker's `label`. */
const checkButton = (name = "가짜 검사") =>
	within(screen.getByRole("toolbar", { name: "확장 도구" })).queryByRole("button", { name });

/** Opens the result popup as if an underline was clicked (jsdom cannot locate a position from coordinates). */
const clickIssue = (editor: Editor) => {
	const [issue] = issuesOf(editor);
	if (!issue) throw new Error("no issue");
	const plugin = pluginKeyOf(editor)?.get(editor.state);
	const target = editor.view.dom.querySelector(`[data-text-issue="${issue.key}"]`);
	act(() => {
		plugin?.props.handleClick?.call(plugin, editor.view, issue.from + 1, {
			button: 0,
			target,
		} as unknown as MouseEvent);
	});
	return issue;
};

describe("spellcheck button", () => {
	it("adds one button per checker when several extensions provide checkers", async () => {
		const other = defineTextChecker({ ...fakeChecker(), id: "other", label: "다른 검사" });
		render(
			<CmsAdminComponentsProvider components={{ textCheckers: [fakeChecker()] }}>
				<CmsAdminComponentsProvider components={{ textCheckers: [other] }}>
					<Harness content={"틀린말\n"} locale="ko" onChange={vi.fn()} onReady={() => {}} />
				</CmsAdminComponentsProvider>
			</CmsAdminComponentsProvider>,
		);
		await screen.findByRole("toolbar", { name: tEditor("toolbar.format") });
		await waitFor(() => expect(checkButton()).not.toBeNull());
		expect(checkButton("다른 검사")).not.toBeNull();
	});

	it("shows no button when no checker is registered", async () => {
		await renderEditor("틀린말\n", []);
		expect(checkButton()).toBeNull();
	});

	it("shows no button when no checker covers the document language", async () => {
		await renderEditor("틀린말\n", [fakeChecker({ locales: ["en"] })], "ko");
		expect(checkButton()).toBeNull();
	});

	it("checks the whole document on click and shows underlines and the result count", async () => {
		const checker = fakeChecker();
		const { editor } = await renderEditor("첫 문단은 틀린말 입니다\n\n둘째 문단\n", [checker]);
		expect(screen.queryByRole("button", { name: t("results") })).toBeNull();

		fireEvent.click(checkButton() as HTMLElement);

		await waitFor(() => expect(issuesOf(editor)).toHaveLength(1));
		expect(checker.check).toHaveBeenCalledTimes(1);
		const [sent] = (checker.check as ReturnType<typeof vi.fn>).mock.calls[0] as [TextCheckSegment[]];
		expect(sent.map((segment) => segment.text)).toEqual(["첫 문단은 틀린말 입니다", "둘째 문단"]);
		expect(sent.every((segment) => segment.locale === "ko")).toBe(true);
		expect(editor.view.dom.querySelector(".cms-text-issue")?.textContent).toBe("틀린말");
		expect(screen.getByRole("button", { name: t("results") }).textContent).toBe("1");
	});

	it("checks only the selected paragraph when text is selected", async () => {
		const checker = fakeChecker();
		const { editor } = await renderEditor("첫 틀린말\n\n둘째 틀린말\n", [checker]);
		const second = editor.state.doc.child(1);
		const start = editor.state.doc.child(0).nodeSize + 1;
		act(() => {
			editor.commands.setTextSelection({ from: start, to: start + second.content.size });
		});

		fireEvent.click(checkButton() as HTMLElement);

		await waitFor(() => expect(issuesOf(editor)).toHaveLength(1));
		const [sent] = (checker.check as ReturnType<typeof vi.fn>).mock.calls[0] as [TextCheckSegment[]];
		expect(sent.map((segment) => segment.text)).toEqual(["둘째 틀린말"]);
		const [issue] = issuesOf(editor);
		expect(issue?.from).toBeGreaterThan(start);
	});

	it("replaces the text when a suggestion is chosen in the result popup", async () => {
		const { editor, onChange } = await renderEditor("이것은 틀린말 입니다\n", [fakeChecker()]);
		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() => expect(issuesOf(editor)).toHaveLength(1));

		clickIssue(editor);
		const dialog = await screen.findByRole("dialog", { name: t("results") });
		expect(within(dialog).getByText("맞춤법이 틀렸습니다.")).toBeTruthy();
		expect(within(dialog).getByText("가짜 검사")).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "맞는 말" }));

		await waitFor(() => expect(String(onChange.mock.lastCall?.[0])).toContain("이것은 맞는 말 입니다"));
		expect(issuesOf(editor)).toHaveLength(0);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: t("results") })).toBeNull());
	});

	it("hides ignored results and keeps them hidden after rechecking", async () => {
		const checker = fakeChecker();
		const { editor } = await renderEditor("이것은 틀린말 입니다\n\n또 틀린말\n", [checker]);
		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() => expect(issuesOf(editor)).toHaveLength(2));

		clickIssue(editor);
		fireEvent.click(
			within(await screen.findByRole("dialog", { name: t("results") })).getByRole("button", { name: t("ignore") }),
		);
		// Hide every result with the same checker, rule, and text.
		expect(issuesOf(editor)).toHaveLength(0);

		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(t("nothingToFix")));
		expect(issuesOf(editor)).toHaveLength(0);
		// The same text is not sent again.
		expect(checker.check).toHaveBeenCalledTimes(1);
	});

	it("selects the spot and opens the result popup when chosen from the result list", async () => {
		const { editor } = await renderEditor("앞 문단\n\n이것은 틀린말 입니다\n", [fakeChecker()]);
		fireEvent.click(checkButton() as HTMLElement);
		await waitFor(() => expect(issuesOf(editor)).toHaveLength(1));

		fireEvent.click(screen.getByRole("button", { name: t("results") }));
		pressOption(await screen.findByRole("menuitem", { name: /틀린말/ }));

		const [issue] = issuesOf(editor);
		await waitFor(() => expect(editor.state.selection.from).toBe(issue?.from));
		expect(editor.state.selection.to).toBe(issue?.to);
		expect(await screen.findByRole("dialog", { name: t("results") })).toBeTruthy();
	});

	it("shows a notification when the checker fails", async () => {
		const failing = defineTextChecker({
			id: "broken",
			label: "고장",
			check: async () => {
				throw new Error("HTTP 500");
			},
		});
		await renderEditor("틀린말\n", [failing]);
		fireEvent.click(checkButton("고장") as HTMLElement);
		await waitFor(() =>
			expect(toastMock.error).toHaveBeenCalledWith(t("failed", { label: "고장" }), { description: "HTTP 500" }),
		);
		expect(checkButton("고장")?.hasAttribute("disabled")).toBe(false);
	});

	it("renames the button and disables it while checking", async () => {
		let finish: (() => void) | undefined;
		const slow = defineTextChecker({
			id: "slow",
			label: "느림",
			check: () =>
				new Promise((resolve) => {
					finish = () => resolve([]);
				}),
		});
		await renderEditor("문단\n", [slow]);
		fireEvent.click(checkButton("느림") as HTMLElement);
		const busy = await screen.findByRole("button", { name: t("running") });
		expect(busy.hasAttribute("disabled")).toBe(true);
		await act(async () => finish?.());
		await waitFor(() => expect(checkButton("느림")).not.toBeNull());
	});
});

describe("automatic checking", () => {
	const typeInto = (editor: Editor, text: string) =>
		act(() => {
			editor
				.chain()
				.setTextSelection(editor.state.doc.content.size - 1)
				.insertContent(text)
				.run();
		});

	it("is off by default and does not check on input", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const checker = fakeChecker();
		const { editor } = await renderEditor("문단\n", [checker]);
		typeInto(editor, " 틀린말");
		await act(async () => {
			vi.advanceTimersByTime(AUTO_CHECK_DELAY * 2);
		});
		expect(checker.check).not.toHaveBeenCalled();
	});

	it("with `auto: true`, checks only the changed paragraph after typing stops", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const checker = fakeChecker({ auto: true });
		const { editor } = await renderEditor("그대로 둘 문단\n\n고칠 문단\n", [checker]);
		typeInto(editor, " 틀린말");
		expect(checker.check).not.toHaveBeenCalled();
		await act(async () => {
			vi.advanceTimersByTime(AUTO_CHECK_DELAY + 10);
		});
		await waitFor(() => expect(issuesOf(editor)).toHaveLength(1));
		expect(checker.check).toHaveBeenCalledTimes(1);
		const [sent] = (checker.check as ReturnType<typeof vi.fn>).mock.calls[0] as [TextCheckSegment[]];
		expect(sent.map((segment) => segment.text)).toEqual(["고칠 문단 틀린말"]);
	});
});
