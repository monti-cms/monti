import {
	LIST_COLUMN_SIZE,
	ListHead,
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
	TextButton,
	TrashRowDate,
	TrashRowTitle,
} from "../../index";
import { AdminFrame } from "./frame";

const ROWS: readonly {
	title: string;
	address?: string;
	meta?: string;
	folder?: boolean;
	/** Something stops it from coming back alone: the line says what, in the warning tone. */
	warning?: boolean;
	kind: string;
	left: string;
	urgent?: boolean;
}[] = [
	{ title: "첫 번째 글", address: "/posts/first-post", meta: "KO · EN", kind: "게시글", left: "30일 남음" },
	{ title: "시리즈 원고", meta: "글 2", folder: true, kind: "게시글", left: "30일 남음" },
	{ title: "diagrams", meta: "파일 3 · Blog Assets", folder: true, kind: "미디어", left: "29일 남음" },
	{ title: "winter-01.jpg", meta: "이미지 · 2.4 MB · Blog Assets", kind: "미디어", left: "28일 남음" },
	{ title: "옛 소개 글", address: "/posts/about-old", meta: "KO", kind: "게시글", left: "23일 남음" },
	{ title: "리액트 19 마이그레이션", address: "/posts/react-19", meta: "KO", kind: "게시글", left: "17일 남음" },
	{
		title: "React 19 migration",
		address: "/en/posts/react-19",
		meta: "원문이 휴지통에 있음",
		warning: true,
		kind: "게시글",
		left: "15일 남음",
	},
	{ title: "연습장", address: "/notes/scratch", meta: "KO", kind: "메모", left: "15일 남음" },
	// Under a week left, the days are in the warning tone.
	{ title: "임시", kind: "태그", left: "3일 남음", urgent: true },
];

/**
 * The trash: what was thrown away and the days left before it goes for good. A row's ways back and out are in its ⋯ (restore, delete for good), as in every
 * list (2026-11-11, owner).
 */
export function TrashScreen() {
	return (
		<AdminFrame open="trash" counts={{ trash: "9" }}>
			<PageColumn width="list">
				<PageHeader title="휴지통">
					<SearchToggle label="검색" value="" aria-label="검색" />
					<TextButton variant="danger">비우기</TextButton>
				</PageHeader>
				<Table container="none" layout="fixed">
					<ListHead
						selectAll={{ state: "none", onChange: () => {}, label: "이 페이지 모두 고르기" }}
						end={LIST_COLUMN_SIZE.end}
						columns={[
							{ id: "제목", label: "제목" },
							{ id: "종류", label: "종류", size: LIST_COLUMN_SIZE.one },
							{ id: "남은 날", label: "남은 날", sort: "desc", align: "end", size: LIST_COLUMN_SIZE.measure },
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
										metaTone={row.warning ? "warning" : "default"}
										folder={row.folder}
									/>
								</TableCell>
								<TableCell tone="subtle" truncate>
									{row.kind}
								</TableCell>
								<TableCell align="end">
									<TrashRowDate left={row.left} urgent={row.urgent} />
								</TableCell>
								<TableCell align="end">
									<RowActions>
										<RowMore label="행 메뉴" />
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
