// Seeds the 3 demo agents through the running app: POST ${APP_URL}/api/demo/seed?key=${ADMIN_KEY}.
// Usage: npm run db:seed [-- --url https://prod.example.com]
const argIdx = process.argv.indexOf("--url");
const base = (argIdx > -1 ? process.argv[argIdx + 1] : process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const key = process.env.ADMIN_KEY;
if (!key) {
  console.error("seed: ADMIN_KEY is not set (.env.local)");
  process.exit(1);
}
const res = await fetch(`${base}/api/demo/seed?key=${encodeURIComponent(key)}`, { method: "POST" });
const text = await res.text();
console.log(`seed: ${res.status} ${base}`);
console.log(text);
if (!res.ok) process.exit(1);
