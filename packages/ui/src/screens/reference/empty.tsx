import { Empty, PageColumn, PageHeader } from "../../index";
import { AdminFrame } from "./frame";
import { NewPostButton } from "./main";

/** The memos list with nothing in it: one line that says so; the ways to start are the split pill's (write, import, from a template). */
export function EmptyScreen() {
	return (
		<AdminFrame open="memos">
			<PageColumn width="list">
				<PageHeader title="메모" meta="/notes/:slug">
					<NewPostButton label="+ 새 메모 쓰기" />
				</PageHeader>
				<Empty title="아직 메모가 없어요." />
			</PageColumn>
		</AdminFrame>
	);
}
