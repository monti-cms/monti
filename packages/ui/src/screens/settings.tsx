import { CheckmarkOutline, Information } from "../icons";
import {
	AddressExample,
	AddressExampleRow,
	AddressPart,
	Banner,
	Box,
	ChangesGroup,
	FormField,
	FormFieldHint,
	FormFieldLabel,
	Inline,
	Input,
	PageBanner,
	PageColumn,
	PageHeader,
	Section,
	Segmented,
	TabLink,
	TabLinks,
	Text,
	Textarea,
	TextButton,
} from "../index";
import { Num, ScreenFrame } from "./frame";

/** 설정의 네 탭. */
export type SettingsTab = "site" | "languages" | "collections" | "admin";

const TABS = [
	["site", "사이트"],
	["languages", "언어"],
	["collections", "컬렉션"],
	["admin", "관리자"],
] as const;

const noop = () => {};

/** 초안에 바뀐 곳이 있을 때 제목 줄 끝의 저장 묶음(지어낸 두 곳). */
function SaveGroup({ names }: { names: readonly [string, string] }) {
	return (
		<ChangesGroup
			label="변경 사항"
			listLabel="변경 사항 목록"
			countLabel={`변경 사항 ${names.length}개`}
			items={names.map((name) => ({ id: name, name, tag: "바뀜", tone: "warning" as const, onUndo: noop }))}
			undoLabel="되돌리기"
			discardLabel="되돌리기"
			onDiscard={noop}
			saveLabel="저장"
			onSave={noop}
		/>
	);
}

/** 바뀐 곳이 없을 때 제목 줄 끝: 흐린 "모두 저장됨". */
function SavedNote() {
	return (
		<Inline as="span" gap={6}>
			<Text as="span" variant="label" tone="faint">
				<Inline as="span" gap={6}>
					<CheckmarkOutline aria-hidden />
					모두 저장됨
				</Inline>
			</Text>
		</Inline>
	);
}

/**
 * 설정 화면의 틀(시안 v5 `settings-*.html`, v7.1의 시작선·끝선): 사이드바의 "설정"이 열린 틀, 제목 줄 "설정"과 그 끝의 저장 상태, 네 탭, 그 아래 `children`.
 * 제목 줄 · 탭 줄 · 구역 선 · 입력 칸은 880 내용 폭에서 끝난다. `wide`: 관리자 탭처럼 내용이 넓은 탭은 페이지 폭 전체를 쓴다(v7.1).
 * `changes`: 저장하지 않은 바뀐 곳의 이름 둘(저장 묶음), 없으면 "모두 저장됨". `banner`: 화면 맨 위의 띠.
 */
export function SettingsScreen({
	tab,
	changes,
	wide = false,
	banner,
	children,
}: {
	tab: SettingsTab;
	changes?: readonly [string, string];
	wide?: boolean;
	banner?: React.ReactNode;
	children: React.ReactNode;
}) {
	const page = (
		<>
			<PageHeader layout="bar" title="설정">
				{changes ? <SaveGroup names={changes} /> : <SavedNote />}
			</PageHeader>
			<nav aria-label="설정">
				<TabLinks variant="page">
					{TABS.map(([id, label]) => (
						<TabLink key={id} href={`#${id}`} current={id === tab}>
							{label}
						</TabLink>
					))}
				</TabLinks>
			</nav>
			{children}
		</>
	);
	return (
		<ScreenFrame open="settings">
			{banner && <PageBanner>{banner}</PageBanner>}
			<PageColumn width="full">{wide ? page : <Box maxWidth="content">{page}</Box>}</PageColumn>
		</ScreenFrame>
	);
}

type LanguageMark = "always" | "translations" | "never";

const MARKS = [
	{ value: "always", label: "항상" },
	{ value: "translations", label: "원문 언어만 빼고" },
	{ value: "never", label: "안 함" },
] as const satisfies readonly { value: LanguageMark; label: string }[];

const LONG_NAME = "몬티 여행기 — 걷기 좋은 길과 작은 마을, 계절마다 다시 찾고 싶은 곳을 모은 기록";

const VOICE = [
	"존댓말로 씁니다. 문장은 짧게, 한 문단은 세 문장 안으로 씁니다.",
	"숫자는 아라비아 숫자로 쓰고, 거리는 km, 시간은 ‘1시간 20분’처럼 씁니다.",
	"외래어는 국립국어원 표기를 따릅니다. 지명은 처음 나올 때만 괄호 안에 현지 표기를 함께 씁니다.",
	"광고처럼 들리는 말(최고의, 꼭 가야 할)은 쓰지 않습니다.",
	"글 끝에는 ‘가는 길’과 ‘챙길 것’을 목록으로 둡니다.",
].join("\n");

/**
 * 설정 › 사이트(시안 `settings-site.html`). `dirty`(시안 `settings-site-dirty.html`): 저장이 거절되었다. 사이트 이름이 60자를 넘었고, 말투와
 * 규칙을 고치는 중이며, 주소에 언어 표시를 "항상"으로 바꿨다. 거절 띠는 화면 맨 위에 선다(시안은 탭 아래에 두었다: 띠의 자리는 하나다).
 */
export function SettingsSiteScreen({ dirty = false }: { dirty?: boolean }) {
	const mark: LanguageMark = dirty ? "always" : "translations";
	return (
		<SettingsScreen
			tab="site"
			changes={dirty ? ["말투와 규칙", "주소에 언어 표시"] : undefined}
			banner={
				dirty && (
					<Banner tone="danger" title="저장하지 못했습니다." meta="사이트 이름은 60자까지 쓸 수 있습니다." plainMeta>
						<TextButton>이름으로 가기</TextButton>
					</Banner>
				)
			}
		>
			<Section layout="grid" title="이름">
				<FormField spacing="label" data-invalid={dirty || undefined}>
					<FormFieldLabel
						size="label"
						htmlFor="site-name"
						count={dirty ? "74 / 60" : undefined}
						countTone={dirty ? "danger" : undefined}
					>
						사이트 이름
					</FormFieldLabel>
					<Input
						id="site-name"
						placeholder="예: 몬티 여행기"
						defaultValue={dirty ? LONG_NAME : undefined}
						aria-invalid={dirty || undefined}
					/>
					{dirty ? (
						<FormFieldHint tone="danger">14자를 줄여 주세요.</FormFieldHint>
					) : (
						<FormFieldHint>비어 있음 · 브라우저 탭과 검색 결과에는 ‘Monti’로 보입니다</FormFieldHint>
					)}
				</FormField>
			</Section>
			<Section layout="grid" title="글 쓰는 방식" description="AI가 글을 채우거나 고칠 때 따릅니다">
				<FormField spacing="label">
					<FormFieldLabel
						size="label"
						htmlFor="site-voice"
						changed={dirty ? { label: "바뀜", undoLabel: "되돌리기" } : undefined}
						count={dirty ? "412 / 2,000" : "0 / 2,000"}
					>
						말투와 규칙
					</FormFieldLabel>
					<Textarea
						id="site-voice"
						size="md"
						rows={5}
						placeholder={
							"예: 존댓말로 씁니다. 문장은 짧게, 한 문단은 세 문장 안으로.\n숫자는 아라비아 숫자로, 외래어는 국립국어원 표기를 따릅니다."
						}
						defaultValue={dirty ? VOICE : undefined}
						autoFocus={dirty}
					/>
				</FormField>
			</Section>
			<Section layout="grid" last title="공개 주소">
				<FormField spacing="label">
					<FormFieldLabel size="label">주소에 언어 표시</FormFieldLabel>
					<Segmented<LanguageMark>
						inline
						aria-label="주소에 언어 표시"
						value={mark}
						onValueChange={noop}
						options={MARKS}
					/>
					<AddressExample>
						<AddressExampleRow label="한국어 · 원문">
							{mark === "always" ? (
								<>
									example.com/<AddressPart>ko</AddressPart>/articles/first-walk
								</>
							) : (
								"example.com/articles/first-walk"
							)}
						</AddressExampleRow>
						<AddressExampleRow label="English">
							example.com/<AddressPart>en</AddressPart>/articles/first-walk
						</AddressExampleRow>
						{!dirty && (
							<AddressExampleRow label="日本語">
								example.com/<AddressPart>ja</AddressPart>/articles/first-walk
							</AddressExampleRow>
						)}
					</AddressExample>
					{dirty && (
						<FormFieldHint icon={<Information aria-hidden />}>
							지금 공개된 한국어 글 <Num>26</Num>편의 주소가 바뀝니다. 옛 주소는 새 주소로 넘겨 줍니다.
						</FormFieldHint>
					)}
				</FormField>
			</Section>
		</SettingsScreen>
	);
}
