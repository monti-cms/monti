import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CmsAdminComponentsProvider } from "../../../../admin-components";
import { chooseSelectOption } from "../../../../test/base-ui";
import { buildEditorExtensions } from "../../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../../tiptap-content";
import type { CustomBlockEditorProps } from "../view";

afterEach(cleanup);

function Harness({ source, onReady }: { source: string; onReady: (editor: Editor) => void }) {
	const editor = useEditor({
		extensions: buildEditorExtensions(),
		content: mdxToTiptap(source),
		immediatelyRender: true,
	});
	useEffect(() => {
		if (editor) onReady(editor);
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
}

const mount = async (source: string, wrap: (node: React.ReactNode) => React.ReactNode = (node) => node) => {
	let editor: Editor | null = null;
	render(
		wrap(
			<Harness
				source={source}
				onReady={(ready) => {
					editor = ready;
				}}
			/>,
		),
	);
	await waitFor(() => expect(editor).not.toBeNull());
	await waitFor(() => expect(document.querySelector("[data-cms-custom-block]")).not.toBeNull());
	return editor as unknown as Editor;
};

const NOTICE = ':::notice{level="info"}\n본문\n:::';

/** 사이트가 등록한 편집 컴포넌트(예시): 단계를 버튼으로 바꾼다. */
function NoticeEditor({ values, setValue, content }: CustomBlockEditorProps) {
	return (
		<div>
			<button type="button" contentEditable={false} onClick={() => setValue("level", "warn")}>
				단계: {String(values.level)}
			</button>
			{content}
		</div>
	);
}

describe("사용자 블록 NodeView", () => {
	it("등록한 편집 컴포넌트가 없으면 이름을 보이고, 도구 줄 설정에서 속성을 고쳐 저장한다", async () => {
		const editor = await mount(NOTICE);
		expect(screen.getByText("공지")).toBeTruthy();
		expect(screen.queryByLabelText("단계")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "설정" }));
		await chooseSelectOption("단계", "주의");
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain(':::notice{level="warn"}'));
		fireEvent.change(screen.getByLabelText("제목"), { target: { value: "점검" } });
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain('title="점검"'));
	});

	it("읽기 전용이면 설정 도구를 숨긴다", async () => {
		const editor = await mount(NOTICE);
		act(() => editor.setEditable(false));
		await waitFor(() => expect(screen.queryByRole("button", { name: "설정" })).toBeNull());
	});

	it("사이트가 등록한 편집 컴포넌트로 그린다", async () => {
		const editor = await mount(NOTICE, (node) => (
			<CmsAdminComponentsProvider components={{ blockEditors: { notice: NoticeEditor } }}>
				{node}
			</CmsAdminComponentsProvider>
		));
		fireEvent.click(screen.getByRole("button", { name: "단계: info" }));
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain(':::notice{level="warn"}'));
		expect(tiptapToMdx(editor.getJSON())).toContain("본문");
	});
});
