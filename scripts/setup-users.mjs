// Provisions the app's seven accounts. Safe to re-run anytime: existing users
// are updated (role/limit/display name) but their passwords are NOT reset —
// pass --reset-passwords to also restore every password to the documented one.
//
// The storage split: 6 members × 75 MB + 1 trial × 50 MB = 500 MB (the free
// Neon database). Change a user's slice here if you ever rebalance.
//
// SECURITY: passwords are NOT stored in this file (it lives in the GitHub
// repo). They're read from ../USERS-AND-PASSWORDS.md — the private credentials
// sheet one folder above the repo — which is where they're documented anyway.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// Roles + storage shares (public knowledge; fine to keep in the repo).
const USERS = [
  { username: "mays",   displayName: "Mays",    role: "member", storageLimitMb: 75 },
  { username: "medic1", displayName: "Medic 1", role: "member", storageLimitMb: 75 },
  { username: "medic2", displayName: "Medic 2", role: "member", storageLimitMb: 75 },
  { username: "medic3", displayName: "Medic 3", role: "member", storageLimitMb: 75 },
  { username: "medic4", displayName: "Medic 4", role: "member", storageLimitMb: 75 },
  { username: "medic5", displayName: "Medic 5", role: "member", storageLimitMb: 75 },
  { username: "guest",  displayName: "Guest",   role: "trial",  storageLimitMb: 50 },
];

// Read passwords from the credentials sheet's markdown table:
//   | `username` | `password` | ... |
function loadPasswords() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sheet = path.resolve(here, "..", "..", "USERS-AND-PASSWORDS.md");
  if (!fs.existsSync(sheet)) {
    console.error(`Couldn't find the credentials sheet at ${sheet}.`);
    console.error("It must contain a table with | `username` | `password` | rows.");
    process.exit(1);
  }
  const text = fs.readFileSync(sheet, "utf8");
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

const passwords = loadPasswords();
const resetPasswords = process.argv.includes("--reset-passwords");

for (const u of USERS) {
  const pw = passwords.get(u.username);
  const existing = await prisma.user.findUnique({ where: { username: u.username } });
  if (!existing && !pw) {
    console.error(`No password for new user "${u.username}" in the credentials sheet — skipping.`);
    continue;
  }
  const passwordHash = pw ? bcrypt.hashSync(pw, 10) : undefined;
  await prisma.user.upsert({
    where: { username: u.username },
    update: {
      role: u.role,
      storageLimitMb: u.storageLimitMb,
      displayName: u.displayName,
      ...(resetPasswords && passwordHash ? { passwordHash } : {}),
    },
    create: { username: u.username, displayName: u.displayName, passwordHash, role: u.role, storageLimitMb: u.storageLimitMb },
  });
  console.log(`user ready: ${u.username} (${u.role}, ${u.storageLimitMb} MB)`);
}

const total = USERS.reduce((s, u) => s + u.storageLimitMb, 0);
console.log(`total allocated: ${total} MB. Run "npm run seed" to give empty accounts the starter deck.`);
await prisma.$disconnect();
