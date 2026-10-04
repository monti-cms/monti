import type { Folder } from "@monti-cms/core/runtime";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSidebar } from "../../screens/admin-sidebar";
import { type FolderActions, useFolderActions } from "../../screens/shared/use-folder-actions";
import { SidebarProvider } from "../../ui/sidebar";
import { BlockHandleOverlay } from "../block-handle-overlay";
import { CmsImageNodeView } from "../image-node-view";
import { InternalLinkPopup } from "../internal-link-popup";
import { SLASH_COMMANDS } from "../slash-command";
import { SlashMenuPopup } from "../slash-menu-popup";

vi.mock("@tiptap/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tiptap/react")>();
	const react = await import("react");
	return {
		...actual,
		NodeViewWrapper: ({
			as = "figure",
			children,
			...props
		}: { as?: "figure"; children?: ReactNode } & Omit<ComponentProps<"figure">, "children">) =>
			react.createElement(as, props, children),
	};
});

afterEach(cleanup);

describe("M13 editor accessibility", () => {
	it("names image and block controls and exposes alignment state", async () => {
		const updateAttributes = vi.fn();
		const deleteNode = vi.fn();
		const nodeViewProps = {
			node: {
				attrs: {
					src: "/test-image.png",
					alt: "A test image",
					width: "100%",
					align: "center",
					caption: "",
					mediaId: null,
				},
			},
			updateAttributes,
			deleteNode,
			selected: false,
		} as unknown as NodeViewProps;
		render(
			<>
				<CmsImageNodeView {...nodeViewProps} />
				<BlockHandleOverlay
					coords={{ top: 10, left: 10 }}
					onMoveUp={vi.fn()}
					onMoveDown={vi.fn()}
					onDuplicate={vi.fn()}
					onDelete={vi.fn()}
				/>
			</>,
		);

		expect(screen.getByRole("button", { name: "왼쪽 정렬" }).getAttribute("aria-pressed")).toBe("false");
		expect(screen.getByRole("button", { name: "가운데 정렬" }).getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "왼쪽 정렬" }));
		expect(updateAttributes).toHaveBeenCalledWith({ align: "left" });
		// 삭제는 블록 손잡이 메뉴에만 있다(같은 일을 두 곳에 두지 않는다).
		expect(screen.queryByRole("button", { name: "이미지 삭제" })).toBeNull();

		const blockMenu = screen.getByRole("button", { name: "블록 조작" });
		expect(blockMenu.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(blockMenu);
		expect(blockMenu.getAttribute("aria-expanded")).toBe("true");
		expect(await screen.findByRole("menuitem", { name: /위로 이동/ })).toBeTruthy();
	});

	it("assigns unique IDs to each image editor field", async () => {
		const props = {
			node: { attrs: { src: "/test-image.png", alt: "", width: "100%", align: "center", caption: "", mediaId: null } },
			updateAttributes: vi.fn(),
			deleteNode: vi.fn(),
			selected: false,
		} as unknown as NodeViewProps;
		render(
			<>
				<CmsImageNodeView {...props} />
				<CmsImageNodeView {...props} />
			</>,
		);

		// 설정 팝오버는 한 번에 하나만 열린다. 차례로 열어 각 입력의 ID를 모은다.
		const widthIds: string[] = [];
		const altIds: string[] = [];
		for (const button of screen.getAllByRole("button", { name: "설정" })) {
			fireEvent.click(button);
			const width = await screen.findByLabelText("너비");
			widthIds.push(width.id);
			altIds.push(screen.getByLabelText("대체 텍스트").id);
			fireEvent.keyDown(width, { key: "Escape" });
			await waitFor(() => expect(screen.queryByLabelText("대체 텍스트")).toBeNull());
		}
		expect(new Set(widthIds).size).toBe(2);
		expect(new Set(altIds).size).toBe(2);
	});

	const folderNav = (folders: Folder[], folderActions: FolderActions, onSelectFolder = vi.fn()) => ({
		collection: "memo" as const,
		currentFolder: "all",
		includeDescendants: false,
		folders,
		folderActions,
		onSelectFolder,
		onIncludeDescendantsChange: vi.fn(),
		onDropEntries: vi.fn(),
		onCreateEntry: vi.fn(),
	});
	const fakeActions = (): FolderActions => ({
		requestCreate: vi.fn(),
		requestRename: vi.fn(),
		requestDelete: vi.fn(),
		moveFolder: vi.fn(),
	});

	it("keeps folder tree controls named and keyboard-operable (v2 A2 file-explorer keys)", async () => {
		const onSelectFolder = vi.fn();
		const actions = fakeActions();
		const folders: Folder[] = [
			{ id: "folder-1", collection: "memo", parentId: null, name: "문서", position: 0, version: 1 },
			{ id: "folder-2", collection: "memo", parentId: "folder-1", name: "하위", position: 0, version: 1 },
		];
		render(
			<SidebarProvider>
				<AdminSidebar activeNav="memo" folderNav={folderNav(folders, actions, onSelectFolder)} />
			</SidebarProvider>,
		);
		const expand = screen.getByRole("button", { name: "문서 하위 폴더 펼치기" });
		expect(expand.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(expand);
		expect(screen.getByRole("button", { name: "문서 하위 폴더 접기" }).getAttribute("aria-expanded")).toBe("true");
		fireEvent.click(await screen.findByRole("button", { name: "하위" }));
		expect(onSelectFolder).toHaveBeenCalledWith("folder-2");
		// 미분류 대신 컬렉션 이름의 최상위가 트리의 뿌리다.
		fireEvent.click(screen.getByRole("button", { name: "메모" }));
		expect(onSelectFolder).toHaveBeenCalledWith("all");

		const folderButton = screen.getByRole("button", { name: "문서" });
		fireEvent.keyDown(folderButton, { key: "F2" });
		expect(actions.requestRename).toHaveBeenCalledWith(folders[0]);
		fireEvent.keyDown(folderButton, { key: "Delete" });
		expect(actions.requestDelete).toHaveBeenCalledWith(folders[0]);

		// 오른쪽 클릭 메뉴와 같은 항목을 항상 보이는 ⋯ 버튼으로도 연다.
		fireEvent.click(screen.getByRole("button", { name: "'문서' 폴더 작업" }));
		expect(await screen.findByRole("menuitem", { name: "하위 폴더 추가" })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /이름 변경/ })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /삭제/ })).toBeTruthy();
	});

	it("previews folder contents before deleting and returns focus to the folder on cancel", async () => {
		const folder: Folder = {
			id: "folder-1",
			collection: "memo",
			parentId: null,
			name: "문서",
			position: 0,
			version: 1,
		};
		const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => {
			if (init?.method === "DELETE") return { ok: true, status: 200, json: async () => ({ success: true }) };
			return {
				ok: true,
				status: 200,
				json: async () => ({ entryCount: 3, childFolders: [{ ...folder, id: "c1", name: "자식" }] }),
			};
		});
		vi.stubGlobal("fetch", fetchMock);
		const onChanged = vi.fn();
		function Harness() {
			const actions = useFolderActions({ collection: "memo", folders: [folder], onChanged });
			return (
				<SidebarProvider>
					<AdminSidebar activeNav="memo" folderNav={folderNav([folder], actions)} />
					{actions.dialogs}
				</SidebarProvider>
			);
		}
		render(<Harness />);
		const trigger = screen.getByRole("button", { name: "문서" });
		trigger.focus();
		fireEvent.keyDown(trigger, { key: "Delete" });
		const dialog = await screen.findByRole("alertdialog", { name: /'문서' 폴더 삭제/ });
		expect(await screen.findByText("바로 든 메모 3개")).toBeTruthy();
		expect(screen.getByText(/하위 폴더 1개: 자식/)).toBeTruthy();
		expect(dialog.textContent).toContain("휴지통으로 가지 않고 '메모' 최상위로 옮겨집니다");
		await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
		fireEvent.click(screen.getByRole("button", { name: "취소" }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(trigger));

		fireEvent.keyDown(trigger, { key: "Delete" });
		await screen.findByText("바로 든 메모 3개");
		fireEvent.click(screen.getByRole("button", { name: "삭제" }));
		await waitFor(() => expect(onChanged).toHaveBeenCalledWith("folder-1"));
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/cms/v1/folders/folder-1?expectedVersion=1",
			expect.objectContaining({ method: "DELETE" }),
		);
		vi.unstubAllGlobals();
	});

	it("lets keyboard-focused suggestions activate and close", async () => {
		const onSelectSlash = vi.fn();
		const onCloseSlash = vi.fn();
		render(
			<SlashMenuPopup
				items={[SLASH_COMMANDS[0]]}
				coords={{ top: 0, left: 0 }}
				selectedIndex={0}
				onSelect={onSelectSlash}
				onClose={onCloseSlash}
			/>,
		);
		const slashOption = await screen.findByRole("option", { name: /문단/ });
		expect(slashOption.getAttribute("aria-selected")).toBe("true");
		fireEvent.mouseDown(slashOption);
		expect(onSelectSlash).not.toHaveBeenCalled();
		fireEvent.click(slashOption);
		expect(onSelectSlash).toHaveBeenCalledOnce();
		fireEvent.keyDown(slashOption, { key: "Escape" });
		expect(onCloseSlash).toHaveBeenCalledOnce();

		const onSelectLink = vi.fn();
		const onCloseLink = vi.fn();
		render(
			<InternalLinkPopup
				items={[{ id: "entry-1", collection: "post", title: "테스트 글", slug: "test-post" }]}
				isLoading={false}
				coords={{ top: 0, left: 0 }}
				selectedIndex={0}
				onSelect={onSelectLink}
				onClose={onCloseLink}
			/>,
		);
		const linkOption = screen.getByRole("option", { name: /테스트 글/ });
		fireEvent.mouseDown(linkOption);
		expect(onSelectLink).not.toHaveBeenCalled();
		fireEvent.click(linkOption);
		expect(onSelectLink).toHaveBeenCalledOnce();
		fireEvent.keyDown(linkOption, { key: "Escape" });
		expect(onCloseLink).toHaveBeenCalledOnce();
	});
});
