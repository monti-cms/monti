import { OverflowMenuHorizontal } from "../../icons";
import {
	Button,
	FormField,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	ListHead,
	PageColumn,
	PageHeader,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	SearchToggle,
	SidePanel,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
	Text,
	Textarea,
	TextButton,
} from "../../index";
import { AdminFrame } from "./frame";

const CATEGORIES = [
	{ title: "개발", address: "/dev", note: "코드와 도구 이야기", count: "글 3" },
	{ title: "일상", address: "/life", note: "하루하루 적은 것", count: "글 2" },
	{ title: "회고", address: "/retro", note: "영어 이름 없음", count: "글 1", warning: true },
];

const COLUMNS = [
	{ id: "이름", label: "이름", sort: "asc" },
	{ id: "글 수", label: "글 수", align: "end", size: 64 },
] as const;

/**
 * The categories, one open in the panel beside them. The list is a collection list: search in the title row, the column names over the rows
 * (no tabs), a check and a ⋯ on every row. The panel holds the open item's fields at the side panel's height (`md`); nothing has changed, so it
 * has no save group yet.
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
						<Table container="none" layout="fixed">
							<ListHead
								selectAll={{ state: "none", onChange: () => {}, label: "이 페이지 모두 고르기" }}
								columns={COLUMNS}
								end={38}
							/>
							<TableBody>
								{CATEGORIES.map((category, index) => (
									<TableRow key={category.title} twoLine selected={index === 0}>
										<TableCell truncate>
											<RowCheck checked={false} label={`${category.title} 고르기`} />
											<Stack gap={2} minWidth={0}>
												<RowTitle title={<RowLink href="#">{category.title}</RowLink>} address={category.address} />
												<Text variant="note" tone={category.warning ? "warning" : "subtle"} truncate>
													{category.note}
												</Text>
											</Stack>
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
