import type { NextRequest } from "next/server";
import { getOne } from "../../../entries";

export const GET = async (request: NextRequest, context?: { params: Promise<{ collection: string; slug: string }> }) =>
	getOne(request, (await context?.params) ?? { collection: "", slug: "" });
