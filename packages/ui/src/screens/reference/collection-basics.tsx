import {
	Affix,
	Button,
	DangerBlock,
	DangerRow,
	FormField,
	FormFieldLabel,
	Grid,
	Input,
	LockMark,
	Option,
	ReadValue,
	Section,
	Stack,
	Switch,
} from "../../index";
import { CollectionSettings } from "./collection-parts";
import { AdminFrame } from "./frame";

/** A collection's basics: its name and folders, its fixed structure, its public address, and deleting it. */
export function CollectionBasicsScreen() {
	return (
		<AdminFrame open="settings">
			<CollectionSettings tab="basics">
				<Section title="보기" stacked>
					<FormField>
						<FormFieldLabel htmlFor="collection-label">표시 이름</FormFieldLabel>
						<Input id="collection-label" defaultValue="게시글" />
					</FormField>
					<Option spread>
						폴더 사용
						<Switch checked />
					</Option>
				</Section>
				<Section title="구조" stacked last>
					<Grid columns={2} gap={24}>
						<ReadValue label="식별자" mono>
							post
							<LockMark label="바꿀 수 없음" />
						</ReadValue>
						<ReadValue label="종류" mono={false}>
							본문이 있는 글
						</ReadValue>
					</Grid>
					<Stack gap={8}>
						<Option spread>
							공개 주소
							<Switch checked />
						</Option>
						<Affix aria-label="공개 주소" prefix="/" suffix="/:slug" defaultValue="posts" />
					</Stack>
				</Section>
				<DangerBlock title="컬렉션 지우기">
					<DangerRow
						name="게시글"
						meta="글 148편 · 폴더 3개"
						action={
							<Button variant="outline-danger" size="sm">
								지우기
							</Button>
						}
					/>
				</DangerBlock>
			</CollectionSettings>
		</AdminFrame>
	);
}
