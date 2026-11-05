import {
	Box,
	Count,
	EntryStatus,
	FilterButton,
	Inline,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	RowActions,
	Stack,
	TabLink,
	TabLinks,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
} from "../../index";
import { AdminFrame } from "./frame";

type Event = { time: string; title: string; sub: string; proposal?: boolean; end?: React.ReactNode };

const talk = (
	<TextButton variant="quiet" size="note">
		대화
	</TextButton>
);
const undo = (
	<TextButton variant="underline" size="note">
		되돌리기
	</TextButton>
);

const EVENTS: readonly Event[] = [
	{
		time: "10:58",
		title: "“더 짧게 다듬어 줘. 말투는 그대로.”",
		sub: "첫 번째 글 · 본문 5곳",
		proposal: true,
		end: (
			<>
				{talk}
				{undo}
			</>
		),
	},
	{
		time: "10:52",
		title: "“이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고…”",
		sub: "다듬기 3곳 · 요약 1편 · 폴더 이동 9편 · 휴지통 3개",
		proposal: true,
		end: (
			<>
				{talk}
				{undo}
			</>
		),
	},
	{
		time: "10:51",
		title: "“예전 스캔 파일 지워 줘”",
		sub: "미디어 2개",
		proposal: true,
		end: (
			<>
				{talk}
				{undo}
			</>
		),
	},
	{
		time: "10:42",
		title: '"발행 후 고친 글" 저장',
		sub: "post/edited-post",
		end: (
			<Text as="span" variant="note" tone="subtle">
				보내는 중
			</Text>
		),
	},
	{
		time: "10:41",
		title: "“이 글 영어로 옮겨 줘”",
		sub: "첫 번째 글 · English 4곳",
		proposal: true,
		end: (
			<>
				{talk}
				<Text as="span" variant="note" tone="subtle">
					되돌림 · 10:44
				</Text>
			</>
		),
	},
	{
		time: "10:40",
		title: '"첫 번째 글" 발행',
		sub: "post/first-post",
		end: (
			<Inline gap={12} align="baseline">
				<EntryStatus status="failed">3번 실패</EntryStatus>
				<TextButton variant="underline" size="note">
					다시 보내기
				</TextButton>
			</Inline>
		),
	},
	{ time: "10:12", title: "게시글 컬렉션 필드 저장", sub: "설정 · monti.schema.ts · 필드 1개 추가" },
	{ time: "09:15", title: "이미지 cover-react.png 올림", sub: "미디어 · Blog Assets" },
];

/**
 * Tools, on its activity tab: today's events, newest first. A row's second line says only where it happened (✦ already says the assistant
 * proposed it, the title says what was done); the one failed send shows in its own row, with no banner over it.
 */
export function EventsScreen() {
	return (
		<AdminFrame open="tools">
			<PageColumn width="list">
				<PageHeader title="도구" />
				<PageToolbar inset>
					<TabLinks variant="toolbar">
						<TabLink href="#">템플릿</TabLink>
						<TabLink href="#">데이터</TabLink>
						<TabLink href="#" current count="1" countTone="warning">
							활동 기록
						</TabLink>
						<TabLink href="#">API 키</TabLink>
					</TabLinks>
					<PageToolbarEnd>
						<FilterButton>종류</FilterButton>
					</PageToolbarEnd>
				</PageToolbar>
				<Stack gap={4} paddingTop={24}>
					<Box paddingX={12}>
						<Text as="p" variant="meta" tone="subtle">
							오늘 · 10. 26
						</Text>
					</Box>
					<Table container="none" layout="fixed">
						<TableBody>
							{EVENTS.map((event) => (
								<TableRow key={event.time}>
									<TableCell valign="top" size={64}>
										<Count>{event.time}</Count>
									</TableCell>
									<TableCell truncate valign="top">
										<Stack gap={4} minWidth={0}>
											{event.proposal ? (
												<Inline gap={8} align="baseline" minWidth={0}>
													<Text tone="proposal" aria-hidden="true">
														✦
													</Text>
													<Text truncate>{event.title}</Text>
												</Inline>
											) : (
												<Text as="div" truncate>
													{event.title}
												</Text>
											)}
											<Box paddingY={2}>
												<Text as="div" variant="meta" tone="subtle" truncate>
													{event.sub}
												</Text>
											</Box>
										</Stack>
									</TableCell>
									<TableCell align="end" valign="top">
										{event.end ? (
											<RowActions>
												<Inline gap={16}>{event.end}</Inline>
											</RowActions>
										) : null}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Stack>
			</PageColumn>
		</AdminFrame>
	);
}
