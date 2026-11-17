import { Add } from "../../icons";
import { NavLink, PageColumn, PageHeader, PageToolbar, RailAction, RailLayout, TabLink, TabLinks } from "../../index";

const collections = [
	{ label: "게시글", id: "post" },
	{ label: "메모", id: "memo" },
	{ label: "카테고리", id: "category" },
	{ label: "태그", id: "tag" },
	{ label: "시리즈", id: "series" },
] as const;

/**
 * Settings opened on the collections, posts selected: the page head (with `save` at its end), the settings tabs, the collections beside the content,
 * and the collection's own tabs over `children`.
 */
export function CollectionSettings({
	tab,
	save,
	children,
}: {
	tab: "basics" | "editor";
	save?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<PageColumn>
			<PageHeader title="설정">{save}</PageHeader>
			<PageToolbar>
				<TabLinks variant="toolbar">
					<TabLink>사이트</TabLink>
					<TabLink>언어</TabLink>
					{/* The open tab carries no dot: its own changes are on the page and in the save group. */}
					<TabLink current>컬렉션</TabLink>
					<TabLink>관리자</TabLink>
				</TabLinks>
			</PageToolbar>
			<RailLayout
				label="컬렉션"
				rail={
					<>
						{collections.map((collection) => (
							<NavLink key={collection.id} active={collection.id === "post"} note={collection.id}>
								{collection.label}
							</NavLink>
						))}
						<RailAction>
							<Add aria-hidden />새 컬렉션
						</RailAction>
					</>
				}
			>
				<PageToolbar>
					<TabLinks variant="toolbar">
						<TabLink current={tab === "basics"}>기본</TabLink>
						<TabLink count="10">필드</TabLink>
						<TabLink current={tab === "editor"}>에디터</TabLink>
					</TabLinks>
				</PageToolbar>
				{children}
			</RailLayout>
		</PageColumn>
	);
}
