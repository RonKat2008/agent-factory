// Feedback link target from Slack messages: records the rating and returns a tiny thank-you page.
import { UUID_RE } from "@/lib/api-util";
import { insertFeedback, logEvent } from "@/lib/repo";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Pitcrew</title>
<style>
:root{color-scheme:light}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F4EF;color:#1c1917;font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box}
main{max-width:440px;width:100%;background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:28px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06)}
h1{font-size:22px;margin:0 0 6px}p{margin:0 0 16px;color:#57534e}
textarea{width:100%;box-sizing:border-box;min-height:96px;border:1px solid #d6d3d1;border-radius:10px;padding:10px;font:inherit;resize:vertical}
textarea:focus{outline:2px solid #1c1917;outline-offset:1px}
button{margin-top:12px;background:#1c1917;color:#fff;border:0;border-radius:10px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:#44403c}button:disabled{opacity:.5;cursor:default}
.brand{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e;margin-bottom:14px}
#status{margin-top:10px;font-size:14px;color:#57534e}
</style></head><body><main><div class="brand">Pitcrew</div>${body}</main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function commentForm(runId: string): string {
  return `<form id="f"><label for="c" style="display:block;font-weight:600;margin-bottom:6px">What was wrong? <span style="font-weight:400;color:#a8a29e">(optional)</span></label>
<textarea id="c" name="comment" maxlength="2000" placeholder="e.g. Only show posts with 100+ points"></textarea>
<button type="submit">Send</button><div id="status" role="status"></div></form>
<script>
document.getElementById("f").addEventListener("submit", async function (e) {
  e.preventDefault();
  var btn = this.querySelector("button"), st = document.getElementById("status"), c = document.getElementById("c").value.trim();
  if (!c) { st.textContent = "Type a comment first."; return; }
  btn.disabled = true; st.textContent = "Sending…";
  try {
    var r = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: ${JSON.stringify(runId)}, rating: "not_useful", comment: c }) });
    if (!r.ok) throw new Error((await r.json()).error || r.status);
    st.textContent = "Got it — Pitcrew will use this to improve the agent.";
  } catch (err) { st.textContent = "Could not send: " + err.message; btn.disabled = false; }
});
</script>`;
}

const BOT_UA_RE = /slackbot|slack-imgproxy|facebookexternalhit|twitterbot|linkedinbot|discordbot|whatsapp|telegrambot|googlebot|bingbot|bot|crawler|preview|spider/i;

export async function GET(request: Request, ctx: { params: Promise<{ runId: string }> }): Promise<Response> {
  const { runId } = await ctx.params;
  const r = new URL(request.url).searchParams.get("r");
  if (!UUID_RE.test(runId) || (r !== "useful" && r !== "not_useful")) {
    return page("Invalid link", "<h1>That link doesn't look right</h1><p>It may have been cut off when copying.</p>", 400);
  }
  if (BOT_UA_RE.test(request.headers.get("user-agent") ?? "")) {
    // Link-preview / crawler fetches must not count as feedback.
    return r === "useful"
      ? page("Thanks", "<h1>Mark as useful</h1><p>Open this link in a browser to record your rating.</p>")
      : page("Thanks", "<h1>Mark as not useful</h1><p>Open this link in a browser to record your rating.</p>");
  }
  try {
    const res = await insertFeedback({ runId, rating: r });
    if (!res) return page("Not found", "<h1>Run not found</h1><p>This message may be from an agent that was deleted.</p>", 404);
    await logEvent(res.agentId, "feedback", r === "useful" ? "👍 Useful" : "👎 Not useful", { runId, rating: r });
  } catch (e) {
    console.error("[f] feedback failed", e);
    return page("Error", "<h1>Something went wrong</h1><p>Please try the link again.</p>", 500);
  }
  return r === "useful"
    ? page("Thanks", "<h1>Thanks — noted.</h1><p>Glad it was useful. The agent keeps doing what it's doing.</p>")
    : page("Thanks", `<h1>Thanks — noted.</h1><p>Sorry it missed. Tell us what to change and Pitcrew will propose an edit.</p>${commentForm(runId)}`);
}
