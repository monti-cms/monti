import {
	Affix,
	Button,
	DangerBlock,
	DangerRow,
	FormField,
	FormFieldLabel,
	Input,
	LockMark,
	Option,
	ReadValue,
	Stack,
	Switch,
} from "../../index";
import { CollectionSettings } from "./collection-parts";
import { AdminFrame } from "./frame";

/**
 * A collection's basics: one group in the field sheet's order (identifier with its lock, kind, name, public address, folders), with no section
 * named after the system's file-or-admin split; then deleting it.
 */
export function CollectionBasicsScreen() {
	return (
		<AdminFrame open="settings">
			<CollectionSettings tab="basics">
				<Stack gap={24} paddingY={24}>
					<ReadValue label="식별자" mono>
						post
						<LockMark label="바꿀 수 없음" />
					</ReadValue>
					<ReadValue label="종류" mono={false}>
						본문이 있는 글
					</ReadValue>
					<FormField>
						<FormFieldLabel htmlFor="collection-label">표시 이름</FormFieldLabel>
						<Input id="collection-label" defaultValue="게시글" />
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="collection-path">공개 주소</FormFieldLabel>
						<Affix id="collection-path" prefix="/" suffix="/:slug" defaultValue="posts" width="fit" />
					</FormField>
					<Option spread height="lg">
						폴더 사용
						<Switch checked />
					</Option>
				</Stack>
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
