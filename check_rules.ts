import fs from "fs";
import { loadEnv } from "./lib/server/envLoader";
loadEnv();
import { getDatabase } from "./lib/server/database";
const db = getDatabase();
const rules = db.prepare("SELECT * FROM knowledge_base WHERE type = 'conversation_rule'").all();
console.log(rules);
