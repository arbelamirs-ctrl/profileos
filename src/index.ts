import "dotenv/config";
import express, { Request, Response } from "express";
import OpenAI from "openai";
import Database from "better-sqlite3";

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const db = new Database("profileos.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    zeta_address TEXT,
    risk_profile TEXT,
    time_horizon TEXT,
    style TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    question TEXT,
    answer TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

app.post("/users", (req: Request, res: Response) => {
  const { zeta_address, risk_profile, time_horizon, style } = req.body || {};
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, zeta_address, risk_profile, time_horizon, style) VALUES (?, ?, ?, ?, ?)").run(id, zeta_address, risk_profile, time_horizon, style);
  res.status(201).json({ id, zeta_address, risk_profile, time_horizon, style });
});

app.get("/users/:id", (req: Request, res: Response) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

app.get("/users/:id/interactions", (req: Request, res: Response) => {
  const interactions = db.prepare("SELECT * FROM interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").all(req.params.id);
  res.json(interactions);
});

app.post("/investor/query", async (req: Request, res: Response) => {
  const { user_id, question } = req.body || {};
  if (!user_id || !question) { res.status(400).json({ error: "user_id and question required" }); return; }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id) as any;
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const recent = db.prepare("SELECT question, answer FROM interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5").all(user_id) as any[];
  const history = recent.length > 0 ? "\nRecent:\n" + recent.reverse().map(i => "Q:" + i.question + "\nA:" + i.answer).join("\n") : "";
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "ProfileOS. User: Risk=" + (user.risk_profile || "?") + ", Horizon=" + (user.time_horizon || "?") + ", Style=" + (user.style || "?") + history },
      { role: "user", content: question }
    ]
  });
  const answer = completion.choices[0].message.content || "";
  const interaction_id = crypto.randomUUID();
  db.prepare("INSERT INTO interactions (id, user_id, question, answer) VALUES (?, ?, ?, ?)").run(interaction_id, user_id, question, answer);
  res.json({ answer, interaction_id, user_id });
});

app.listen(3000, () => console.log("ProfileOS API running on port 3000"));
