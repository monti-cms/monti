"use client";

import type { Collection } from "@monti-cms/core/client";
import { useCallback, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "../../ui/sheet";
import { RecordPanel } from "../record-panel";
import { useConfirm } from "../shared/confirm-dialog";
import type { EntryData, EntryFormPatch } from "./entry-form";
import { t } from "./translate";

type Request = { collection: Collection; initial: EntryFormPatch };

/** 저장한 항목을 관계 선택지 모양으로. */
export const optionOf = (saved: EntryData) => ({
	id: saved.id,
	title: String(saved.working?.metadata.title ?? "") || saved.workingSlug || t("untitled"),
	slug: saved.publishedSlug ?? saved.workingSlug ?? null,
});

/**
 * 글 편집 화면에서 분류(태그·카테고리·모음집)를 추가하는 오른쪽 칸. 목록 화면의 분류 칸과 같은 칸을 열어
 * 이름·주소·설명·번역을 한 번에 채운다. `create(...)`는 저장하면 만든 항목으로, 닫으면 null로 풀린다.
 * `sheet`를 화면에 한 번 렌더한다.
 */
export function useRecordCreator() {
	const [request, setRequest] = useState<Request | null>(null);
	const resolveRef = useRef<((saved: EntryData | null) => void) | null>(null);
	const dirtyRef = useRef(false);
	const { confirmDiscard, dialog } = useConfirm();

	const finish = useCallback((saved: EntryData | null) => {
		resolveRef.current?.(saved);
		resolveRef.current = null;
		dirtyRef.current = false;
		setRequest(null);
	}, []);

	const create = useCallback(
		(collection: Collection, initial: EntryFormPatch) =>
			new Promise<EntryData | null>((resolve) => {
				resolveRef.current?.(null);
				resolveRef.current = resolve;
				dirtyRef.current = false;
				setRequest({ collection, initial });
			}),
		[],
	);

	const sheet = (
		<>
			<Sheet
				open={request !== null}
				onOpenChange={(open) => {
					// Esc·바깥 누르기도 칸의 닫기 버튼처럼 저장 안 한 내용을 묻는다.
					if (!open) void confirmDiscard(dirtyRef.current).then((ok) => ok && finish(null));
				}}
			>
				<SheetContent
					showCloseButton={false}
					className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[22rem] data-[side=right]:sm:max-w-none"
				>
					<SheetTitle className="sr-only">{t("record.add")}</SheetTitle>
					{request && (
						<RecordPanel
							target={{ collection: request.collection, id: null }}
							initial={request.initial}
							className="border-l-0"
							onDirtyChange={(dirty) => {
								dirtyRef.current = dirty;
							}}
							onClose={() => finish(null)}
							onSaved={(saved) => finish(saved)}
						/>
					)}
				</SheetContent>
			</Sheet>
			{dialog}
		</>
	);

	return { create, sheet };
}
