import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	ChangeActions,
	ChangeGroup,
	ChangeLabel,
	ChangeLine,
	ChangeLines,
	ChangeNote,
	Checkbox,
	Option,
	RadioGroup,
	RadioItem,
	TextButton,
} from "./index";

/**
 * One change in the review sheet before a schema is saved: a tag colored by kind (new green, edit yellow, removed red), the name in bold with its
 * key at the end, and under them what to do with the data already saved.
 */
const meta = {
	title: "Monti/Change/ChangeGroup",
	component: ChangeGroup,
	args: { kind: "new", tag: "추가", title: "요약" },
	decorators: [
		(Story) => (
			<Box width="sheet">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ChangeGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A change that touches no saved value: no choices, one line. */
export const New: Story = {
	render: () => (
		<ChangeGroup kind="new" tag="추가" title="요약" identifier="excerpt">
			<ChangeNote>저장된 데이터는 바뀌지 않아요.</ChangeNote>
		</ChangeGroup>
	),
};

/** An edit with radio choices; the choice that needs one more answer carries it at the end of its row. */
export const EditWithChoices: Story = {
	render: () => (
		<ChangeGroup kind="edit" tag="바꿈" title="요약" identifier="summary → excerpt">
			<RadioGroup defaultValue="move">
				<RadioItem value="move" label="새 이름으로 옮기기" hint="148편" />
				<RadioItem value="empty" label="빈 칸으로 두기" />
			</RadioGroup>
			<ChangeNote>148편의 요약이 새 이름으로 옮겨져요.</ChangeNote>
		</ChangeGroup>
	),
};

/** A removal: what goes (`danger`), what blocks the change (`warning`, with the button that clears it), and a choice to keep a copy. */
export const Drop: Story = {
	render: () => (
		<ChangeGroup kind="drop" tag="뺌" title="메모" identifier="notes">
			<ChangeLabel>지워지는 것</ChangeLabel>
			<ChangeLines>
				<ChangeLine what="글 23편 (휴지통 2편 포함)" then="영구 삭제" tone="danger" />
				<ChangeLine what="이 컬렉션을 가리키는 글 4편" then="연결 끊김" tone="warning" />
			</ChangeLines>
			<ChangeLabel>받아 두기</ChangeLabel>
			<Option>
				<Checkbox defaultChecked />
				컬렉션 내보내기
			</Option>
			<ChangeNote danger>되돌릴 수 없어요.</ChangeNote>
			<ChangeActions>
				<TextButton>연결 보기</TextButton>
			</ChangeActions>
		</ChangeGroup>
	),
};

/** A change of the public address: before and after as lines, and what it does to published posts. */
export const Address: Story = {
	render: () => (
		<ChangeGroup kind="edit" tag="바꿈" title="공개 주소" identifier="path">
			<ChangeLines>
				<ChangeLine what="전" then="/posts/:slug" />
				<ChangeLine what="후" then="/blog/:slug" />
				<ChangeLine what="발행된 글" then="148편 주소 바뀜" tone="warning" />
			</ChangeLines>
			<ChangeNote>옛 주소는 404가 돼요.</ChangeNote>
		</ChangeGroup>
	),
};
