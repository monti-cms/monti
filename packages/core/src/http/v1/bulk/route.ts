import { getCmsContentStore } from "../../../container";
import { bulkBodySchema } from "../../../core/api";
import { createBulkService } from "../../../services/bulk-service";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

/** 일괄 작업(§3.4). 항목 단위로 원자적으로 처리하고 성공·실패를 항목별로 돌려준다. */
export const POST = adminRoute(async ({ request }) => {
	const body = parseWith(bulkBodySchema, await readJsonBody(request));
	return json(await createBulkService(getCmsContentStore()).run(body));
});
