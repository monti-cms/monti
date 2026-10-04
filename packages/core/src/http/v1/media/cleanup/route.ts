import { getCmsContentStore, getCmsMediaStore } from "../../../../container";
import { adminRoute, json } from "../../handler";

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * 24시간이 지난 미완료·실패 업로드를 정리한다(§7.2 관리자 정리 작업). 외부 Cron은 필요 없다.
 * 파일 삭제가 실패한 항목은 남겨 다음 정리에서 다시 시도한다.
 */
export const POST = adminRoute(async () => {
	const store = getCmsContentStore();
	const mediaStore = getCmsMediaStore();
	const stale = await store.listStaleUploads({ before: new Date(Date.now() - STALE_AFTER_MS) });
	let removed = 0;
	const failed: string[] = [];
	for (const media of stale) {
		try {
			for (const key of [media.stagingKey, media.original?.stagingKey]) {
				if (key) await mediaStore.deleteFile({ key });
			}
			await store.finalizeMediaDelete(media.id);
			removed += 1;
		} catch {
			failed.push(media.id);
		}
	}
	return json({ removed, failed });
});
