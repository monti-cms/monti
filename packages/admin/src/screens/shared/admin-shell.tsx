"use client";

import { COLLECTIONS, cmsApiUrl, createTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../ui/sidebar";
import { cmsFetch } from "../admin-api";
import { AdminSidebar, type AdminSidebarProps } from "../admin-sidebar";
import { TRASH_COUNT_KEY } from "./list-cache";
import { sharedMessages } from "./messages";

const t = createTranslator(sharedMessages);

interface AdminNavContextValue {
	/** 모든 컬렉션의 휴지통 항목 수. 불러오기 전이면 null. */
	trashCount: number | null;
	refreshTrashCount: () => void;
}

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

/** 사이드바 휴지통 배지를 다시 계산한다(휴지통 이동·복원·영구 삭제 뒤에 부른다). */
export const useAdminNav = (): AdminNavContextValue =>
	useContext(AdminNavContext) ?? { trashCount: null, refreshTrashCount: () => {} };

async function countTrash(): Promise<number> {
	const totals = await Promise.all(
		COLLECTIONS.map(async (collection) => {
			const query = new URLSearchParams({ collection, status: "trashed", pageSize: "25" });
			const data = await cmsFetch<{ total: number }>(cmsApiUrl(`/v1/entries?${query.toString()}`));
			return data.total;
		}),
	);
	return totals.reduce((sum, total) => sum + total, 0);
}

/** 휴지통 배지 상태. 화면의 목록 로직도 이 값을 갱신해야 해서 셸보다 바깥에 둔다. */
export function AdminNavProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const { data } = useQuery({ queryKey: TRASH_COUNT_KEY, queryFn: countTrash });
	const refreshTrashCount = useCallback(
		() => void queryClient.invalidateQueries({ queryKey: TRASH_COUNT_KEY }),
		[queryClient],
	);
	const nav = useMemo(() => ({ trashCount: data ?? null, refreshTrashCount }), [data, refreshTrashCount]);
	return <AdminNavContext.Provider value={nav}>{children}</AdminNavContext.Provider>;
}

/**
 * 목록·미디어·템플릿·휴지통 화면이 함께 쓰는 틀(§3.1). 왼쪽은 shadcn Sidebar(좁은 화면에서는 시트),
 * 오른쪽 위에는 화면 제목을 둔다. 좁은 화면에서는 헤더의 버튼으로 사이드바 시트를 연다.
 */
export function AdminShell({
	title,
	count,
	sidebar,
	headerActions,
	children,
}: {
	title: ReactNode;
	/** 제목 옆에 흐리게 보이는 항목 수. */
	count?: number;
	sidebar: AdminSidebarProps;
	headerActions?: ReactNode;
	children: ReactNode;
}) {
	const nav = useContext(AdminNavContext);
	if (!nav) {
		return (
			<AdminNavProvider>
				<AdminShell title={title} count={count} sidebar={sidebar} headerActions={headerActions}>
					{children}
				</AdminShell>
			</AdminNavProvider>
		);
	}

	return (
		<SidebarProvider className="h-svh overflow-hidden">
			<AdminSidebar {...sidebar} trashCount={nav.trashCount} />
			<SidebarInset className="min-w-0 overflow-hidden">
				<header className="flex h-13 shrink-0 items-center gap-3 border-b px-4 lg:px-5">
					<SidebarTrigger aria-label={t("shell.openSidebar")} className="-ml-1 text-cms-muted-foreground md:hidden" />
					<h1 className="flex min-w-0 flex-1 items-baseline gap-2 truncate font-semibold text-[15px]">
						<span className="truncate">{title}</span>
						{count !== undefined && (
							<span className="tabular font-normal text-cms-muted-foreground text-sm">{count}</span>
						)}
					</h1>
					<div className="flex items-center gap-2">{headerActions}</div>
				</header>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
