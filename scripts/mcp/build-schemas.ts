// Writes supabase/functions/_shared/collections.json for the MCP tools. Run: `npm run mcp:schemas`.
import { writeFileSync } from "node:fs";
import { SCHEMAS_FILE, schemasJson } from "./schemas";

writeFileSync(SCHEMAS_FILE, schemasJson());
console.log(`Wrote ${SCHEMAS_FILE}`);
