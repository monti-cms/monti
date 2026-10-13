import { publicRoute } from "../../../../handler";
import { getOne } from "../../../entries";

export const GET = publicRoute<{ collection: string; slug: string }>(({ request, params, cms }) =>
	getOne(request, params, cms),
);
