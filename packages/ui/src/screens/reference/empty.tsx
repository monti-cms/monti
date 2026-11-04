import { Empty, EmptyStep, PageColumn, PageHeader } from "../../index";
import { AdminFrame } from "./frame";
import { NewPostButton } from "./main";

/** The memos list with nothing in it: the line that says so and the three ways to start. */
export function EmptyScreen() {
	return (
		<AdminFrame open="memos">
			<PageColumn width="list">
				<PageHeader title="메모" meta="/notes/:slug">
					<NewPostButton label="+ 새 메모 쓰기" />
				</PageHeader>
				<Empty title="아직 메모가 없어요." description="어디서부터 시작할까요?">
					<EmptyStep number="01">첫 메모 쓰기</EmptyStep>
					<EmptyStep number="02">쓰던 글 가져오기</EmptyStep>
					<EmptyStep number="03">템플릿으로 쓰기</EmptyStep>
				</Empty>
			</PageColumn>
		</AdminFrame>
	);
}
