import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	Button,
	ChangeActions,
	ChangeGroup,
	ChangeLabel,
	ChangeLine,
	ChangeLines,
	ChangeNote,
	Checkbox,
	Highlight,
	Option,
	RadioGroup,
	RadioItem,
	Stack,
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
			<ChangeNote>저장된 데이터는 바뀌지 않습니다.</ChangeNote>
		</ChangeGroup>
	),
};

/** An edit with radio choices: the block tells its rows to read quiet (13px, muted until picked); each row is 32px, 4px apart. */
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
			<ChangeNote danger>되돌릴 수 없습니다.</ChangeNote>
			<ChangeActions>
				<Button variant="ghost" size="sm">
					연결 보기
				</Button>
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
				<ChangeLine what="발행된 글" then="148편 주소 변경" tone="warning" />
			</ChangeLines>
			<ChangeNote>옛 주소는 404가 됩니다.</ChangeNote>
		</ChangeGroup>
	),
};

/** A short value that was removed: before and after as lines, the after "없음". */
export const Removed: Story = {
	render: () => (
		<ChangeGroup kind="edit" tag="고침" title="이름과 링크" identifier="다른 호스트 이름">
			<ChangeLines>
				<ChangeLine what="전" then="www.example.dev" />
				<ChangeLine what="후" then="없음" />
			</ChangeLines>
		</ChangeGroup>
	),
};

/**
 * A long text (the writing rules): the same lines as a short value, the value wrapping and still right-aligned. The words that differ are
 * highlighted: an added sentence on the after side, a removed one on the before side.
 */
export const LongText: Story = {
	render: () => (
		<ChangeGroup kind="edit" tag="고침" title="글 쓰는 방식" identifier="말투와 규칙">
			<ChangeLines>
				<ChangeLine what="전" then="'~다'체로 쓴다. 한 문장은 짧게, 영어 낱말은 꼭 필요할 때만 쓴다." />
				<ChangeLine
					what="후"
					then={
						<>
							'~다'체로 쓴다. 한 문장은 짧게, 영어 낱말은 꼭 필요할 때만 쓴다.{" "}
							<Highlight>숫자는 아라비아 숫자로 쓴다.</Highlight>
						</>
					}
				/>
			</ChangeLines>
		</ChangeGroup>
	),
};

/**
 * A run of blocks, as the review sheet shows them: the first starts at the top of its container (nothing above it), each next one 16px under the line
 * of the one before. The container puts no gap between them.
 */
export const Run: Story = {
	render: () => (
		<Stack gap={0}>
			<ChangeGroup kind="edit" tag="이름 변경" title="요약" identifier="summary → excerpt">
				<RadioGroup defaultValue="move">
					<RadioItem value="move" label="값 옮기기" hint="148편" />
					<RadioItem value="empty" label="빈 칸으로 시작" />
				</RadioGroup>
			</ChangeGroup>
			<ChangeGroup kind="drop" tag="삭제" title="부제" identifier="subtitle">
				<RadioGroup defaultValue="clear">
					<RadioItem value="clear" label="값 지우기" hint="132편" />
					<RadioItem value="keep" label="그대로 두기" />
				</RadioGroup>
			</ChangeGroup>
			<ChangeGroup kind="new" tag="추가" title="읽는 시간" identifier="readingTime">
				<ChangeNote>저장된 데이터는 바뀌지 않습니다.</ChangeNote>
			</ChangeGroup>
		</Stack>
	),
};
