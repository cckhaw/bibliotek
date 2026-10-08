// Run a background job locally / from any scheduler without HTTP:  npm run job -- reminders
import { JOBS, type JobName } from "../src/lib/services/jobs";

const name = process.argv[2] as JobName;
if (!(name in JOBS)) {
  console.error(`Usage: npm run job -- <${Object.keys(JOBS).join("|")}>`);
  process.exit(1);
}
const result = await JOBS[name]();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
