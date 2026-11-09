import { ChangesBar } from "../../changes-group";
import { Close } from "../../icons";
import {
	Affix,
	Box,
	Button,
	FormField,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	Option,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	ReadValue,
	Section,
	Select,
	SelectTrigger,
	SelectValue,
	Stack,
	Switch,
	TabLink,
	TabLinks,
	Text,
	Textarea,
} from "../../index";
import { AdminFrame } from "./frame";

type SettingsTab = "site" | "locales" | "schema" | "admin";

/**
 * The settings tabs; `open` is the current one. `changed` marks the other tabs that hold unsaved changes: the open tab never carries the dot,
 * since its own changes are on the page and in the save group.
 */
export function SettingsTabs({
	open,
	changed = {},
}: {
	open: SettingsTab;
	changed?: Partial<Record<SettingsTab, "warning" | "proposal">>;
}) {
	const tabs = [
		["site", "사이트"],
		["locales", "언어"],
		["schema", "컬렉션"],
		["admin", "관리자"],
	] as const;
	return (
		<TabLinks variant="toolbar">
			{tabs.map(([id, label]) => (
				<TabLink key={id} current={id === open} dot={id === open ? undefined : changed[id]}>
					{label}
				</TabLink>
			))}
		</TabLinks>
	);
}

/** A closed select showing one value. */
export function ShownSelect({
	value,
	width = "full",
	size,
	proposal,
	id,
	label,
}: {
	value: string;
	width?: "fit" | "full";
	size?: "sm" | "md" | "default";
	proposal?: boolean;
	id?: string;
	/** The name for a screen reader when no label names the select (the section title does). */
	label?: string;
}) {
	return (
		<Select items={[{ value: "shown", label: value }]} value="shown">
			<SelectTrigger id={id} width={width} size={size} proposal={proposal} aria-label={label}>
				<SelectValue />
			</SelectTrigger>
		</Select>
	);
}

/** A setting turned on or off at once. `height` is that of the inputs around it: `lg` on a settings page, `md` (the default) in a sheet. */
export function SwitchOption({
	label,
	checked = false,
	height,
}: {
	label: React.ReactNode;
	checked?: boolean;
	height?: "lg" | "md";
}) {
	return (
		<Option spread height={height}>
			{label}
			<Switch checked={checked} />
		</Option>
	);
}

/** The read-only site URL that is not set yet. */
export function SiteUrl() {
	return (
		<ReadValue label="사이트 URL" mono={false}>
			<Text tone="warning">
				설정되지 않았습니다. 배포하는 곳에 <Text mono>SITE_URL</Text>을 넣어 주세요.
			</Text>
		</ReadValue>
	);
}

/** Settings, Site tab, with two unsaved changes. */
export function SettingsScreen() {
	return (
		<AdminFrame open="settings">
			<PageColumn>
				<PageHeader title="설정">
					<ChangesBar label="바뀐 곳" count={2} discardLabel="모두 되돌리기" saveLabel="저장하고 적용" />
				</PageHeader>
				<PageToolbar>
					<SettingsTabs open="site" />
				</PageToolbar>
				<PageBody>
					<Section title="이름과 링크">
						<FormField>
							<FormFieldLabel htmlFor="site-name" changed={{ label: "", undoLabel: "되돌리기", undoShown: true }}>
								사이트 이름
							</FormFieldLabel>
							<Input id="site-name" defaultValue="example.dev" />
						</FormField>
						<FormField>
							<FormFieldLabel htmlFor="home">홈 링크</FormFieldLabel>
							<Affix id="home" prefix="/" defaultValue="" />
						</FormField>
						<FormField>
							<FormFieldLabel>다른 호스트 이름</FormFieldLabel>
							<Stack gap={2}>
								<Inline gap={8} align="center">
									<Input mono defaultValue="www.example.dev" aria-label="호스트 1" />
									<IconButton label="www.example.dev 빼기" onClick={() => {}}>
										<Close aria-hidden />
									</IconButton>
								</Inline>
								<Box paddingTop={8}>
									<Button variant="ghost" size="sm">
										+ 호스트
									</Button>
								</Box>
							</Stack>
						</FormField>
					</Section>
					<Section title="글 쓰는 방식">
						<FormField>
							<FormFieldLabel htmlFor="voice">말투와 규칙</FormFieldLabel>
							<Textarea
								id="voice"
								rows={3}
								defaultValue={
									"‘~다’체로 쓴다. 한 문장은 짧게, 영어 낱말은 꼭 필요할 때만.\n코드 이름과 제품 이름은 옮기지 않고 그대로 둔다."
								}
							/>
						</FormField>
					</Section>
					<Section title="미리보기">
						<FormField>
							<FormFieldLabel htmlFor="preview">미리보기 경로</FormFieldLabel>
							<Affix id="preview" prefix="/" defaultValue="preview" />
						</FormField>
						<SwitchOption label="미리보기 경로에 언어 넣기" checked height="lg" />
					</Section>
					<Section title="공개 주소" last>
						<FormField>
							<FormFieldLabel>주소에 언어 표시</FormFieldLabel>
							<ShownSelect value="항상" />
						</FormField>
						<SiteUrl />
					</Section>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
