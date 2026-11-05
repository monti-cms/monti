import { useRef } from "react";
import {
	Box,
	CurrentProposal,
	Del,
	FormField,
	FormFieldLabel,
	Ins,
	Marker,
	MemoCardPopover,
	MemoMessage,
	MemoThread,
	ProposalBubble,
	ProposalBubbleDock,
	RequestAnchor,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	Text,
	Textarea,
} from "../../index";
import {
	BodyBlock,
	BodyHeading,
	EditorPage,
	EntryHeader,
	EntryProperties,
	EntryTitle,
	LanguageTabs,
	Paragraph,
	still,
} from "./editor-notion";

/** The assistant's proposals in the text: the first one looked at, with its request's card open, and the pill to step through them. */
export function EditorProposalScreen() {
	const first = useRef<HTMLDivElement>(null);
	return (
		<EditorPage
			header={<EntryHeader address="/posts/first-post" status="editing" statusLabel="수정 중" />}
			head={<LanguageTabs englishDot />}
			side={
				<EntryProperties
					seoDot
					summary={
						<FormField>
							<FormFieldLabel
								htmlFor="ref-summary"
								changed={{ label: "", undoLabel: "버리기", undoShown: true, tone: "proposal" }}
							>
								요약
							</FormFieldLabel>
							<Textarea
								size="md"
								id="ref-summary"
								defaultValue="리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것."
								proposal
							/>
						</FormField>
					}
				/>
			}
			statusBar={
				<StatusBar>
					<StatusBarCell tone="warning">할 일 2</StatusBarCell>
					<StatusBarCell>
						요청 1<Text>· 고치는 중 1</Text>
					</StatusBarCell>
					<StatusBarSpacer />
					<StatusBarCell end>1,212자</StatusBarCell>
				</StatusBar>
			}
			dock={
				<ProposalBubbleDock>
					<ProposalBubble
						name="더 짧게 다듬기"
						position={1}
						total={5}
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
			}
		>
			<EntryTitle>첫 번째 글</EntryTitle>
			<CurrentProposal ref={first}>
				<Marker margin="proposal" active onClick={still}>
					1
				</Marker>
				<Paragraph>
					블로그를 다시 <Del>만들기로 한</Del>
					<Ins>만든</Ins> 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.
				</Paragraph>
			</CurrentProposal>
			<MemoCardPopover
				anchor={() => first.current}
				open
				onOpenChange={still}
				discardLabel="버리기"
				onDiscard={still}
				acceptLabel="받기"
				onAccept={still}
				reply={{
					placeholder: "이어서 요청",
					value: "",
					onValueChange: still,
					onSend: still,
					sendLabel: "이어서 요청",
				}}
			>
				<MemoThread>
					<MemoMessage author="나" time="10:58">
						‘~서다’는 이 글 말투랑 안 맞아. 끝은 원래대로 두고 앞만 줄여 줘.
					</MemoMessage>
					<MemoMessage author="어시스턴트" time="10:58" ai>
						끝은 그대로 두고 “만들기로 한”만 “만든”으로 줄였어요.
					</MemoMessage>
				</MemoThread>
			</MemoCardPopover>
			<BodyBlock gap={32}>
				<BodyHeading>무엇을 덜어냈나</BodyHeading>
			</BodyBlock>
			<BodyBlock gap={12}>
				<Paragraph>
					목록에는 제목과 주소, 지금 상태만 남겼다. <strong>나머지는 필요할 때</strong> 꺼내 본다.{" "}
					<Ins>상태도 색 대신 글자로 적었다.</Ins>
				</Paragraph>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Paragraph>
					<Del>사실 이 부분은 아직 고민 중이고, 나중에 다시 바꿀 수도 있을 것 같다.</Del>
				</Paragraph>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Box position="relative">
					<Marker margin="proposal">…</Marker>
					<Paragraph>
						<RequestAnchor>설정 화면은 그대로 두었다.</RequestAnchor> 자주 바꾸지 않는 것까지 덜어낼 필요는 없었다.
					</Paragraph>
				</Box>
			</BodyBlock>
		</EditorPage>
	);
}
