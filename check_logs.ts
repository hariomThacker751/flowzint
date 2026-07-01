import fs from "fs";
const logs = JSON.parse(fs.readFileSync("./data/runtime/message-log.json", "utf8"));
let count = 0;
for (let i = logs.length - 1; i >= 0; i--) {
  const log = logs[i];
  if (log.type === "ravi_processed_v3") {
    console.log(JSON.stringify(log.payload, null, 2));
    count++;
    if (count >= 5) break;
  }
}
