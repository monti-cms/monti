import { Inline, Suggest, SuggestLabel, SuggestList } from "../../index";
import { AssistantPanel } from "./assistant-parts";

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
