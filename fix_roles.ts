import { getDatabase } from "./lib/server/database";

const db = getDatabase();
const res = db.prepare("UPDATE chat_messages SET role = 'assistant' WHERE role = 'owner'").run();
console.log("Updated rows:", res.changes);
