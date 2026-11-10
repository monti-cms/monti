import type { Meta, StoryObj } from "@storybook/react-vite";
import { Table, TableBody, TableCell, TableRow, TrashRowDate, TrashRowTitle } from "./index";

/**
 * The cells of a trash row: the title in the quiet ink of what is out of use with its address, what it holds on the second line (warning when something
 * stops it from coming back), and at the end the day it was discarded over how long it stays.
 */
const meta = {
	title: "Patterns/List/TrashRow",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {
	render: () => (
		<Table layout="fixed" columns={[undefined, 120]}>
			<TableBody>
				<TableRow twoLine>
					<TableCell>
						<TrashRowTitle title="봄에 쓴 첫 글" address="/posts/first-spring" meta="한국어 · English" />
					</TableCell>
					<TableCell align="end">
						<TrashRowDate date="10. 27" left="30일 남음" />
					</TableCell>
				</TableRow>
				<TableRow twoLine>
					<TableCell>
						<TrashRowTitle title="시리즈 원고" folder meta="게시글 폴더 · 글 2" />
					</TableCell>
					<TableCell align="end">
						<TrashRowDate date="10. 05" left="2일 남음" urgent />
					</TableCell>
				</TableRow>
				<TableRow twoLine>
					<TableCell>
						<TrashRowTitle
							title="편집기를 다시 만든 이유"
							address="/posts/why-a-new-editor"
							meta="같은 주소의 글이 있어 복원할 수 없어요"
							metaTone="warning"
						/>
					</TableCell>
					<TableCell align="end">
						<TrashRowDate date="10. 20" left="23일 남음" />
					</TableCell>
				</TableRow>
				<TableRow twoLine>
					<TableCell>
						<TrashRowTitle title="리액트" />
					</TableCell>
					<TableCell align="end">
						<TrashRowDate date="10. 26" left="29일 남음" byAssistant={{ label: "버린 대화 열기", onOpen: () => {} }} />
					</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	),
};

/** The trash list: only the days left (the day it was thrown away would say it twice); the assistant's discard puts its ✦ on them. */
export const DaysLeftOnly: Story = {
	render: () => (
		<Table layout="fixed" columns={[undefined, 120]}>
			<TableBody>
				<TableRow twoLine>
					<TableCell>
						<TrashRowTitle title="봄에 쓴 첫 글" address="/posts/first-spring" meta="한국어 · English" />
					</TableCell>
					<TableCell align="end">
						<TrashRowDate left="30일 남음" />
					</TableCell>
				</TableRow>
				<TableRow twoLine>
					<TableCell>
						<TrashRowTitle title="임시" />
					</TableCell>
					<TableCell align="end">
						<TrashRowDate left="2일 남음" urgent />
					</TableCell>
				</TableRow>
				<TableRow twoLine>
					<TableCell>
						<TrashRowTitle title="리액트" />
					</TableCell>
					<TableCell align="end">
						<TrashRowDate left="29일 남음" byAssistant={{ label: "어시스턴트가 버림" }} />
					</TableCell>
				</TableRow>
				<TableRow twoLine>
					<TableCell>
						<TrashRowTitle title="뷰" />
					</TableCell>
					<TableCell align="end">
						<TrashRowDate left="29일 남음" byAssistant={{ label: "버린 대화 열기", onOpen: () => {} }} />
					</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	),
};
