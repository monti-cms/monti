import type { Meta, StoryObj } from "@storybook/react-vite";
import { type FakeApi, PageFrame } from "../../../admin/src/stories/screen-frame";
import { ProposalReviewScreen } from "./proposal-review";

const meta = { title: "Screens/AI/Proposal review", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const item = (
	id: string,
	operation: string,
	spot: string,
	title: string,
	before: unknown,
	after: unknown,
	extra = {},
) => ({
	id,
	operation,
	target: { kind: operation.startsWith("media") ? "media" : "entry", id: `t-${id}`, spot },
	preview: { before, after },
	subject: { title, path: `/${id}`, collection: "post" },
	included: true,
	state: "pending",
	...extra,
});
const MOVED = [
	"2024 회고",
	"리액트 18 정리",
	"겨울 사진",
	"봄 산책",
	"여름 휴가",
	"가을 독서",
	"연말 정산",
	"새해 다짐",
];
/** The proposal of flow 2 · 11–15: summaries for two posts (one changed meanwhile), eight posts to the 2024 folder, three images to the trash. */
const PROPOSAL = {
	id: "p1",
	runId: "r9",
	request: "이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고, 쓰지 않는 이미지도 지워 줘.",
	status: "pending",
	createdAt: "2026-10-26T10:51:00.000",
	items: [
		item(
			"types-memo",
			"entries.updateFields",
			"summary",
			"타입 정리 메모",
			null,
			"자주 헷갈리는 타입 세 가지를 예시 하나씩으로 정리한 메모.",
		),
		item(
			"draft-post",
			"entries.updateFields",
			"summary",
			"쓰는 중인 글",
			null,
			"글보다 도구를 고치는 데 시간을 더 쓰게 된 이유와 그 정리.",
			{
				state: "stale",
				reason: "changed",
			},
		),
		...MOVED.map((title, index) =>
			item(`moved-${index}`, "entries.moveToFolder", "folder", title, null, "f2024", {
				shown: { before: null, after: "2024" },
			}),
		),
		...["old-cover.png", "scan-01.jpg", "tmp.gif"].map((name, index) =>
			item(`file-${index}`, "media.trash", "trash", name, "live", "trash"),
		),
	],
};
/** The same proposal applied: everything but one move, which failed because the entry went to the trash meanwhile. */
const APPLIED = {
	...PROPOSAL,
	status: "partial",
	settledAt: "2026-10-26T10:52:00.000",
	items: PROPOSAL.items.map((entry) =>
		entry.state === "stale"
			? entry
			: entry.id === "moved-2"
				? { ...entry, state: "failed", reason: "invalid_status" }
				: { ...entry, state: "applied", appliedAt: "2026-10-26T10:52:00.000" },
	),
};

const api =
	(view: unknown): FakeApi =>
	(path) =>
		path.startsWith("/api/monti/v1/ai/proposals/") ? view : {};

const screen = (view: unknown) => () => (
	<PageFrame api={api(view)}>
		<ProposalReviewScreen params={["p1"]} />
	</PageFrame>
);

/** Reviewing (flow 2 · 12): the request quoted, each group with a check per change; one left out because it changed meanwhile, with "다시 만들기". */
export const Reviewing: Story = { tags: ["visual"], render: screen(PROPOSAL) };

/** Applied with one failure (flow 2 · 15): how many were applied and not, "모두 되돌리기", and each row's result. */
export const Applied: Story = { tags: ["visual"], render: screen(APPLIED) };
