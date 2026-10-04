import { getCmsContentStore } from "../../../../../container.js";
import { versionBodySchema } from "../../../../../core/api.js";
import { adminRoute, json, readVersionedBody } from "../../../handler.js";
/** Draft/published → archived. Ends publication. */
export const POST = adminRoute(async ({ request, params }) => {
    const { expectedVersion } = await readVersionedBody(request, versionBodySchema);
    return json(await getCmsContentStore().archiveEntry({ id: params.id, expectedVersion }));
});
