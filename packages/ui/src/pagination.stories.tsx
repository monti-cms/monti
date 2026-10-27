import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "./pagination";
import { Stack } from "./stack";

const meta = {
	title: "Patterns/List/Pagination",
	component: Pagination,
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

/** Links as a round number and as a wide link, current page vs not, and custom previous/next text. */
export const Links: Story = {
	render: () => (
		<Stack gap={16}>
			{(["icon", "default"] as const).map((size) => (
				<Pagination key={size}>
					<PaginationContent>
						<PaginationItem>
							<PaginationLink href="#" size={size}>
								1
							</PaginationLink>
						</PaginationItem>
						<PaginationItem>
							<PaginationLink href="#" size={size} isActive>
								2
							</PaginationLink>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			))}
			<Pagination>
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

/** First and last page: the link has no disabled prop, so aria-disabled is the only hint. */
export const Disabled: Story = {
	render: () => (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious aria-disabled />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="#" isActive>
						1
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext href="#" />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	),
};
