import "dotenv/config";
import express, { Request, Response } from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// User model (V1 - in memory, later Postgres)
type User = {
  id: string;
  zeta_address?: string;
  risk_profile?: "low" | "medium" | "high";
  time_horizon?: "short" | "medium" | "long";
  style?: string;
};

const users = new Map<string, User>();

// POST /users - Create user profile
app.post("/users", (req: Request, res: Response) => {
  const { zeta_address, risk_profile, time_horizon, style } = req.body || {};
  const id = crypto.randomUUID();
  const user: User = { id, zeta_address, risk_profile, time_horizon, style };
  users.set(id, user);
  res.status(201).json(user);
});

// GET /users/:id - Get user profile
app.get("/users/:id", (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

// POST /investor/query - ProfileOS main endpoint
app.post("/investor/query", async (req: Request, res: Response) => {
  const { user_id, question } = req.body || {};
  
  if (!user_id || !question) {
    res.status(400).json({ error: "user_id and question are required" });
    return;
  }

  const user = users.get(user_id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const systemPrompt = `You are ProfileOS - a personal investing brain for this user.
You know their profile and help them make decisions based on THEIR history and style, not generic advice.

User Profile:
- Risk tolerance: ${user.risk_profile || "not set"}
- Time horizon: ${user.time_horizon || "not set"}
- Style: ${user.style || "not set"}

Guidelines:
- Be personal and direct
- Reference their style when relevant
- Answer in the same language as the question
- If they ask about a trade, consider their risk profile`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ]
  });

  const answer = completion.choices[0].message.content;
  const interaction_id = crypto.randomUUID();

  res.json({ answer, interaction_id, user_id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ProfileOS API running on port ${PORT}`);
});
