import { Spark } from "../../icons";
import {
	Box,
	CurrentProposal,
	EditorTitleRule,
	Fill,
	Heading,
	Inline,
	ProposalBubble,
	ProposalBubbleDock,
	Segmented,
	Separator,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	TabLink,
	TabLinks,
	Text,
	TextButton,
	Untranslated,
} from "../../index";
import { BodyBlock, BodyHeading, EditorPage, EntryHeader, Paragraph, still } from "./editor-notion";

const VIEWS = [
	{ value: "끔", label: "끔" },
	{ value: "옆 창", label: "옆 창" },
	{ value: "나란히", label: "나란히" },
];

/** A quote of the body: plain text after a rule. */
function Quote({ children }: { children: React.ReactNode }) {
	return (
		<Box border="left" paddingX={16}>
			<Paragraph>{children}</Paragraph>
		</Box>
	);
}

const SOURCE = [
	"블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.",
	"무엇을 덜어냈나",
	"목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.",
	"글은 도구보다 오래 남는다.",
	"편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.",
];

const ENGLISH = [
	"I rebuilt this blog because I was spending more time fixing my tools than writing.",
	"What I took out",
	"The list keeps only the title, the address and the state. The rest comes out when it is needed.",
	"Writing outlives its tools.",
	"The editor follows the same rule. While you write, all you see is the writing.",
];

/**
 * The body of the entry, the same blocks on both sides: `faint` while it is still the source's words, `proposed` with the assistant's translation in
 * each block, in the proposal's letters until it is taken (the first one is the one looked at).
 */
function Body({ faint, proposed }: { faint?: boolean; proposed?: boolean }) {
	const words = (index: number) =>
		proposed ? <Fill>{ENGLISH[index]}</Fill> : faint ? <Untranslated>{SOURCE[index]}</Untranslated> : SOURCE[index];
	const first = <Paragraph>{words(0)}</Paragraph>;
	return (
		<>
			{proposed ? <CurrentProposal>{first}</CurrentProposal> : first}
			<BodyBlock gap={32}>
				<BodyHeading>{words(1)}</BodyHeading>
			</BodyBlock>
			<BodyBlock gap={12}>
				<Paragraph>{words(2)}</Paragraph>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Quote>{words(3)}</Quote>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Paragraph>{words(4)}</Paragraph>
			</BodyBlock>
		</>
	);
}

/** A new translation with its source in a pane beside it: the source read only on the tool ground, the translation still in the source's words. */
export function EditorTranslateScreen({ stage = "new" }: { stage?: "new" | "translating" | "proposed" } = {}) {
	const proposed = stage === "proposed";
	return (
		<EditorPage
			header={<EntryHeader address="/en/first-post" status="draft" statusLabel="초안" panelOpen={false} />}
			beside={
				<Box as="aside" aria-label="한국어 원문 · 읽기 전용" background="tool" border="right" grow minWidth={0}>
					<Box paddingX={40} paddingTop={16} paddingBottom={48} maxWidth="reading" centered>
						<Inline minHeight="control-md">
							<Text variant="meta" tone="subtle">
								한국어 원문 · 읽기 전용
							</Text>
						</Inline>
						<Stack gap={0} paddingTop={16} paddingBottom={32}>
							<Heading as="h1" variant="display" tone="muted">
								첫 번째 글
							</Heading>
							<EditorTitleRule />
						</Stack>
						<Text tone="muted">
							<Body />
						</Text>
					</Box>
				</Box>
			}
			head={
				<Inline minHeight="control-md" justify="between" gap={12}>
					<Box grow minWidth={0}>
						<TabLinks>
							<TabLink>한국어</TabLink>
							<TabLink current>English</TabLink>
							<TabLink render={<button type="button" />}>+ 언어</TabLink>
						</TabLinks>
					</Box>
					<Inline gap={12}>
						<TextButton tone="proposal" loading={stage === "translating"}>
							{stage === "translating" ? null : <Spark aria-hidden />}
							{stage === "translating" ? "번역하는 중…" : "번역"}
						</TextButton>
						<Separator orientation="vertical" length="control" flush />
						<Text variant="note">원문</Text>
						<Segmented aria-label="원문 보기" value="옆 창" onValueChange={still} options={VIEWS} size="sm" inline />
					</Inline>
				</Inline>
			}
			dock={
				proposed ? (
					<ProposalBubbleDock>
						<ProposalBubble
							name="번역"
							position={1}
							total={6}
							previousLabel="이전 제안"
							nextLabel="다음 제안"
							onPrevious={still}
							onNext={still}
							discardAllLabel="모두 버리기"
							onDiscardAll={still}
							acceptAllLabel="모두 받기"
							onAcceptAll={still}
						/>
					</ProposalBubbleDock>
				) : undefined
			}
			statusBar={
				<StatusBar>
					<StatusBarCell>서버에 저장됨</StatusBarCell>
					<StatusBarCell tone="warning">할 일 1</StatusBarCell>
					<StatusBarSpacer />
					<StatusBarCell end>0자</StatusBarCell>
				</StatusBar>
			}
		>
			<Stack gap={0} paddingTop={16} paddingBottom={32}>
				<Heading as="h1" variant="display">
					{proposed ? <Fill>The first post</Fill> : <Untranslated>첫 번째 글</Untranslated>}
				</Heading>
				<EditorTitleRule />
			</Stack>
			<Body faint proposed={proposed} />
		</EditorPage>
	);
}
