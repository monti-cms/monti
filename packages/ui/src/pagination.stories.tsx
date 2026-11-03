import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Count,
	Inline,
	ListFooter,
	PageSizeMenu,
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "./index";

/** The row under a table: the shown range and the page size at the left, the pager at the right. Page buttons are 32px; the current one is selected. */
const meta = {
	title: "Patterns/List/Pagination",
	component: Pagination,
} satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;

const pager = (current: number, pages: (number | "…")[], last: number) => (
	<Pagination>
		<PaginationContent>
			<PaginationItem>
				<PaginationPrevious href="#" text="이전" disabled={current === 1} />
			</PaginationItem>
			{pages.map((page, index) => (
				<PaginationItem key={`${page}-${index}`}>
					{page === "…" ? (
						<PaginationEllipsis />
					) : (
						<PaginationLink href="#" isActive={page === current}>
							{page}
						</PaginationLink>
					)}
				</PaginationItem>
			))}
			<PaginationItem>
				<PaginationNext href="#" text="다음" disabled={current === last} />
			</PaginationItem>
		</PaginationContent>
	</Pagination>
);

/** The footer row: "1–25 / 148", "25개씩 ▾", and the pager on page 1 (previous off). */
export const Footer: Story = {
	render: () => (
		<ListFooter>
			<Count>1–25 / 148</Count>
			<PageSizeMenu
				label="페이지당 개수"
				value={25}
				options={[
					{ value: 25, label: "25개씩" },
					{ value: 50, label: "50개씩" },
					{ value: 100, label: "100개씩" },
				]}
				onValueChange={() => {}}
			/>
			<Inline grow justify="end">
				{pager(1, [1, 2, 3, 4, 5, "…", 12], 12)}
			</Inline>
		</ListFooter>
	),
};

/** In the middle of many pages: always seven buttons. */
export const Middle: Story = { render: () => pager(6, [1, "…", 5, 6, 7, "…", 12], 12) };

/** On the last page: next is off. */
export const Last: Story = { render: () => pager(12, [1, "…", 8, 9, 10, 11, 12], 12) };
