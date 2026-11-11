import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5-5";
const MAX_SPEC = 6000;          // characters
const LIMIT_PER_HOUR = 20;      // runs per visitor per hour (best effort)
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 3600_000);
  if (list.length >= LIMIT_PER_HOUR) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

function buildPrompt({ spec, users, goal }) {
  return `You are a senior product designer stress-testing a flow before it is designed. Be specific to THIS flow. Do not give generic UX advice (no "make it accessible", "add loading spinners" unless tied to a concrete moment here).

First, restate the flow as 3 to 7 short steps, the way a user experiences it.
Then find 10 to 14 scenarios where the flow could break for real people. Spread them across these kinds:
- "edge": unusual but realistic situations (timing, quantities, people, devices)
- "failure": something goes wrong in the system or with another party
- "waiting": waiting, empty, or in-between states the spec does not describe
- "stuck": moments where a user would be confused, hesitate, or not know what to do
- "assumption": something the spec takes for granted that may not be true

For each scenario give:
- "step": the step number (1-based) where it happens
- "kind": one of the kinds above
- "severity": "high" if a user could lose money, miss the goal, or abandon; "med" if it causes real friction; "low" if minor
- "title": up to 8 words
- "scenario": one or two sentences describing what happens to the user
- "trigger": the part of the spec that leaves this open, in a few words
- "question": one question the designer must answer to handle it

Order scenarios by severity. Do not invent features the spec does not mention; point out the gap instead.

USERS: ${users || "(not given)"}
GOOD OUTCOME: ${goal || "(not given)"}
FLOW SPEC:
"""
${spec}
"""

Reply with only this JSON and nothing else:
{"steps":["..."],"scenarios":[{"step":1,"kind":"edge","severity":"high","title":"...","scenario":"...","trigger":"...","question":"..."}]}`;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  return null;
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_key" }, { status: 500 });

  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (limited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }
  const spec = String(body?.spec || "").trim();
  const users = String(body?.users || "").slice(0, 300);
  const goal = String(body?.goal || "").slice(0, 300);
  if (!spec) return Response.json({ error: "bad_request" }, { status: 400 });
  if (spec.length > MAX_SPEC) return Response.json({ error: "too_long" }, { status: 400 });

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: buildPrompt({ spec, users, goal }) }],
    });
    const text = msg.content.filter(c => c.type === "text").map(c => c.text).join("");
    const data = parseJson(text);
    if (!data) return Response.json({ error: "bad_output" }, { status: 502 });
    return Response.json(data);
  } catch (e) {
    console.error(e);
    const status = e?.status === 429 ? 429 : 502;
    return Response.json({ error: status === 429 ? "rate_limited" : "upstream" }, { status });
  }
}
