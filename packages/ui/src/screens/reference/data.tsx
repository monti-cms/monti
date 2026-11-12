import {
	Button,
	Checkbox,
	Inline,
	Option,
	PageColumn,
	PageHeader,
	PageToolbar,
	Section,
	Stack,
	TabLink,
	TabLinks,
	Text,
} from "../../index";
import { AdminFrame } from "./frame";

/** Tools, on its data tab: a backup to take, with or without the media files. */
export function DataScreen() {
	return (
		<AdminFrame open="tools">
			<PageColumn>
				<PageHeader title="도구" />
				<PageToolbar>
					<TabLinks variant="toolbar">
						<TabLink href="#">템플릿</TabLink>
						<TabLink href="#" current>
							데이터
						</TabLink>
						<TabLink href="#">API 키</TabLink>
					</TabLinks>
				</PageToolbar>
				<Section title="백업">
					<Stack gap={12}>
						{/* What goes into the backup is chosen before the pill that takes it. */}
						<Option>
							<Checkbox checked={false} />
							미디어 파일도 담기
							<Text variant="meta" tone="subtle">
								2.1 GB
							</Text>
						</Option>
						<Inline gap={16}>
							<Button variant="primary">백업 받기</Button>
							<Text as="span" variant="note" tone="subtle">
								마지막 백업 <Text mono>10. 20</Text>
							</Text>
						</Inline>
					</Stack>
				</Section>
			</PageColumn>
		</AdminFrame>
	);
}
