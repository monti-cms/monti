import {
	Inline,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	Suggest,
	SuggestLabel,
	SuggestList,
} from "../../index";
import { AssistantPanel } from "./assistant-parts";
import { BodyBlock, BodyHeading, EditorPage, EntryHeader, EntryTitle, LanguageTabs, Paragraph } from "./editor-notion";

/** The editor with the assistant opened for the first time: the requests for this entry, then the recent ones. */
export function AssistantFirstScreen() {
	return (
		<Inline align="stretch" gap={0} height="screen" overflow="clip">
			<Stack gap={0} grow minWidth={0}>
				<EditorPage
					header={<EntryHeader address="/posts/first-post" status="editing" statusLabel="수정 중" />}
					head={<LanguageTabs englishDot />}
					statusBar={
						<StatusBar>
							<StatusBarCell tone="warning">저장 전 변경사항</StatusBarCell>
							<StatusBarCell tone="warning">할 일 2</StatusBarCell>
							<StatusBarCell>맞춤법 2</StatusBarCell>
							<StatusBarSpacer />
							<StatusBarCell end>1,240자</StatusBarCell>
						</StatusBar>
					}
				>
					<EntryTitle>첫 번째 글</EntryTitle>
					<Paragraph>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</Paragraph>
					<BodyBlock gap={32}>
						<BodyHeading>무엇을 덜어냈나</BodyHeading>
					</BodyBlock>
					<BodyBlock gap={12}>
						<Paragraph>
							{"목록에는 제목과 주소, 지금 상태만 남겼다. "}
							{"나머지는 필요할 때 꺼내 본다"}
							{"."}
						</Paragraph>
					</BodyBlock>
					<BodyBlock gap={20}>
						<Paragraph>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.</Paragraph>
					</BodyBlock>
					<BodyBlock gap={20}>
						<Paragraph tone="faint">/ 를 눌러 블록 넣기</Paragraph>
					</BodyBlock>
				</EditorPage>
			</Stack>
			<AssistantPanel placeholder="이 글에 대해 물어보세요" newConversation={false}>
				<SuggestList>
					<SuggestLabel>이 글에서</SuggestLabel>
					<Suggest kind="request">요약 써 줘</Suggest>
					<Suggest kind="request">영어로 옮겨 줘</Suggest>
					<SuggestLabel>최근</SuggestLabel>
					<Suggest kind="recent">첫 문단을 더 짧게 다듬어 줘</Suggest>
					<Suggest kind="recent">작년 글은 2024 폴더로 옮겨 줘</Suggest>
				</SuggestList>
			</AssistantPanel>
		</Inline>
	);
}
