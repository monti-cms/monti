import type { Meta, StoryObj } from "@storybook/react-vite";
import { Count } from "./count";
import {
	ListFooter,
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "./pagination";
import { Stack } from "./stack";

/**
 * The pager of a list, at the right end of the row under the table (the range, "1–25 / 148", at the left). Page buttons are 32px and never narrower
 * than tall; the current page has the selected ground and is semibold; "‹ 이전" and "다음 ›" end the run, and a long run is cut with a quiet "…".
 */
const meta = {
	title: "Patterns/List/Pagination",
	component: Pagination,
	decorators: [
		(Story) => (
			<div className="flex w-full max-w-2xl items-center px-monti-12">
				<Count className="whitespace-nowrap">26–50 / 148</Count>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Pagination {...args}>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious href="#" />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="#">1</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="#" isActive>
						2
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="#">3</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationEllipsis />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="#">12</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext href="#" />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	),
};

/** One digit is a circle, more digits a pill; the current page and the others; custom previous and next text. */
export const Links: Story = {
	decorators: [],
	render: () => (
		<Stack gap={16}>
			<Pagination className="ml-0">
				<PaginationContent>
					<PaginationItem>
						<PaginationLink href="#">1</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationLink href="#" isActive>
							2
						</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationLink href="#">12</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationLink href="#">128</PaginationLink>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
			<Pagination className="ml-0">
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious href="#" text="이전 글" />
					</PaginationItem>
					<PaginationItem>
						<PaginationNext href="#" text="다음 글" />
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</Stack>
	),
};

/** The only page: "이전" and "다음" are dimmed to .45, cannot be followed and are skipped by the keyboard. */
export const Disabled: Story = {
	render: () => (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious disabled />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="#" isActive>
						1
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext disabled />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	),
};

/** The row under a table: the range at the left, the pager at the right, both 12px inside like the rows. */
export const Footer: Story = {
	decorators: [],
	render: () => (
		<div className="w-full max-w-4xl">
			<ListFooter>
				<Count className="whitespace-nowrap">1–25 / 148</Count>
				<Pagination>
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious disabled />
						</PaginationItem>
						<PaginationItem>
							<PaginationLink href="#" isActive>
								1
							</PaginationLink>
						</PaginationItem>
						<PaginationItem>
							<PaginationLink href="#">2</PaginationLink>
						</PaginationItem>
						<PaginationItem>
							<PaginationLink href="#">3</PaginationLink>
						</PaginationItem>
						<PaginationItem>
							<PaginationEllipsis />
						</PaginationItem>
						<PaginationItem>
							<PaginationLink href="#">6</PaginationLink>
						</PaginationItem>
						<PaginationItem>
							<PaginationNext href="#" />
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			</ListFooter>
		</div>
	),
};
