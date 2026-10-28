import { adminRoute, ok } from "../../handler";

/** Deletes everything at the top of the trash for good. What entries still point at stays, with the reason. */
export const POST = adminRoute(async ({ cms }) => ok(await cms.trashService().empty()));
