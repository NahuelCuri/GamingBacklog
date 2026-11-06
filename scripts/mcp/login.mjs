// One-time sign-in for the local MCP server: `npm run mcp:login` (or `-- --logout`).
// Asks for your email and password here, in your terminal; only the session is saved.
import { createInterface } from "node:readline";
import { makeClient, SESSION_FILE } from "./client.mjs";

const sb = makeClient();

if (process.argv.includes("--logout")) {
  await sb.auth.signOut();
  console.log("Signed out; session removed.");
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (q) => new Promise((res) => rl.question(q, res));
// Typed password isn't echoed: the prompt is written once, keystrokes are swallowed.
function askHidden(q) {
  process.stdout.write(q);
  const write = rl._writeToOutput;
  rl._writeToOutput = () => {};
  return new Promise((res) =>
    rl.question("", (a) => {
      rl._writeToOutput = write;
      process.stdout.write("\n");
      res(a);
    }),
  );
}

const email = (await ask("Email: ")).trim();
const password = await askHidden("Password: ");
rl.close();

const { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error) {
  console.error("Sign-in failed:", error.message);
  process.exit(1);
}
console.log(`Signed in as ${data.user.email}. Session saved to ${SESSION_FILE}.`);
