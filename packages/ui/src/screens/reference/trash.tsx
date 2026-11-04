import {
	Button,
	Inline,
	ListHead,
	ListScroll,
	PageColumn,
	PageHeader,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	SearchToggle,
	Table,
	TableBody,
	TableCell,
	TableRow,
	TrashRowDate,
	TrashRowTitle,
} from "../../index";
import { AdminFrame } from "./frame";

const ROWS: readonly {
	title: string;
	address?: string;
	meta?: string;
	folder?: boolean;
	kind: string;
	date: string;
	left: string;
	urgent?: boolean;
}[] = [
	{ title: "첫 번째 글", address: "/first-post", meta: "KO · EN", kind: "게시글", date: "10. 27", left: "30일 남음" },
	{ title: "시리즈 원고", meta: "글 2", folder: true, kind: "게시글", date: "10. 27", left: "30일 남음" },
	{ title: "diagrams", meta: "파일 3 · Blog Assets", folder: true, kind: "미디어", date: "10. 26", left: "29일 남음" },
	{ title: "winter-01.jpg", meta: "이미지 · 2.4 MB · Blog Assets", kind: "미디어", date: "10. 25", left: "28일 남음" },
	{ title: "옛 소개 글", address: "/about-old", meta: "KO", kind: "게시글", date: "10. 20", left: "23일 남음" },
	{
		title: "리액트 19 마이그레이션",
		address: "/react-19",
		meta: "KO",
		kind: "게시글",
		date: "10. 14",
		left: "17일 남음",
	},
	{
		title: "React 19 migration",
		address: "/en/react-19",
		meta: "English 번역",
		kind: "게시글",
		date: "10. 12",
		left: "15일 남음",
	},
	{ title: "연습장", address: "/scratch", meta: "KO", kind: "메모", date: "10. 12", left: "15일 남음" },
	{ title: "임시", kind: "태그", date: "09. 30", left: "3일 남음", urgent: true },
];

/** The trash: what was thrown away, the day it was, the days left, and a way back for each. */
export function TrashScreen() {
	return (
		<AdminFrame open="trash" counts={{ trash: "9" }}>
			<PageColumn width="list">
				<PageHeader title="휴지통">
					<SearchToggle label="검색" value="" aria-label="검색" />
					<Button variant="ghost-danger">비우기</Button>
				</PageHeader>
				<Table container="none" layout="fixed">
					<ListHead
						selectAll={{ state: "none", onChange: () => {}, label: "이 페이지 모두 고르기" }}
						end={114}
						columns={[
							{ id: "제목", label: "제목" },
							{ id: "종류", label: "종류", size: 128 },
							{ id: "버린 날", label: "버린 날", sort: "desc", align: "end", size: 144 },
						]}
					/>
					<TableBody>
						{ROWS.map((row) => (
							<TableRow key={row.title} twoLine>
								<TableCell truncate>
									<RowCheck checked={false} label={`${row.title} 고르기`} />
									<TrashRowTitle
										title={<RowLink render={<button type="button" />}>{row.title}</RowLink>}
										address={row.address}
										meta={row.meta}
										folder={row.folder}
									/>
								</TableCell>
								<TableCell tone="subtle" truncate>
									{row.kind}
								</TableCell>
								<TableCell align="end">
									<TrashRowDate date={row.date} left={row.left} urgent={row.urgent} />
								</TableCell>
								<TableCell align="end">
									<RowActions>
										<Inline gap={16}>
											<Button variant="ghost" size="sm">
												복원
											</Button>
											<RowMore label="더 보기" />
										</Inline>
									</RowActions>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</PageColumn>
		</AdminFrame>
	);
}
