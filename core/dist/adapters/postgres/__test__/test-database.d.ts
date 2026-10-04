import { Pool } from "pg";
export declare function createIsolatedTestPool(): Promise<{
    pool: Pool;
    schemaName: string;
}>;
export declare function dropIsolatedTestPool(pool: Pool, schemaName: string): Promise<void>;
export declare function closeGlobalPool(): Promise<void>;
