import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";

// --- CONFIG & CONSTANTS ---
const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const db = new Database("safemind.db");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- DB INITIALIZATION (Simulating Firestore) ---
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS aggregates_daily (
    id TEXT PRIMARY KEY,
    teamId TEXT,
    date TEXT,
    stressUrgencyScore REAL,
    hostilityScore REAL,
    offHoursRate REAL,
    moodIndexNeg REAL,
    cognitiveLoadScore REAL,
    replyAnxietyScore REAL,
    messageCount INTEGER,
    moodState TEXT
  );

  CREATE TABLE IF NOT EXISTS topics_daily (
    id TEXT PRIMARY KEY,
    teamId TEXT,
    date TEXT,
    topic TEXT,
    count INTEGER
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    teamId TEXT,
    timestamp TEXT,
    severity TEXT,
    kpi TEXT,
    message TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    action TEXT,
    details TEXT
  );
`);

// Seed Teams
const teams = ["Marketing", "IT", "HR", "Sales", "Operations"];
const insertTeam = db.prepare("INSERT OR IGNORE INTO teams (id, name) VALUES (?, ?)");
teams.forEach(t => insertTeam.run(`Team_${t}`, t));

// Default Config
const insertConfig = db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)");
insertConfig.run("disconnection_start", "20:00");
insertConfig.run("disconnection_end", "08:00");
insertConfig.run("weekend_protection", "true");

// --- UTILS ---
function hashSender(senderId: string) {
  return crypto.createHash("sha256").update(senderId).digest("hex");
}

function maskNER(text: string) {
  // Simple regex-based masking for demo
  return text
    .replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, "[NAME]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/g, "[EMAIL]")
    .replace(/\b\d{10}\b/g, "[PHONE]");
}

// --- AI LOGIC ---
async function analyzeWithGemini(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this team message for sentiment and topic. 
      Return JSON only: { "sentiment": "pos"|"neu"|"neg", "intensity": 0-1, "topic": "string" }
      Message: "${text}"`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{"sentiment":"neu","intensity":0,"topic":"General"}');
  } catch (e) {
    // Fallback heuristic
    return { sentiment: "neu", intensity: 0.5, topic: "General" };
  }
}

// --- WEBHOOK ENDPOINT ---
async function startServer() {
  const app = express();
  app.use(express.json());

  // API: Webhook
  app.post("/api/webhook/chat", async (req, res) => {
    const { messageId, timestamp, senderId, teamId, text } = req.body;
    
    // 1. Privacy: Hash Sender
    const hashedSenderId = hashSender(senderId);
    
    // 2. Privacy: NER Masking
    const maskedText = maskNER(text);
    
    // 3. AI Analysis (Zero-Storage: text is only in RAM)
    const aiResult = await analyzeWithGemini(maskedText);
    
    // 4. KPI Heuristics
    const stressWords = ["urgente", "asap", "emergenza", "panico", "subito", "deadline"];
    const stressScore = stressWords.some(w => maskedText.toLowerCase().includes(w)) ? 0.8 : 0.1;
    
    const hostilityScore = (maskedText.match(/[A-Z]{3,}/g) || []).length > 0 ? 0.6 : 0.1;
    
    const hour = new Date(timestamp).getHours();
    const isOffHours = hour >= 20 || hour < 8;
    
    // 5. Update Aggregates (Daily bucket)
    const date = new Date(timestamp).toISOString().split("T")[0];
    const aggId = `${teamId}_${date}`;
    
    const existing = db.prepare("SELECT * FROM aggregates_daily WHERE id = ?").get(aggId) as any;
    
    if (existing) {
      db.prepare(`
        UPDATE aggregates_daily SET 
          stressUrgencyScore = (stressUrgencyScore * messageCount + ?) / (messageCount + 1),
          hostilityScore = (hostilityScore * messageCount + ?) / (messageCount + 1),
          messageCount = messageCount + 1,
          moodIndexNeg = (moodIndexNeg * messageCount + ?) / (messageCount + 1)
        WHERE id = ?
      `).run(stressScore, hostilityScore, aiResult.sentiment === "neg" ? aiResult.intensity : 0, aggId);
    } else {
      db.prepare(`
        INSERT INTO aggregates_daily (id, teamId, date, stressUrgencyScore, hostilityScore, offHoursRate, moodIndexNeg, cognitiveLoadScore, replyAnxietyScore, messageCount, moodState)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(aggId, teamId, date, stressScore, hostilityScore, isOffHours ? 1 : 0, aiResult.sentiment === "neg" ? aiResult.intensity : 0, 0.2, 0.1, 1, "Sereno");
    }

    // Update Topics
    const topicId = `${teamId}_${date}_${aiResult.topic}`;
    db.prepare("INSERT INTO topics_daily (id, teamId, date, topic, count) VALUES (?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET count = count + 1").run(topicId, teamId, date, aiResult.topic);

    // Audit Log
    db.prepare("INSERT INTO audit_logs (id, timestamp, action, details) VALUES (?, ?, ?, ?)")
      .run(crypto.randomUUID(), new Date().toISOString(), "MESSAGE_PROCESSED", `Team: ${teamId}, Sender: ${hashedSenderId.substring(0,8)}...`);

    res.json({ status: "processed" });
  });

  // API: Get Aggregates
  app.get("/api/dashboard", (req, res) => {
    const data = db.prepare("SELECT * FROM aggregates_daily ORDER BY date DESC LIMIT 100").all();
    const alerts = db.prepare("SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 10").all();
    const teams = db.prepare("SELECT * FROM teams").all();
    res.json({ aggregates: data, alerts, teams });
  });

  app.get("/api/audit", (req, res) => {
    const logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50").all();
    res.json(logs);
  });

  app.get("/api/topics", (req, res) => {
    const topics = db.prepare("SELECT topic, SUM(count) as total FROM topics_daily GROUP BY topic ORDER BY total DESC").all();
    res.json(topics);
  });

  // Vite integration
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SafeMind AI Server running on http://localhost:${PORT}`);
  });
}

// --- SEEDER (14 Days) ---
function seedData() {
  const check = db.prepare("SELECT COUNT(*) as count FROM aggregates_daily").get() as any;
  if (check.count > 0) return;

  console.log("Seeding 14 days of simulated data...");
  const teams = ["Team_Marketing", "Team_IT", "Team_HR", "Team_Sales", "Team_Operations"];
  const now = new Date();

  for (let i = 14; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    teams.forEach(teamId => {
      let stress = 0.1 + Math.random() * 0.2;
      let offHours = Math.random() * 0.15;
      let moodNeg = 0.1 + Math.random() * 0.2;
      let cogLoad = 0.2 + Math.random() * 0.3;
      let hostility = 0.05 + Math.random() * 0.1;

      // Marketing "Progetto Alpha" Crisis Pattern
      if (teamId === "Team_Marketing" && i < 7) {
        stress += 0.4;
        offHours += 0.3;
        moodNeg += 0.3;
        cogLoad += 0.3;
        
        // Add Topic
        db.prepare("INSERT INTO topics_daily (id, teamId, date, topic, count) VALUES (?, ?, ?, ?, ?)")
          .run(`${teamId}_${dateStr}_Alpha`, teamId, dateStr, "Progetto Alpha", 45 + Math.floor(Math.random() * 20));
      }

      const aggId = `${teamId}_${dateStr}`;
      db.prepare(`
        INSERT INTO aggregates_daily (id, teamId, date, stressUrgencyScore, hostilityScore, offHoursRate, moodIndexNeg, cognitiveLoadScore, replyAnxietyScore, messageCount, moodState)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(aggId, teamId, dateStr, stress, hostility, offHours, moodNeg, cogLoad, 0.15, 100 + Math.floor(Math.random() * 50), moodNeg > 0.5 ? "Critico" : moodNeg > 0.3 ? "Teso" : "Sereno");

      // Random Alerts
      if (stress > 0.6) {
        db.prepare("INSERT INTO alerts (id, teamId, timestamp, severity, kpi, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(crypto.randomUUID(), teamId, date.toISOString(), "HIGH", "Stress & Urgency", `Anomalia stress rilevata nel team ${teamId}`, "OPEN");
      }
    });
  }
}

seedData();
startServer();
