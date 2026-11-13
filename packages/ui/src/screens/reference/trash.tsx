import {
	LIST_COLUMN_SIZE,
	ListHead,
	LocaleCodes,
	PageColumn,
	PageHeader,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	SearchToggle,
	Table,
	TableBody,
	TableCell,
	TableRow,
	TextButton,
	TrashRowDate,
} from "../../index";
import { AdminFrame } from "./frame";

const LANGUAGES: Record<string, string> = { ko: "한국어", en: "영어" };

const ROWS: readonly {
	title: string;
	/** After the title, as in every list: an entry's address, what a folder holds, where a file sat. */
	address?: string;
	folder?: boolean;
	/** An entry's languages in the trash: its own first. */
	locales?: string[];
	kind: string;
	left: string;
	urgent?: boolean;
}[] = [
	{ title: "첫 번째 글", address: "/posts/first-post", locales: ["ko", "en"], kind: "게시글", left: "30일 남음" },
	{ title: "시리즈 원고", address: "글 2", folder: true, kind: "게시글", left: "30일 남음" },
	{ title: "diagrams", address: "파일 3 · Blog Assets", folder: true, kind: "미디어", left: "29일 남음" },
	{ title: "winter-01.jpg", address: "Blog Assets", kind: "미디어", left: "28일 남음" },
	{ title: "옛 소개 글", address: "/posts/about-old", locales: ["ko"], kind: "게시글", left: "23일 남음" },
	// A translation thrown away before its source is in its source's row all the same: an entry is one row.
	{
		title: "리액트 19 마이그레이션",
		address: "/posts/react-19",
		locales: ["ko", "en"],
		kind: "게시글",
		left: "17일 남음",
	},
	{ title: "연습장", address: "/notes/scratch", locales: ["ko"], kind: "메모", left: "15일 남음" },
	// Under a week left, the days are in the warning tone.
	{ title: "임시", locales: ["ko"], kind: "태그", left: "3일 남음", urgent: true },
];

/**
 * The trash: what was thrown away and the days left before it goes for good. Its rows are the lists' rows, one line each (2026-11-11, owner): the title with what
 * stands after it, the languages, the kind, the days. A row's ways back and out are in its ⋯ (restore, delete for good).
 */
export function TrashScreen() {
	return (
		<AdminFrame open="trash" counts={{ trash: "8" }}>
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
							{ id: "언어", label: "언어", size: LIST_COLUMN_SIZE.locale },
							{ id: "종류", label: "종류", size: LIST_COLUMN_SIZE.one },
							{ id: "남은 날", label: "남은 날", sort: "desc", align: "end", size: LIST_COLUMN_SIZE.measure },
						]}
					/>
					<TableBody>
						{ROWS.map((row) => (
							<TableRow key={row.title}>
								<TableCell truncate>
									<RowCheck checked={false} label={`${row.title} 고르기`} />
									<RowTitle
										title={<RowLink render={<button type="button" />}>{row.title}</RowLink>}
										address={row.address}
										folder={row.folder}
									/>
								</TableCell>
								<TableCell>
									{row.locales && (
										<LocaleCodes codes={row.locales} names={row.locales.map((code) => LANGUAGES[code]).join(", ")} />
									)}
								</TableCell>
								<TableCell tone="subtle" truncate title={row.kind}>
									{row.kind}
								</TableCell>
								<TableCell align="end">
									<TrashRowDate left={row.left} urgent={row.urgent} />
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
			</PageColumn>
		</AdminFrame>
	);
}
