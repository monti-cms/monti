import {
	Block,
	BlockHandle,
	Box,
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
					{/* design-allow: the handle floats in the margin beside the block, where the editor's overlay puts it (64px left, 3px down: the 24px handle centred on the 30px line) */}
					<div style={{ position: "absolute", top: 3, left: -64 }}>
						<BlockHandle addLabel="아래에 블록 넣기" gripLabel="블록 메뉴" />
					</div>
					{/* Each item of a list is a block of its own, as the editor makes it: the handle and the tint are on one item only. */}
					<Block active>
						<ListItem>첫 번째 요점</ListItem>
					</Block>
				</Box>
				<Block>
					<ListItem>두 번째 요점</ListItem>
				</Block>
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

/** One item of a bulleted list in the editor's body: the bullet, then its words. */
function ListItem({ children }: { children: React.ReactNode }) {
	return (
		<Inline gap={10} align="baseline">
			<Text variant="reading" tone="muted" aria-hidden>
				•
			</Text>
			<Paragraph tone="muted">{children}</Paragraph>
		</Inline>
	);
}
