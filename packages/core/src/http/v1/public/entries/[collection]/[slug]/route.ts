import type { NextRequest } from "next/server";
import type { Cms } from "../../../../../../cms";
import { getOne } from "../../../entries";

export const GET = async (
	request: NextRequest,
	context: { params?: Promise<{ collection: string; slug: string }>; cms: Cms },
) => getOne(request, (await context.params) ?? { collection: "", slug: "" }, context.cms);
