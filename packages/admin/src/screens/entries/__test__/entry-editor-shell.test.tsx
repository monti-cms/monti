import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EntryEditorShell } from "../entry-editor-shell";
import { EMPTY_FORM, formFingerprint, formFromEntry } from "../entry-form";

const {
	getLocalBackup,
	deleteLocalBackup,
	saveLocalBackup,
	success,
	warning,
	message,
	error,
	routerReplace,
	routerPush,
} = vi.hoisted(() => ({
	getLocalBackup: vi.fn(),
	deleteLocalBackup: vi.fn(),
	saveLocalBackup: vi.fn(),
	success: vi.fn(),
	warning: vi.fn(),
	message: vi.fn(),
	error: vi.fn(),
	routerReplace: vi.fn(),
	routerPush: vi.fn(),
}));
vi.mock("../local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../local-backup")>()),
	getLocalBackup,
	deleteLocalBackup,
	saveLocalBackup,
}));
vi.mock("../../../editor/tiptap-editor", () => ({
	CmsEditor: ({
		editable,
		titleField,
		toolbarEnd,
		toolbarAside,
		sourceView,
	}: {
		editable?: boolean;
		titleField?: React.ReactNode;
		toolbarEnd?: React.ReactNode;
		toolbarAside?: React.ReactNode;
		sourceView?: React.ReactNode;
	}) => (
		<>
			<div role="toolbar" aria-label="서식 도구">
				{toolbarEnd}
				{toolbarAside}
			</div>
			{titleField}
			{sourceView ?? <textarea aria-label="시각 본문" readOnly={editable === false} />}
			<div className="ProseMirror" data-testid="mock-editor-body">
				<p>번역 첫 문단</p>
				<p>번역 둘째 문단</p>
			</div>
		</>
	),
}));
vi.mock("sonner", () => ({ Toaster: () => null, toast: { success, warning, message, error } }));
// AI 번역은 따로 테스트한다(ai-translate.test.ts). 편집 화면 테스트에는 AI 기능 목록 요청이 없게 한다.
vi.mock("../ai-translate", () => ({
	useAiTranslate: () => ({ blockAction: null, toolbar: null, setEditor: () => {} }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: routerReplace, push: routerPush }) }));

const ADMIN = "u1";
const entry = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: { metadata: { title: "테스트", categoryId: "cat-1", summary: "요약" }, mdx: "첫째 줄\n둘째 줄" },
};

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
type Handler = (input: string, init?: RequestInit) => unknown;
let fetchMock: ReturnType<typeof vi.fn>;

/** 공통 응답(목록·사용처)에 테스트별 처리를 덧붙인다. */
function serve(handler: Handler, current: unknown = entry) {
	fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
		const handled = await handler(input, init);
		if (handled !== undefined) return handled;
		if (input.startsWith("/api/cms/v1/entries?")) return json({ items: [], total: 0 });
		if (input.endsWith("/relations")) return json({ incomingReferences: [] });
		if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(current);
		throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${input}`);
	});
}

const methodCalls = (method: string, suffix = "") =>
	fetchMock.mock.calls.filter(([input, init]) => init?.method === method && String(input).endsWith(suffix));

const renderEdit = () => render(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />);
const editorTitle = () => screen.findByRole("textbox", { name: "제목" });

beforeEach(() => {
	vi.clearAllMocks();
	getLocalBackup.mockResolvedValue(null);
	deleteLocalBackup.mockResolvedValue(undefined);
	saveLocalBackup.mockResolvedValue(true);
	fetchMock = vi.fn();
	serve(() => undefined);
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("entry editor shell", () => {
	it("keeps edits in the browser until Save is clicked", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({ ...entry, version: 5, working: { metadata: body.metadata, mdx: body.mdx } });
			}
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "로컬에서 수정" } });
		// 복구본은 입력이 멈춘 뒤에 남긴다(간격은 use-entry-autosave 테스트). 여기서는 화면을 떠나 바로 남기게 한다.
		expect(saveLocalBackup).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() =>
			expect(saveLocalBackup).toHaveBeenCalledWith(expect.objectContaining({ key: `${ADMIN}:entry-1` })),
		);
		expect(screen.getByLabelText("저장 전 변경사항")).toBeTruthy();
		vi.useFakeTimers();
		await act(async () => vi.advanceTimersByTimeAsync(11_000));
		vi.useRealTimers();
		expect(methodCalls("PATCH")).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		await waitFor(() => expect(screen.getByLabelText("서버에 저장됨")).toBeTruthy());
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).metadata.title).toBe("로컬에서 수정");
	});

	it("writes the waiting browser backup right away when the page is left", async () => {
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "떠나기 전 수정" } });
		expect(saveLocalBackup).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() =>
			expect(saveLocalBackup).toHaveBeenCalledWith(
				expect.objectContaining({ snapshot: expect.objectContaining({ title: "떠나기 전 수정" }) }),
			),
		);
	});

	it("saves even when a Korean composition never reports its end", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({ ...entry, version: 5, working: { metadata: body.metadata, mdx: body.mdx } });
			}
		});
		renderEdit();
		const title = await editorTitle();
		fireEvent.change(title, { target: { value: "조합 중 수정" } });
		// 조합을 시작한 입력칸이 끝 신호 없이 사라진 경우.
		fireEvent.compositionStart(title);
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1), { timeout: 3000 });
		await waitFor(() => expect(success).toHaveBeenCalledWith("저장했습니다."));
	});

	it("shows why an explicit save failed instead of doing nothing", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") return json({ code: "invalid_input", message: "제목이 너무 깁니다." }, 400);
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "실패할 수정" } });
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining("제목이 너무 깁니다.")));
	});

	it("saves pending changes before opening the preview", async () => {
		const opened = { opener: {}, location: { href: "" }, close: vi.fn() };
		const open = vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({ ...entry, version: 5, working: { metadata: body.metadata, mdx: body.mdx } });
			}
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "미리보기 전 수정" } });
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "미리보기" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		await waitFor(() => expect(opened.location.href).toBe("/preview/posts/test"));
		open.mockRestore();
	});

	it("creates a new entry only after an explicit Save", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries" && init?.method === "POST") {
				const body = JSON.parse(String(init.body));
				return json(
					{
						...entry,
						id: "created-entry",
						version: 1,
						workingSlug: body.slug,
						working: { metadata: body.metadata, mdx: body.mdx },
					},
					201,
				);
			}
		});
		render(<EntryEditorShell mode="new" adminId={ADMIN} collection="post" />);
		fireEvent.change(await editorTitle(), { target: { value: "새 글" } });
		// 복구본은 입력이 멈춘 뒤에 남긴다(간격은 use-entry-autosave 테스트). 여기서는 화면을 떠나 바로 남기게 한다.
		expect(saveLocalBackup).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() =>
			expect(saveLocalBackup).toHaveBeenCalledWith(expect.objectContaining({ key: `${ADMIN}:new:post` })),
		);
		vi.useFakeTimers();
		await act(async () => vi.advanceTimersByTimeAsync(11_000));
		vi.useRealTimers();
		expect(methodCalls("POST", "/api/cms/v1/entries")).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("POST", "/api/cms/v1/entries")).toHaveLength(1));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:new:post`));
		expect(window.location.pathname).toBe("/admin/entries/created-entry/edit");
	});

	it("creates and publishes a local new entry when Publish is clicked", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries" && init?.method === "POST") {
				const body = JSON.parse(String(init.body));
				return json({
					...entry,
					id: "published-entry",
					collection: "memo",
					version: 1,
					workingSlug: body.slug,
					working: { metadata: body.metadata, mdx: body.mdx },
				});
			}
			if (input === "/api/cms/v1/entries/published-entry/publish" && init?.method === "POST") {
				return json({ ...entry, id: "published-entry", collection: "memo", status: "published", version: 2 });
			}
		});
		render(<EntryEditorShell mode="new" adminId={ADMIN} collection="memo" />);
		fireEvent.change(await editorTitle(), { target: { value: "바로 발행" } });
		window.dispatchEvent(new Event("pagehide"));
		await waitFor(() => expect(saveLocalBackup).toHaveBeenCalled());
		expect(methodCalls("POST", "/api/cms/v1/entries")).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(methodCalls("POST", "/api/cms/v1/entries")).toHaveLength(1);
		expect(JSON.parse(String(methodCalls("POST", "/publish")[0]?.[1]?.body))).toEqual({ expectedVersion: 1 });
	});

	it("has no publish date input and publishes with only the version", async () => {
		serve((input) => {
			if (input.endsWith("/publish")) return json({ ...entry, version: 5, status: "published", warnings: [] });
		});
		renderEdit();
		await editorTitle();
		// 발행일은 처음 발행할 때 서버가 정한다. 속성 칸에서 고치지 않는다.
		expect(screen.queryByLabelText(/^발행일/)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "발행" }));

		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("POST", "/publish")[0]?.[1]?.body))).toEqual({ expectedVersion: 4 });
	});

	it("republishes with today's date only from the publish menu of an already published entry", async () => {
		const published = { ...entry, status: "published", publishedAt: "2024-01-01T00:00:00.000Z" };
		serve((input) => {
			if (input.endsWith("/publish")) return json({ ...published, version: 5, warnings: [] });
		}, published);
		renderEdit();
		await editorTitle();
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "발행 방식" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "오늘 날짜로 다시 발행" }));

		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("POST", "/publish")[0]?.[1]?.body))).toEqual({
			expectedVersion: 4,
			resetPublishedAt: true,
		});
	});

	it("shows a plain publish button when no extension adds a publish option and the entry was never published", async () => {
		renderEdit();
		await editorTitle();
		expect(screen.getByRole("button", { name: "발행" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "발행 방식" })).toBeNull();
	});

	it("offers a same-version browser backup and deletes it when the server copy is kept", async () => {
		const server = formFromEntry(entry as never);
		getLocalBackup.mockResolvedValue({
			key: `${ADMIN}:entry-1`,
			entryId: "entry-1",
			baseVersion: 4,
			baseFingerprint: formFingerprint(server),
			localFingerprint: formFingerprint({ ...server, title: "수정" }),
			snapshot: { ...server, title: "수정" },
			changeSeq: 1,
			savedAt: Date.now(),
		});
		renderEdit();
		const dialog = await screen.findByRole("dialog", { name: "저장하지 않은 편집이 있습니다" });
		expect(within(dialog).getByRole("button", { name: "임시 저장본 불러오기" })).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "서버 저장본 열기" }));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
	});

	it("warns that loading a backup made before the server changed overwrites it", async () => {
		const server = formFromEntry(entry as never);
		getLocalBackup.mockResolvedValue({
			key: `${ADMIN}:entry-1`,
			entryId: "entry-1",
			baseVersion: 3,
			baseFingerprint: "old",
			localFingerprint: formFingerprint({ ...server, mdx: "브라우저 본문" }),
			snapshot: { ...server, mdx: "브라우저 본문" },
			changeSeq: 1,
			savedAt: Date.now(),
		});
		renderEdit();
		const dialog = await screen.findByRole("dialog", { name: "저장하지 않은 편집이 있습니다" });
		expect(within(dialog).getByText(/서버 내용을 덮어씁니다/)).toBeTruthy();
		expect(within(dialog).queryByText("브라우저 본문")).toBeNull();
		fireEvent.click(within(dialog).getByRole("button", { name: "임시 저장본 불러오기" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("binds field issues and moves positioned issues to the MDX source", async () => {
		serve((input) =>
			input.endsWith("/publish")
				? json(
						{
							code: "publish_validation_failed",
							issues: [
								{ code: "missing_field", path: "title", message: "제목" },
								{ code: "mdx_error", path: "mdx", position: { line: 2, column: 2 } },
							],
						},
						422,
					)
				: undefined,
		);
		renderEdit();
		await screen.findByDisplayValue("요약");
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await screen.findByRole("list", { name: "발행 검증 문제" });
		const title = await editorTitle();
		expect(title.getAttribute("aria-invalid")).toBe("true");
		expect(title.getAttribute("aria-describedby")).toBe("cms-title-error");
		expect(screen.getAllByRole("textbox", { name: "제목" })).toHaveLength(1);
		fireEvent.click(screen.getByRole("button", { name: /제목을 입력하세요/ }));
		await waitFor(() => expect(document.activeElement).toBe(title));
		fireEvent.click(screen.getByRole("button", { name: /MDX 본문 구문을 확인하세요/ }));
		const source = (await screen.findByRole("textbox", { name: "MDX 본문" })) as HTMLTextAreaElement;
		await waitFor(() => expect(document.activeElement).toBe(source));
		expect(source.selectionStart).toBe("첫째 줄\n".length + 1);
	});

	it("opens unparseable MDX in source mode and does not allow the visual editor (no silent overwrite)", async () => {
		serve(() => undefined, { ...entry, working: { ...entry.working, mdx: "본문 <Callout>닫히지 않음" } });
		renderEdit();
		const source = (await screen.findByRole("textbox", { name: "MDX 본문" })) as HTMLTextAreaElement;
		expect(source.value).toBe("본문 <Callout>닫히지 않음");
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect(screen.queryByLabelText("시각 본문")).toBeNull();
		const toggle = screen.getByRole("button", { name: "MDX 원문" }) as HTMLButtonElement;
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(toggle.disabled).toBe(true);
		expect(screen.getByText(/원문 모드로만 편집합니다/)).toBeTruthy();
	});

	it("switches only the body to MDX source and keeps the toolbar and title", async () => {
		renderEdit();
		await screen.findByLabelText("시각 본문");
		const toggle = screen.getByRole("button", { name: "MDX 원문" });
		fireEvent.click(toggle);
		const source = (await screen.findByRole("textbox", { name: "MDX 본문" })) as HTMLTextAreaElement;
		expect(source.value).toBe(entry.working.mdx);
		expect(screen.queryByLabelText("시각 본문")).toBeNull();
		expect((await editorTitle()).getAttribute("value")).toBe("테스트");
		expect(screen.getByRole("button", { name: "템플릿" })).toBeTruthy();
		fireEvent.click(toggle);
		expect(await screen.findByLabelText("시각 본문")).toBeTruthy();
		expect(screen.queryByRole("textbox", { name: "MDX 본문" })).toBeNull();
	});

	it("keeps the editor usable at narrow widths and opens the inspector on field errors", async () => {
		vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
		serve((input) =>
			input.endsWith("/publish")
				? json({ issues: [{ code: "missing_field", path: "categoryId", message: "카테고리" }] }, 422)
				: undefined,
		);
		renderEdit();
		await screen.findByRole("button", { name: "발행" });
		expect(await editorTitle()).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		fireEvent.click(await screen.findByRole("button", { name: /카테고리를 입력하세요/ }));
		const category = await screen.findByRole("combobox", { name: /카테고리/ });
		await waitFor(() => expect(document.activeElement).toBe(category));
		expect(screen.getByLabelText("시각 본문").closest("[inert]")).toBeTruthy();
	});

	it("adds categories and tags through the add panel, prefilled with the typed name", async () => {
		serve((input, init) => {
			if (init?.method === "PATCH") return json({ ...entry, version: 5 });
			if (input === "/api/cms/v1/entries" && init?.method === "POST") {
				const data = JSON.parse(String(init.body));
				return json(
					{
						id: data.collection === "category" ? "cat-2" : "tag-2",
						workingSlug: "slug",
						publishedSlug: "slug",
						working: { metadata: data.metadata, mdx: "" },
					},
					201,
				);
			}
		});
		renderEdit();
		// 없는 이름을 검색하면 목록 끝에 `'이름' 추가`가 나오고, 누르면 이름이 채워진 추가 칸이 열린다.
		const saveIn = async (label: string) => {
			const panel = await screen.findByRole("complementary", { name: label }, { timeout: 10_000 });
			fireEvent.click(within(panel).getByRole("button", { name: "저장" }));
			await waitFor(() => expect(screen.queryByRole("complementary", { name: label })).toBeNull(), {
				timeout: 10_000,
			});
		};
		/**
		 * 검색어를 넣고 `'이름' 추가` 항목을 누른다. Base UI는 실제 입력(`inputType`이 있는 input 이벤트)일 때만 목록을 연다.
		 * 여러 테스트 파일을 함께 돌리면 입력 칸이 준비되기 전에 넣은 입력이 사라질 때가 있어, 항목이 보일 때까지 다시 넣는다.
		 */
		const typeAndPickAdd = async (field: string, text: string) => {
			const input = (await screen.findByRole("combobox", { name: field })) as HTMLInputElement;
			const option = await waitFor(
				() => {
					if (!screen.queryByRole("option", { name: `'${text}' 추가` })) {
						fireEvent.input(input, { target: { value: text }, inputType: "insertText" });
					}
					return screen.getByRole("option", { name: `'${text}' 추가` });
				},
				{ timeout: 10_000, interval: 200 },
			);
			fireEvent.click(option);
			return input;
		};
		const category = await typeAndPickAdd("카테고리", "새 카테고리");
		await saveIn("카테고리 추가");
		await waitFor(() => expect(category.value).toBe("새 카테고리"), { timeout: 10_000 });
		await typeAndPickAdd("태그", "새 태그");
		await saveIn("태그 추가");
		await waitFor(() => expect(screen.getAllByText("새 태그").length).toBeGreaterThan(0), { timeout: 10_000 });
		const creations = methodCalls("POST", "/api/cms/v1/entries").map(([, init]) => JSON.parse(String(init?.body)));
		expect(creations).toMatchObject([
			{ collection: "category", metadata: { title: "새 카테고리" }, mdx: "" },
			{ collection: "tag", metadata: { title: "새 태그" }, mdx: "" },
		]);
	}, 30_000);

	it("stops publishing after an autosave conflict and offers copy, reload and overwrite", async () => {
		serve((input, init) => {
			if (init?.method === "PATCH") return json({ code: "conflict", serverVersion: 9 }, 409);
			if (input.endsWith("/publish")) throw new Error("Publish must not run after conflict");
		});
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "로컬 수정" } });
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		const dialog = await screen.findByRole("dialog", { name: /편집 충돌/ });
		expect(within(dialog).getAllByRole("button", { name: "본문 복사" })).toHaveLength(2);
		expect(within(dialog).getByRole("button", { name: "다시 불러오기" })).toBeTruthy();
		expect(within(dialog).getByRole("button", { name: "내 내용으로 덮어쓰기" })).toBeTruthy();
		expect(methodCalls("POST", "/publish")).toHaveLength(0);
	});

	it("reports offline, server and expired-session failures and keeps a browser backup", async () => {
		const failures: unknown[] = [
			new TypeError("offline"),
			json({ message: "server error" }, 500),
			json({ code: "unauthorized" }, 401),
		];
		serve((_input, init) => {
			if (init?.method !== "PATCH") return undefined;
			const failure = failures.shift();
			if (failure instanceof Error) throw failure;
			return failure;
		});
		renderEdit();
		const title = await editorTitle();
		const expected = ["브라우저에만 임시 저장됨", "브라우저에만 임시 저장됨", "세션 만료 — 다시 로그인하세요"];
		for (const [index, value] of ["오프라인 수정", "서버 오류 수정", "세션 만료 수정"].entries()) {
			fireEvent.change(title, { target: { value } });
			fireEvent.keyDown(window, { key: "s", metaKey: true });
			await waitFor(() => expect(methodCalls("PATCH").length).toBeGreaterThanOrEqual(index + 1), { timeout: 4000 });
			await waitFor(() => expect(screen.getByText(expected[index] as string)).toBeTruthy());
		}
		expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "새 창에서 로그인" })).toBeTruthy();
		expect(saveLocalBackup).toHaveBeenLastCalledWith(
			expect.objectContaining({
				key: `${ADMIN}:entry-1`,
				snapshot: expect.objectContaining({ title: "세션 만료 수정", summary: "요약" }),
			}),
		);
	});

	it("drops a backup that already matches the server after a lost save response", async () => {
		let server = { ...entry };
		let backup: unknown;
		saveLocalBackup.mockImplementation(async (record) => {
			backup = record;
			return true;
		});
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(server);
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				server = { ...server, version: 5, working: { ...server.working, metadata: body.metadata, mdx: body.mdx } };
				throw new TypeError("committed, response lost");
			}
		});
		const first = renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "응답 유실 수정" } });
		fireEvent.keyDown(window, { key: "s", ctrlKey: true });
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		first.unmount();

		getLocalBackup.mockResolvedValue(backup);
		renderEdit();
		await waitFor(() => expect(screen.getAllByDisplayValue("응답 유실 수정").length).toBeGreaterThan(0));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(methodCalls("PATCH")).toHaveLength(1);
	});

	it("fills an empty post summary from the body before publishing", async () => {
		serve(
			(input, init) => {
				if (init?.method === "PATCH") return json({ ...entry, version: 5 });
				if (input.endsWith("/publish")) return json({ ...entry, version: 6, status: "published", warnings: [] });
			},
			{
				...entry,
				working: { metadata: { title: "테스트", categoryId: "cat-1" }, mdx: "## 소개\n\n**본문** 첫 문장." },
			},
		);
		renderEdit();
		await screen.findByRole("textbox", { name: "요약" });
		expect(screen.queryByText(/비워 두면 발행할 때 본문에서 만듭니다/)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).metadata.summary).toBe("소개 본문 첫 문장.");
	});

	it("does not publish when a body-filled field has nothing to fill from, naming the field", async () => {
		serve(() => undefined, {
			...entry,
			working: { metadata: { title: "테스트", categoryId: "cat-1" }, mdx: "```js\nonly();\n```" },
		});
		renderEdit();
		await screen.findByRole("textbox", { name: "요약" });
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(error).toHaveBeenCalledWith("요약을 만들 본문이 없습니다. 직접 입력하세요."));
		expect(methodCalls("POST", "/publish")).toHaveLength(0);
	});

	it("shows trashed entries read-only with restore and permanent delete", async () => {
		serve(() => undefined, { ...entry, status: "trashed" });
		renderEdit();
		const banner = await screen.findByRole("region", { name: "휴지통" });
		const toolbar = screen.getByRole("banner");
		expect(within(toolbar).getByRole("button", { name: "복원" })).toBeTruthy();
		fireEvent.click(within(toolbar).getByRole("button", { name: "더보기" }));
		expect(screen.getByRole("menuitem", { name: "영구 삭제" })).toBeTruthy();
		expect(within(banner).queryByRole("button")).toBeNull();
		expect((screen.getByLabelText("시각 본문") as HTMLTextAreaElement).readOnly).toBe(true);
	});

	it("keeps frequent actions in the toolbar and moves lifecycle actions to the more menu", async () => {
		renderEdit();
		await screen.findByRole("button", { name: "더보기" });
		const toolbar = screen.getByRole("banner");
		expect(within(toolbar).queryByRole("button", { name: "MDX 원문" })).toBeNull();
		expect(
			within(screen.getByRole("toolbar", { name: "서식 도구" })).getByRole("button", { name: "MDX 원문" }),
		).toBeTruthy();
		expect(within(toolbar).getByRole("link", { name: "미리보기" })).toBeTruthy();
		fireEvent.click(within(toolbar).getByRole("button", { name: "더보기" }));
		expect(screen.getByRole("menuitem", { name: "복제" })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: "휴지통으로 이동" })).toBeTruthy();
		fireEvent.click(screen.getByRole("menuitem", { name: "보관" }));
		expect(screen.getByRole("alertdialog", { name: "보관" })).toBeTruthy();
	});

	it("opens and closes the inspector from the top bar toggle and its close button", async () => {
		renderEdit();
		const close = await screen.findByRole("button", { name: "닫기" });
		const toggle = within(screen.getByRole("banner")).getByRole("button", { name: "속성" });
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("tab", { name: "속성" })).toBeTruthy();
		fireEvent.click(close);
		expect(screen.queryByRole("tab", { name: "속성" })).toBeNull();
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(toggle);
		expect(screen.getByRole("tab", { name: "속성" })).toBeTruthy();
	});

	it("shows the unarchive action in the toolbar for archived entries", async () => {
		serve(() => undefined, { ...entry, status: "archived" });
		renderEdit();
		const unarchive = await screen.findByRole("button", { name: "보관 해제" });
		expect(within(screen.getByRole("banner")).getByRole("button", { name: "보관 해제" })).toBe(unarchive);
		expect(screen.queryByRole("button", { name: "발행" })).toBeNull();
		expect(screen.queryByRole("region", { name: "보관됨" })).toBeNull();
	});

	it("unarchives and restores at once without asking", async () => {
		for (const [status, action, label, message] of [
			["archived", "unarchive", "보관 해제", "보관을 해제했습니다."],
			["trashed", "restore", "복원", "복원했습니다."],
		] as const) {
			serve(
				(input, init) => {
					if (input.endsWith(`/${action}`) && init?.method === "POST") return json({ ...entry, version: 5 });
				},
				{ ...entry, status },
			);
			renderEdit();
			await editorTitle();
			fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: label }));
			expect(screen.queryByRole("alertdialog")).toBeNull();
			await waitFor(() => expect(methodCalls("POST", `/${action}`)).toHaveLength(1));
			await waitFor(() => expect(success).toHaveBeenCalledWith(message));
			cleanup();
		}
	});

	it("reports header action failures as a toast", async () => {
		serve((input, init) => {
			if (input.endsWith("/publish") && init?.method === "POST") return json({ message: "서버 오류" }, 500);
		});
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		await waitFor(() => expect(error).toHaveBeenCalled());
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("offers save once, in the header, not again in the more menu", async () => {
		renderEdit();
		await editorTitle();
		expect(within(screen.getByRole("banner")).getByRole("button", { name: "저장" })).toBeTruthy();
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "더보기" }));
		expect(screen.getByRole("menuitem", { name: "복제" })).toBeTruthy();
		expect(screen.queryByRole("menuitem", { name: /저장/ })).toBeNull();
	});

	it("sends record collections to their explicit-save form", async () => {
		serve(() => undefined, { ...entry, collection: "tag" });
		renderEdit();
		// 항목 컬렉션은 목록의 작은 폼으로 그 항목을 연다.
		await waitFor(() => expect(routerReplace).toHaveBeenCalledWith(`/admin?collection=tag&open=${entry.id}`));
		expect(EMPTY_FORM.title).toBe("");
	});
});

describe("템플릿", () => {
	const templates = { items: [{ id: "t1", name: "회고", mdx: "## 회고" }] };
	const sourceText = () => {
		fireEvent.click(
			within(screen.getByRole("toolbar", { name: "서식 도구" })).getByRole("button", { name: "MDX 원문" }),
		);
		return (screen.getByRole("textbox", { name: "MDX 본문" }) as HTMLTextAreaElement).value;
	};

	it("빈 본문에는 고른 템플릿을 바로 넣는다", async () => {
		serve((input) => (input === "/api/cms/v1/templates" ? json(templates) : undefined), {
			...entry,
			working: { ...entry.working, mdx: "" },
		});
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "템플릿" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "회고" }));

		expect(screen.queryByRole("alertdialog", { name: "템플릿 적용" })).toBeNull();
		expect(sourceText()).toBe("## 회고");
	});

	it("쓴 본문이 있으면 바꿀지 묻고, 적용해야 바꾼다", async () => {
		serve((input) => (input === "/api/cms/v1/templates" ? json(templates) : undefined));
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "템플릿" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "회고" }));

		const dialog = await screen.findByRole("alertdialog", { name: "템플릿 적용" });
		expect(within(dialog).getByText("지금 본문을 '회고' 템플릿으로 바꿀까요? 쓴 본문은 사라집니다.")).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "적용" }));

		await waitFor(() => expect(screen.queryByRole("alertdialog", { name: "템플릿 적용" })).toBeNull());
		expect(sourceText()).toBe("## 회고");
	});

	it("템플릿이 없으면 없다고 알린다", async () => {
		serve((input) => (input === "/api/cms/v1/templates" ? json({ items: [] }) : undefined));
		renderEdit();
		await editorTitle();
		fireEvent.click(screen.getByRole("button", { name: "템플릿" }));

		expect(await screen.findByRole("menuitem", { name: "템플릿이 없습니다." })).toBeTruthy();
	});
});

describe("언어 탭", () => {
	const member = (id: string, locale: string, status: string, isSource: boolean) => ({
		id,
		locale,
		status,
		isSource,
		title: "테스트",
		workingSlug: "test",
	});
	const source = {
		...entry,
		locale: "ko",
		translationGroupId: "entry-1",
		translations: [member("entry-1", "ko", "published", true), member("entry-en", "en", "draft", false)],
	};
	const translation = { ...source, id: "entry-en", locale: "en", status: "draft" };
	it("shows one tab per member above the title and marks the current one", async () => {
		serve(() => undefined, source);
		renderEdit();
		const nav = await screen.findByRole("navigation", { name: "언어" });
		const current = within(nav).getByRole("button", { name: "한국어 원문 · 발행됨" });
		expect(current.getAttribute("aria-current")).toBe("page");
		const other = within(nav).getByRole("button", { name: "영어 · 초안" });
		expect(other.getAttribute("aria-current")).toBeNull();
		expect(within(nav).getByRole("button", { name: "일본어 번역본 추가" })).toBeTruthy();
		expect(within(nav).queryByRole("button", { name: "번역본 메뉴" })).toBeNull();
		const title = await editorTitle();
		expect(nav.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("moves to another language by its tab", async () => {
		serve(() => undefined, source);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "영어 · 초안" }));
		expect(routerPush).toHaveBeenCalledWith("/admin/entries/entry-en/edit");
	});

	it("creates a translation from the missing-language button and opens it", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-1/translations" && init?.method === "POST") {
				return json({ id: "entry-ja" }, 201);
			}
		}, source);
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "일본어 번역본 추가" }));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/admin/entries/entry-ja/edit"));
		expect(JSON.parse(String(methodCalls("POST", "/translations")[0]?.[1]?.body))).toEqual({ locale: "ja" });
		expect(success).toHaveBeenCalledWith("일본어 번역본을 만들었습니다.");
	});

	it("blocks translation creation while there are unsaved changes", async () => {
		serve(() => undefined, source);
		renderEdit();
		fireEvent.change(await editorTitle(), { target: { value: "저장 전" } });
		fireEvent.click(screen.getByRole("button", { name: "일본어 번역본 추가" }));
		await waitFor(() => expect(error).toHaveBeenCalled());
		expect(methodCalls("POST", "/translations")).toHaveLength(0);
	});

	it("trashes a translation from its tab menu and goes back to the source", async () => {
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-en" && !init?.method) return json(translation);
			if (input === "/api/cms/v1/entries/entry-en/trash" && init?.method === "POST") {
				return json({ ...translation, status: "trashed" });
			}
		}, translation);
		render(<EntryEditorShell mode="edit" initialEntryId="entry-en" adminId={ADMIN} />);
		const nav = await screen.findByRole("navigation", { name: "언어" });
		expect(within(nav).getByRole("button", { name: "영어 · 초안" }).getAttribute("aria-current")).toBe("page");
		fireEvent.click(within(nav).getByRole("button", { name: "번역본 메뉴" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "휴지통으로 이동" }));
		const dialog = screen.getByRole("alertdialog", { name: "휴지통으로 이동" });
		expect(within(dialog).queryByText(/함께/)).toBeNull();
		fireEvent.click(within(dialog).getByRole("button", { name: "휴지통으로 이동" }));
		await waitFor(() => expect(methodCalls("POST", "/entry-en/trash")).toHaveLength(1));
		await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/admin/entries/entry-1/edit"));
	});

	it("tells that translations go along when trashing or archiving the source", async () => {
		serve(() => undefined, source);
		renderEdit();
		await screen.findByRole("navigation", { name: "언어" });
		fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "더보기" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "휴지통으로 이동" }));
		expect(within(screen.getByRole("alertdialog")).getByText(/EN 번역본도 함께 휴지통으로 이동합니다\./)).toBeTruthy();
	});

	it("hides the tabs for record collections and new entries", async () => {
		render(<EntryEditorShell mode="new" adminId={ADMIN} collection="post" />);
		await editorTitle();
		expect(screen.queryByRole("navigation", { name: "언어" })).toBeNull();
	});
});

describe("번역본 원문 창", () => {
	const SOURCE_MDX = "첫 문단\n\n둘째 문단\n";
	const source = {
		...entry,
		locale: "ko",
		translationGroupId: "entry-1",
		translations: [],
	};
	const translationWith = (baseSource: string | null) => ({
		...entry,
		id: "entry-en",
		locale: "en",
		translationGroupId: "entry-1",
		translations: [],
		source: { locale: "ko", metadata: { title: "원문 제목" }, mdx: SOURCE_MDX },
		working: {
			metadata: { title: "Title" },
			mdx: "First\n\nSecond\n",
			translation: baseSource === null ? null : { version: 2, baseSource },
		},
	});
	const sourcePane = () => screen.queryByRole("complementary", { name: "원문 창" });
	const clearStorage = () => {
		try {
			window.localStorage.clear();
		} catch {
			// 저장소가 없으면 지울 것도 없다.
		}
	};
	beforeEach(clearStorage);
	afterEach(clearStorage);

	it("번역본에만 원문 전체를 옆에 보인다", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		await waitFor(() => expect(sourcePane()?.textContent).toContain("둘째 문단"));
		expect(within(sourcePane() as HTMLElement).getByText("KO 원문")).toBeTruthy();
		// 제목 자리 안내는 원문 제목이다.
		expect((await editorTitle()).getAttribute("placeholder")).toBe("원문 제목");
		// 번역본도 같은 편집기(서식 도구, MDX 전환)를 쓴다.
		expect(screen.getByRole("toolbar", { name: "서식 도구" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "MDX 원문" })).toBeTruthy();

		cleanup();
		serve(() => undefined, source);
		renderEdit();
		await editorTitle();
		expect(sourcePane()).toBeNull();
	});

	it("원문 닫기와 원문 토글로 창을 접고 펼치며 기억한다", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		await waitFor(() => expect(sourcePane()).not.toBeNull());
		fireEvent.click(within(sourcePane() as HTMLElement).getByRole("button", { name: "닫기" }));
		expect(sourcePane()).toBeNull();
		expect(window.localStorage.getItem("cms:translation-source-pane")).toBe("closed");
		const toggle = screen.getByRole("button", { name: "원문" });
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(toggle);
		expect(sourcePane()).not.toBeNull();
		expect(window.localStorage.getItem("cms:translation-source-pane")).toBe("open");
	});

	it("이전에 접어 둔 창은 접힌 채로 연다", async () => {
		window.localStorage.setItem("cms:translation-source-pane", "closed");
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		expect(sourcePane()).toBeNull();
	});

	it("확인한 원문과 같으면 알림이 없다", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		expect(screen.queryByText("원문이 바뀌었습니다")).toBeNull();
	});

	it("원문이 바뀌면 알리고 확인이 확인한 원문을 저장에 싣는다", async () => {
		serve((_input, init) => {
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				return json({ ...translationWith(SOURCE_MDX), version: 5, working: { ...body, metadata: body.metadata } });
			}
		}, translationWith("첫 문단\n"));
		renderEdit();
		expect(await screen.findByText("원문이 바뀌었습니다")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "확인" }));
		expect(screen.queryByText("원문이 바뀌었습니다")).toBeNull();
		fireEvent.click(await screen.findByRole("button", { name: "저장" }));
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).translation).toEqual({
			version: 2,
			baseSource: SOURCE_MDX,
		});
	});

	it("번역 상태가 없거나 모양이 다르면 아무것도 확인하지 않은 것으로 본다", async () => {
		serve(() => undefined, translationWith(null));
		renderEdit();
		expect(await screen.findByText("원문이 바뀌었습니다")).toBeTruthy();
	});

	it("비교는 바뀐 블록을 이전·지금으로 나열한다", async () => {
		serve(() => undefined, translationWith("첫 문단 옛\n\n둘째 문단\n\n지운 문단\n"));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "비교" }));
		const dialog = await screen.findByRole("dialog", { name: "원문 변경" });
		expect(within(dialog).getByText("바뀜")).toBeTruthy();
		expect(within(dialog).getByText("삭제")).toBeTruthy();
		expect(within(dialog).getAllByText("이전").length).toBeGreaterThan(0);
		expect(within(dialog).getAllByText("지금").length).toBeGreaterThan(0);
		await waitFor(() => expect(dialog.textContent).toContain("첫 문단 옛"));
	});

	it("해석할 수 없는 원문은 비교할 수 없다고 알린다", async () => {
		serve(() => undefined, translationWith("<Callout>닫히지 않음"));
		renderEdit();
		fireEvent.click(await screen.findByRole("button", { name: "비교" }));
		const dialog = await screen.findByRole("dialog", { name: "원문 변경" });
		expect(within(dialog).getByText("비교할 수 없습니다.")).toBeTruthy();
	});

	it("원문 창 맨 위에 원문 제목을 보인다", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		const heading = await within(sourcePane() as HTMLElement).findByRole("heading", { level: 1 });
		expect(heading.textContent).toBe("원문 제목");
	});

	it("편집기 커서가 있는 블록에 대응하는 원문 블록을 표시한다", async () => {
		serve(() => undefined, translationWith(SOURCE_MDX));
		renderEdit();
		await editorTitle();
		const paneBlocks = async () => {
			const root = await waitFor(() => {
				const found = sourcePane()?.querySelector(".ProseMirror");
				if (!found || found.children.length < 2) throw new Error("pane not ready");
				return found;
			});
			return Array.from(root.children);
		};
		const blocks = await paneBlocks();
		const moveCaretTo = (index: number) => {
			const body = screen.getByTestId("mock-editor-body");
			const range = document.createRange();
			range.setStart(body.children[index]?.firstChild as Node, 1);
			range.collapse(true);
			const selection = document.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			document.dispatchEvent(new Event("selectionchange"));
		};
		moveCaretTo(1);
		await waitFor(() => expect(blocks[1]?.classList.contains("cms-source-active")).toBe(true));
		expect(blocks[0]?.classList.contains("cms-source-active")).toBe(false);
		moveCaretTo(0);
		await waitFor(() => expect(blocks[0]?.classList.contains("cms-source-active")).toBe(true));
		expect(blocks[1]?.classList.contains("cms-source-active")).toBe(false);
	});
});
