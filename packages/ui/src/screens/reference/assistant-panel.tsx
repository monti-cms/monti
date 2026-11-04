import {
	ChatAnswer,
	ChatMessage,
	ChatThread,
	Inline,
	Suggest,
	SuggestLabel,
	SuggestList,
	ToolCallLine,
	ToolCallLines,
} from "../../index";
import { AssistantPanel, MessageActions } from "./assistant-parts";

/** The assistant's panel alone, before the first question: the saved requests for this list, then the recent ones. */
export function AssistantPanelScreen() {
	return (
		<Inline align="stretch" gap={0} height="screen">
			<AssistantPanel placeholder="사이트에 대해 물어보세요" effort="보통">
				<SuggestList>
					<SuggestLabel>이 목록에서</SuggestLabel>
					<Suggest kind="request">요약이 비어 있는 글 찾아 줘</Suggest>
					<Suggest kind="request">한 달 넘게 안 고친 초안 찾아 줘</Suggest>
					<SuggestLabel>최근</SuggestLabel>
					<Suggest kind="recent">쓰지 않는 태그 정리해 줘</Suggest>
					<Suggest kind="recent">이 글 영어로 옮겨 줘</Suggest>
				</SuggestList>
			</AssistantPanel>
		</Inline>
	);
}

/** The assistant at work: the admin asked to translate, then said two more things, which wait over the text box. */
export function AssistantWorkingScreen() {
	return (
		<Inline align="stretch" gap={0} height="screen">
			<AssistantPanel
				placeholder="사이트에 대해 물어보세요"
				effort="보통"
				queued={["회고 글은 빼고 옮겨 줘", "사진 글도 빼 줘"]}
			>
				<ChatThread>
					<ChatMessage author="user">작년 글을 모두 영어로 옮겨 줘</ChatMessage>
					<MessageActions author="user" time="오후 4:02" />
					<ChatAnswer>
						<ToolCallLines>
							<ToolCallLine status="done" statusLabel="끝남">
								글 목록 읽음 · 2025년 글 12편
							</ToolCallLine>
							<ToolCallLine status="running" statusLabel="하는 중">
								옮기는 중 · 3 / 12편
							</ToolCallLine>
						</ToolCallLines>
					</ChatAnswer>
				</ChatThread>
			</AssistantPanel>
		</Inline>
	);
}
