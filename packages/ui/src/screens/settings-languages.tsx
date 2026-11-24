import {
	Add,
	ArrowDown,
	ArrowUp,
	Close,
	Document,
	Globe,
	Information,
	Link,
	OverflowMenuHorizontal,
	Translate,
	Warning,
} from "../icons";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogEffect,
	AlertDialogEffects,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	DragHandle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	FormFieldHint,
	IconButton,
	LanguageList,
	LanguageListAdd,
	LanguageListFlag,
	LanguageListNote,
	LanguageListRow,
	Section,
	Text,
} from "../index";
import { Num } from "./frame";
import { SettingsScreen } from "./settings";

/** 콘텐츠 언어 하나(지어낸 값): 그 언어로 쓴 이름, 코드, 화면 언어로 쓴 이름, 번역된 글 수. */
interface Language {
	readonly name: string;
	readonly code: string;
	readonly label: string;
	readonly done: number;
}

const TOTAL = 26;

/** 시안 `settings-lang.html`의 번역 언어. */
const LANGUAGES: readonly Language[] = [
	{ name: "English", code: "en", label: "영어", done: 24 },
	{ name: "日本語", code: "ja", label: "일본어", done: 3 },
];

/** 시안 `settings-lang-source.html`의 번역 언어 열하나. */
const MANY_LANGUAGES: readonly Language[] = [
	...LANGUAGES,
	{ name: "中文（简体）", code: "zh-Hans", label: "중국어 간체", done: 0 },
	{ name: "中文（繁體）", code: "zh-Hant", label: "중국어 번체", done: 0 },
	{ name: "Español", code: "es", label: "스페인어", done: 12 },
	{ name: "Français", code: "fr", label: "프랑스어", done: 9 },
	{ name: "Deutsch", code: "de", label: "독일어", done: 2 },
	{ name: "Português (Brasil)", code: "pt-BR", label: "포르투갈어 브라질", done: 0 },
	{ name: "Tiếng Việt", code: "vi", label: "베트남어", done: 1 },
	{ name: "ภาษาไทย", code: "th", label: "태국어", done: 0 },
	{ name: "Bahasa Indonesia", code: "id", label: "인도네시아어", done: 0 },
];

/** 번역 줄 끝의 ⋯ 메뉴. `open`: 시안처럼 열린 채로 그린다. */
function RowMenu({ language, open }: { language: Language; open?: boolean }) {
	return (
		<DropdownMenu defaultOpen={open} modal={false}>
			<IconButton
				size="sm"
				label={`${language.name} 더 보기`}
				trigger={(button) => <DropdownMenuTrigger render={button} />}
			>
				<OverflowMenuHorizontal aria-hidden />
			</IconButton>
			<DropdownMenuContent align="end">
				<DropdownMenuItem>
					<ArrowUp aria-hidden />
					위로
				</DropdownMenuItem>
				<DropdownMenuItem>
					<ArrowDown aria-hidden />
					아래로
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Globe aria-hidden />
					원문으로 정하기…
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="danger">
					<Close aria-hidden />
					{`${language.name} 빼기…`}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** 원문을 English로 바꿀지 묻는 창(시안 `settings-lang-source.html`). 건드리는 글 수는 앱이 아는 값이다(언어별 글 수, 공개 주소 수). */
function SourceDialog() {
	return (
		<AlertDialog defaultOpen>
			<AlertDialogContent size="wide">
				<AlertDialogHeader>
					<AlertDialogTitle>원문 언어를 English로 바꿀까요?</AlertDialogTitle>
					<AlertDialogDescription>
						모든 글의 기준이 English가 됩니다. 글 내용은 지워지지 않습니다.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogEffects>
					<AlertDialogEffect icon={<Document aria-hidden />}>
						English 글이 있는 <Num>24</Num>편은 그 글이 원문이 됩니다.
					</AlertDialogEffect>
					<AlertDialogEffect icon={<Warning aria-hidden />}>
						English 글이 없는 <Num>2</Num>편은 원문이 비어{" "}
						<Text weight="semibold" tone="default">
							발행 전까지 English로 써야
						</Text>{" "}
						합니다.
					</AlertDialogEffect>
					<AlertDialogEffect icon={<Translate aria-hidden />}>
						한국어 글은 번역이 되고, ‘원문 바뀜’ 표시를 모두 다시 셉니다.
					</AlertDialogEffect>
					<AlertDialogEffect icon={<Link aria-hidden />}>
						주소에 언어 표시가 ‘원문 언어만 빼고’라 공개 주소 <Num>50</Num>개가 바뀝니다.
					</AlertDialogEffect>
				</AlertDialogEffects>
				<AlertDialogFooter>
					<AlertDialogCancel>취소</AlertDialogCancel>
					<Button>English를 원문으로</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/**
 * 설정 › 언어(시안 `settings-lang.html`): 원문 한국어와 번역 둘, English 줄의 ⋯ 메뉴가 열려 있다. `source`(시안 `settings-lang-source.html`):
 * 번역 열하나, "원문 바꾸기"에서 English를 고른 뒤의 확인 창.
 */
export function SettingsLanguagesScreen({ source = false }: { source?: boolean }) {
	const languages = source ? MANY_LANGUAGES : LANGUAGES;
	return (
		<SettingsScreen tab="languages">
			<Section
				layout="grid"
				last
				title="콘텐츠 언어"
				description="글을 쓰고 번역할 언어. 순서는 편집기 언어 탭 순서입니다"
			>
				<LanguageList aria-label="콘텐츠 언어">
					<LanguageListRow source name="한국어" code="ko">
						<LanguageListFlag>원문</LanguageListFlag>
						<Button variant="ghost" size="sm">
							원문 바꾸기
						</Button>
					</LanguageListRow>
					{languages.map((language, index) => (
						<LanguageListRow
							key={language.code}
							name={language.name}
							code={language.code}
							label={language.label}
							handle={<DragHandle aria-label={`${language.name} 옮기기`} />}
						>
							<LanguageListNote>
								번역 <Num>{language.done}</Num> / <Num>{TOTAL}</Num>
							</LanguageListNote>
							<RowMenu language={language} open={!source && index === 0} />
						</LanguageListRow>
					))}
					<LanguageListAdd>
						<Add aria-hidden />
						언어 추가
					</LanguageListAdd>
				</LanguageList>
				{!source && (
					<FormFieldHint icon={<Information aria-hidden />}>
						원문 언어로 쓴 글이 기준이 되고, 다른 언어는 그 글의 번역이 됩니다.
					</FormFieldHint>
				)}
			</Section>
			{source && <SourceDialog />}
		</SettingsScreen>
	);
}
