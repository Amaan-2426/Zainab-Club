
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = readline.createInterface({ input: stdin, output: stdout });

try {
  const password = await rl.question("Enter a strong admin password: ");

  if (password.length < 12) {
    throw new Error("Use a password with at least 12 characters.");
  }

  const salt = crypto.randomBytes(16).toString("hex");

  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");

  console.log("\nSave this hash in backend/.env as ADMIN_PASSWORD_HASH:");
  console.log(`scrypt:${salt}:${derivedKey}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
