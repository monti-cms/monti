import { OverflowMenuHorizontal } from "../../icons";
import {
	Button,
	DragHandle,
	FilterButton,
	FormField,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	RowActions,
	RowMore,
	SearchToggle,
	SidePanel,
	Stack,
	TabLink,
	TabLinks,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
	Textarea,
	TextButton,
	TrashRowTitle,
} from "../../index";
import { AdminFrame } from "./frame";

const CATEGORIES = [
	{ title: "개발", address: "/dev", meta: "Development · 코드와 도구 이야기", count: "글 3" },
	{ title: "일상", address: "/life", meta: "Life", count: "글 2" },
	{ title: "회고", address: "/retro", meta: "영어 이름 없음", count: "글 1", warning: true },
];

/**
 * The categories in the order the admin set by dragging (the site shows them in this order), one open in the panel beside them. The panel holds
 * the open item's fields at the side panel's height (`md`); nothing has changed, so it has no save group yet.
 */
export function TaxonomyScreen() {
	return (
		<AdminFrame open="categories" corner={false}>
			<Inline align="stretch" gap={0} grow minHeight={0}>
				<PageColumn>
					{/* The board's list is 720px: the column's 48px sides and 20px more on each. */}
					<Stack gap={0} grow minHeight={0} paddingX={20}>
						<PageHeader title="카테고리" meta="/category/:slug">
							<SearchToggle label="검색" value="" aria-label="검색" placeholder="이름·주소 검색" />
							<Button variant="secondary">+ 카테고리 추가</Button>
						</PageHeader>
						<PageToolbar inset>
							<TabLinks variant="toolbar">
								<TabLink href="#" current>
									전체
								</TabLink>
							</TabLinks>
							<PageToolbarEnd>
								<FilterButton>이름순</FilterButton>
							</PageToolbarEnd>
						</PageToolbar>
						<Table container="none" layout="fixed" columns={[26, undefined, 52, 34]}>
							<TableBody>
								{CATEGORIES.map((category, index) => (
									<TableRow key={category.title} twoLine selected={index === 0}>
										<TableCell>
											<DragHandle aria-label={`${category.title} 옮기기`} />
										</TableCell>
										<TableCell truncate>
											<TrashRowTitle
												title={category.title}
												address={category.address}
												meta={category.meta}
												metaTone={category.warning ? "warning" : undefined}
											/>
										</TableCell>
										<TableCell align="end">
											<TextButton variant="underline" size="note">
												{category.count}
											</TextButton>
										</TableCell>
										<TableCell align="end">
											<RowActions>
												<RowMore label="더 보기" />
											</RowActions>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Stack>
				</PageColumn>
				<SidePanel
					title="개발"
					closable
					actions={
						<IconButton label="더 보기">
							<OverflowMenuHorizontal aria-hidden />
						</IconButton>
					}
				>
					<Tabs value="한국어">
						<TabsList variant="line">
							<TabsTrigger value="한국어">한국어</TabsTrigger>
							<TabsTrigger value="English">English</TabsTrigger>
						</TabsList>
					</Tabs>
					<FormField>
						<FormFieldLabel htmlFor="category-name">이름</FormFieldLabel>
						<Input id="category-name" size="md" defaultValue="개발" />
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="category-slug">주소</FormFieldLabel>
						<Input id="category-slug" size="md" defaultValue="dev" mono />
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="category-description">설명</FormFieldLabel>
						<Textarea id="category-description" size="md" defaultValue="코드와 도구 이야기" rows={2} />
					</FormField>
				</SidePanel>
			</Inline>
		</AdminFrame>
	);
}
