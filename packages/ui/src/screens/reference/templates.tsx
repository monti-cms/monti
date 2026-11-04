import {
	Button,
	Count,
	PageColumn,
	PageHeader,
	PageToolbar,
	RowActions,
	RowLink,
	RowMore,
	Stack,
	TabLink,
	TabLinks,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
} from "../../index";
import { AdminFrame } from "./frame";

const TEMPLATES = [
	{ title: "기본 글", note: "서론 · 본론 · 결론", date: "10. 20 고침" },
	{ title: "책 리뷰", note: "한 줄 평 · 줄거리 · 인용 · 생각", date: "09. 02 고침" },
	{ title: "튜토리얼", note: "준비물 · 단계 · 코드 · 마무리", date: "08. 14 고침" },
];

/** Tools, on its templates tab: each template with its sections under its name. */
export function TemplatesScreen() {
	return (
		<AdminFrame open="tools">
			<PageColumn width="list">
				<PageHeader title="도구">
					<Button variant="primary">+ 템플릿 추가</Button>
				</PageHeader>
				<PageToolbar inset>
					<TabLinks variant="toolbar">
						<TabLink href="#" current count="3">
							템플릿
						</TabLink>
						<TabLink href="#">데이터</TabLink>
						<TabLink href="#" count="1" countTone="warning">
							활동 기록
						</TabLink>
						<TabLink href="#">API 키</TabLink>
					</TabLinks>
				</PageToolbar>
				<Table container="none">
					<TableBody>
						{TEMPLATES.map((template) => (
							<TableRow key={template.title} twoLine>
								<TableCell truncate>
									<Stack gap={4} minWidth={0}>
										<Text as="div" truncate>
											<RowLink href="#">{template.title}</RowLink>
										</Text>
										<Text as="div" variant="note" tone="subtle" truncate>
											{template.note}
										</Text>
									</Stack>
								</TableCell>
								<TableCell>
									<Count>{template.date}</Count>
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
