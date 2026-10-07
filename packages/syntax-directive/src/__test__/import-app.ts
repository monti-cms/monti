import { createImportCms } from "./import-harness";

/** The config module the CLI test loads with `--config`: the CMS of the schema named by `MONTI_IMPORT_TEST_SCHEMA`. */
export const cms = createImportCms(process.env.MONTI_IMPORT_TEST_SCHEMA ?? "public");
