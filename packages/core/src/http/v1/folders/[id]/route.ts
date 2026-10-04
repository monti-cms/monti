import { getCmsContentStore } from "../../../../container";
import { updateFolderBodySchema } from "../../../../core/api";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler";

type IdParams = { id: string };

/** 삭제 전 미리보기: 직접 속한 글 수와 자식 폴더(§3.3). */
export const GET = adminRoute<IdParams>(async ({ params }) =>
	json(await getCmsContentStore().getFolderContents({ id: params.id })),
);

/** 이름 변경·순서 변경·폴더 이동. 순환 구조와 같은 부모 안의 중복 이름을 거부한다. */
export const PATCH = adminRoute<IdParams>(async ({ request, params }) => {
	const body = await readVersionedBody(request, updateFolderBodySchema);
	return json(await getCmsContentStore().updateFolder({ id: params.id, ...body }));
});

/** 폴더 삭제. 직접 속한 글과 자식 폴더는 부모로 옮기고 글은 삭제하지 않는다. */
export const DELETE = adminRoute<IdParams>(async ({ request, params }) => {
	await getCmsContentStore().deleteFolder({ id: params.id, expectedVersion: readVersionQuery(request) });
	return json({ success: true });
});
