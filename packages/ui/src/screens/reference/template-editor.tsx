import {
	BlockHandle,
	EditorBody,
	EditorTitleRule,
	FormFieldLabel,
	Input,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
} from "../../index";
import { EditorPage, EntryHeader } from "./editor-notion";

/** A template's editor: its name typed as the title, then its body as the entry editor draws one, the list's handle shown. */
export function TemplateEditorScreen() {
	return (
		<EditorPage
			header={
				<EntryHeader back="템플릿" status="editing" statusLabel="저장 안 됨" publish={false} panel={false} wide />
			}
			statusBar={
				<StatusBar>
					<StatusBarSpacer />
					<StatusBarCell end>62자</StatusBarCell>
				</StatusBar>
			}
		>
			<Stack gap={0} paddingTop={16} paddingBottom={32}>
				<FormFieldLabel htmlFor="ref-template-name" hidden>
					템플릿 이름
				</FormFieldLabel>
				<Input
					id="ref-template-name"
					defaultValue="기본 글"
					placeholder="템플릿 이름"
					size="display"
					appearance="inline"
				/>
				<EditorTitleRule />
			</Stack>
			{/* The body is the entry editor's own (tools.md: the template editor's body is the editor's), drawn by the part the editor draws it with. */}
			<EditorBody>
				<div className="ProseMirror">
					<h2>서론</h2>
					<p>이 글에서 무엇을 다루는지 한두 문장으로.</p>
					<h2>본론</h2>
					<ul>
						<li className="relative" data-menu-open="">
							{/* design-allow: the handle floats in the margin beside the block, where the editor's overlay puts it (64px left of the list, 3px down: the 24px handle centred on the 30px line) */}
							<span className="absolute" style={{ top: 3, left: -92 }}>
								<BlockHandle addLabel="아래에 블록 넣기" gripLabel="블록 메뉴" active />
							</span>
							첫 번째 요점
						</li>
						<li>두 번째 요점</li>
					</ul>
					<h2>결론</h2>
					<p>한 줄 요약과 다음에 읽을 글.</p>
					<p data-empty="" data-placeholder="/ 를 눌러 블록 넣기" />
				</div>
			</EditorBody>
		</EditorPage>
	);
}
