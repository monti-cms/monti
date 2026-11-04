import { OverflowMenuHorizontal, Search } from "../../icons";
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
	ReadValue,
	RowActions,
	RowMore,
	SidePanel,
	Stack,
	TabLink,
	TabLinks,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
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

/** The categories, one open in the panel beside them. */
export function TaxonomyScreen() {
	return (
		<AdminFrame open="categories" corner={false}>
			<Inline align="stretch" gap={0} grow minHeight={0}>
				<PageColumn>
					{/* The board's list is 720px: the column's 48px sides and 20px more on each. */}
					<Stack gap={0} grow minHeight={0} paddingX={20}>
						<PageHeader title="카테고리" meta="/category/:slug">
							<IconButton label="검색">
								<Search aria-hidden />
							</IconButton>
							<Button variant="secondary">+ 카테고리 추가</Button>
						</PageHeader>
						<PageToolbar inset>
							<TabLinks variant="toolbar">
								<TabLink href="#" current count="3">
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
											{index === 0 ? (
												<RowActions>
													<RowMore label="더 보기" />
												</RowActions>
											) : null}
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
					footer={
						<>
							<Stack gap={0} grow minWidth={0}>
								<Text as="span" variant="note" tone="subtle">
									바뀐 곳 없음
								</Text>
							</Stack>
							<Button variant="primary">저장</Button>
						</>
					}
				>
					<TabLinks>
						<TabLink href="#" current>
							한국어
						</TabLink>
						<TabLink href="#">English</TabLink>
					</TabLinks>
					<FormField>
						<FormFieldLabel htmlFor="category-name">이름</FormFieldLabel>
						<Input id="category-name" defaultValue="개발" />
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="category-slug">주소</FormFieldLabel>
						<Input id="category-slug" defaultValue="dev" mono />
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="category-description">설명</FormFieldLabel>
						<Textarea id="category-description" defaultValue="코드와 도구 이야기" rows={2} />
					</FormField>
					<ReadValue label="쓰는 글" mono={false}>
						<Inline as="span" gap={12} align="baseline">
							<Text mono>3편</Text>
							<TextButton variant="underline" size="note">
								목록에서 보기 →
							</TextButton>
						</Inline>
					</ReadValue>
				</SidePanel>
			</Inline>
		</AdminFrame>
	);
}
