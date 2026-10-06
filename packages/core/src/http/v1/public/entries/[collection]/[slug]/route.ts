import type { Cms } from "../../../../../../cms";
import { getOne } from "../../../entries";

export const GET = async (
	request: Request,
	context: { params?: Promise<{ collection: string; slug: string }>; cms: Cms },
) => getOne(request, (await context.params) ?? { collection: "", slug: "" }, context.cms);
