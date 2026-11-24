import { Add, Document, Layers, Tag, TrashCan, User } from "../icons";
import {
	AddressExample,
	AddressExampleRow,
	AddressPart,
	Affix,
	Box,
	Button,
	FormField,
	FormFieldHint,
	FormFieldLabel,
	Grid,
	Input,
	LockMark,
	NavLink,
	RailAction,
	RailLayout,
	ReadValue,
	Section,
	Segmented,
	SettingRow,
	Switch,
} from "../index";
import { Num } from "./frame";
import { SettingsScreen } from "./settings";

const noop = () => {};

/** 시안 `parts/coll-rail.html`의 컬렉션: 아이콘, 이름, 끝의 필드 수. */
const COLLECTIONS = [
	{ id: "article", icon: <Document aria-hidden />, name: "글", fields: 22 },
	{ id: "tag", icon: <Tag aria-hidden />, name: "태그", fields: 3 },
	{ id: "person", icon: <User aria-hidden />, name: "사람", fields: 4 },
	{ id: "series", icon: <Layers aria-hidden />, name: "연재", fields: 3 },
] as const;

/**
 * 설정 › 컬렉션 › 글 › 기본(시안 `settings-basics.html`): 컬렉션 목록 옆에 기본 · 필드를 고르는 칸, 이 컬렉션(식별자, 종류, 표시 이름), 주소,
 * 정리(폴더 사용), 위험 구역. 내용은 v7.1대로 880 내용 끝(1152)까지다(시안의 760 제한은 없앴다).
 */
export function SettingsCollectionScreen() {
	return (
		<SettingsScreen tab="collections">
			<RailLayout
				layout="grid"
				label="컬렉션"
				rail={
					<>
						{COLLECTIONS.map((collection, index) => (
							<NavLink key={collection.id} icon={collection.icon} active={index === 0} note={collection.fields}>
								{collection.name}
							</NavLink>
						))}
						<RailAction row>
							<Add aria-hidden />새 컬렉션
						</RailAction>
					</>
				}
			>
				<Segmented<"basics" | "fields">
					inline
					aria-label="글 컬렉션"
					value="basics"
					onValueChange={noop}
					options={[
						{ value: "basics", label: "기본" },
						{
							value: "fields",
							label: (
								<span>
									필드 <Num>22</Num>
								</span>
							),
						},
					]}
				/>
				<Section layout="grid" titleWidth="narrow" title="이 컬렉션">
					<Grid columns={2} gap={20} responsive={false}>
						<ReadValue size="label" label="식별자" aside="바꿀 수 없음">
							article
							<LockMark label="바꿀 수 없음" />
						</ReadValue>
						<ReadValue size="label" label="종류" mono={false}>
							본문이 있는 글
						</ReadValue>
					</Grid>
					<FormField spacing="label">
						<FormFieldLabel size="label" htmlFor="collection-label">
							표시 이름
						</FormFieldLabel>
						<Input id="collection-label" defaultValue="글" />
						<FormFieldHint>사이드바와 목록 제목에 보입니다</FormFieldHint>
					</FormField>
				</Section>
				<Section layout="grid" titleWidth="narrow" title="주소" description="끝부분은 글마다 쓰는 ‘주소’입니다">
					<FormField spacing="label">
						<FormFieldLabel size="label" htmlFor="collection-path">
							공개 주소
						</FormFieldLabel>
						<Affix id="collection-path" prefix="example.com/" suffix="/글 주소" suffixWords defaultValue="articles" />
						<AddressExample label="short">
							<AddressExampleRow label="예">
								example.com/<AddressPart>articles</AddressPart>/first-walk
							</AddressExampleRow>
						</AddressExample>
					</FormField>
					<FormField spacing="label">
						<FormFieldLabel size="label" htmlFor="collection-preview">
							미리보기 주소
						</FormFieldLabel>
						<Affix
							id="collection-preview"
							prefix="example.com/"
							suffix="/글 주소"
							suffixWords
							placeholder="비워 두면 공개 주소에서 미리봅니다"
						/>
					</FormField>
				</Section>
				<Section layout="grid" titleWidth="narrow" title="정리">
					<SettingRow
						title="폴더 사용"
						description="글 목록에서 폴더로 묶습니다. 끄면 폴더는 남고 목록에서만 숨겨집니다."
						control={<Switch checked aria-label="폴더 사용" />}
					/>
				</Section>
				<Section layout="grid" titleWidth="narrow" tone="danger" last title="위험 구역">
					<Box>
						<SettingRow
							tone="danger"
							title="컬렉션 지우기"
							description={
								<>
									‘글’ <Num>26</Num>편과 필드 <Num>22</Num>개가 휴지통으로 갑니다. <Num>30</Num>일 안에 되살릴 수
									있습니다.
								</>
							}
							control={
								<Button variant="outline-danger">
									<TrashCan aria-hidden />
									지우기…
								</Button>
							}
						/>
					</Box>
				</Section>
			</RailLayout>
		</SettingsScreen>
	);
}
