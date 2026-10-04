import { notFound } from "next/navigation";
import { loadAdminPlugins } from "../plugins";
import EditEntryPage from "../screens/entries/[id]/edit/page";
import NewEntryPage from "../screens/entries/new/page";
import LoginPage from "../screens/login/page";
import MediaPage from "../screens/media/page";
import DashboardPage from "../screens/page";
import { requireAdminPage } from "../screens/require-admin";
import TemplatesPage from "../screens/templates/page";
import TrashPage from "../screens/trash/page";

export interface CmsAdminPageProps {
	params: Promise<{ path?: string[] }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * 관리자 화면 하나. 앱의 관리자 라우트(기본 `app/(admin)/admin/[[...path]]/page.tsx`)가 그린다. 관리자 경로 뒤 경로로
 * 화면을 고른다. 관리자 경로는 사이트 설정 `admin.path`(기본 `/admin`)이고 라우트 폴더와 같아야 한다.
 *
 * - `/admin` 목록 · `/admin/trash` 휴지통 · `/admin/media` 미디어 · `/admin/templates` 본문 템플릿
 * - `/admin/entries/new` 새 글 · `/admin/entries/<id>/edit` 편집 · `/admin/login` 로그인
 * - `/admin/<경로>` 플러그인 화면(예: AI 플러그인의 `/admin/ai`)
 */
export async function CmsAdminPage({ params, searchParams }: CmsAdminPageProps) {
	const path = (await params).path ?? [];
	const [first, second, third, ...rest] = path;
	if (rest.length > 0) notFound();
	if (path.length === 0) return <DashboardPage />;
	if (path.length === 1) {
		switch (first) {
			case "trash":
				return <TrashPage />;
			case "media":
				return <MediaPage />;
			case "templates":
				return <TemplatesPage />;
			case "login":
				return <LoginPage />;
		}
	}
	if (path.length === 1 && first) {
		const Page = (await loadAdminPlugins()).find((plugin) => plugin.pages?.[first])?.pages?.[first];
		if (Page) {
			await requireAdminPage();
			return <Page />;
		}
	}
	if (first === "entries" && second === "new" && third === undefined) {
		const query = await searchParams;
		const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
		return (
			<NewEntryPage searchParams={Promise.resolve({ collection: one(query.collection), folder: one(query.folder) })} />
		);
	}
	if (first === "entries" && second && third === "edit") {
		return <EditEntryPage params={Promise.resolve({ id: second })} />;
	}
	notFound();
}
