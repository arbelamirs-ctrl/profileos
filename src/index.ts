import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

type User = { id: string; zeta_address?: string; risk_profile?: string; };
const users = new Map<string, User>();

app.post("/users", (req: Request, res: Response) => {
  const { zeta_address, risk_profile } = req.body || {};
  const id = crypto.randomUUID();
  const user: User = { id, zeta_address, risk_profile };
  users.set(id, user);
  res.status(201).json(user);
});

app.post("/investor/query", (req: Request, res: Response) => {
  const { user_id, question } = req.body || {};
  if (!user_id || !question) { res.status(400).json({ error: "user_id and question required" }); return; }
  const user = users.get(user_id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ user_id, question, answer: "Echo: " + question });
});

app.listen(3000, () => console.log("ProfileOS API on port 3000"));
