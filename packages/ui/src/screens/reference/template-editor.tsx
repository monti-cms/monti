import {
	Block,
	BlockHandle,
	Box,
	CompareBody,
	EditorTitleRule,
	FormFieldLabel,
	Inline,
	Input,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	Text,
} from "../../index";
import { BodyBlock, BodyHeading, EditorPage, EntryHeader, Paragraph } from "./editor-notion";

/** A template's editor: its name typed as the title, then the guide text in the quiet ink, the list's handle shown. */
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
			<BodyHeading>서론</BodyHeading>
			<BodyBlock gap={8}>
				<Paragraph tone="muted">이 글에서 무엇을 다루는지 한두 문장으로.</Paragraph>
			</BodyBlock>
			<BodyBlock gap={24}>
				<BodyHeading>본론</BodyHeading>
			</BodyBlock>
			<BodyBlock gap={8}>
				<Box position="relative">
					{/* design-allow: the handle floats in the margin beside the block, where the editor's overlay puts it (64px left, 4px down) */}
					<div style={{ position: "absolute", top: 4, left: -64 }}>
						<BlockHandle addLabel="아래에 블록 넣기" gripLabel="블록 메뉴" />
					</div>
					<Block active>
						<Text tone="muted">
							<CompareBody>
								<ul>
									<li>첫 번째 요점</li>
									<li>두 번째 요점</li>
								</ul>
							</CompareBody>
						</Text>
					</Block>
				</Box>
			</BodyBlock>
			<BodyBlock gap={24}>
				<BodyHeading>결론</BodyHeading>
			</BodyBlock>
			<BodyBlock gap={8}>
				<Paragraph tone="muted">한 줄 요약과 다음에 읽을 글.</Paragraph>
			</BodyBlock>
			<BodyBlock gap={24}>
				<Paragraph tone="faint">/ 를 눌러 블록 넣기</Paragraph>
			</BodyBlock>
		</EditorPage>
	);
}
