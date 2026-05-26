require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

console.log("🚀 Starting Village SaaS API...");

// =====================
// DATABASE CONNECTION
// =====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =====================
// IN-MEMORY USERS
// =====================
const USERS = [];

// =====================
// HEALTH CHECK (NEW)
// =====================
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "API is healthy 🚀" });
});

// =====================
// CREATE USER (POST)
// =====================
app.post("/create-user", (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: "Name and email required"
    });
  }

  const apiKey = "ak_" + Math.random().toString(36).substring(2, 15);

  const user = {
    name,
    email,
    apiKey,
    used: 0,
    limit: 1000
  };

  USERS.push(user);

  res.json({
    success: true,
    message: "User created successfully",
    api_key: apiKey,
    user
  });
});

// =====================
// QUICK TEST USER (GET)
// =====================
app.get("/create-user", (req, res) => {
  const apiKey = "ak_" + Math.random().toString(36).substring(2, 15);

  const user = {
    name: "Demo User",
    email: "demo@gmail.com",
    apiKey,
    used: 0,
    limit: 1000
  };

  USERS.push(user);

  res.json({
    success: true,
    message: "User created (GET test)",
    api_key: apiKey,
    user
  });
});

// =====================
// VIEW USERS (NEW)
// =====================
app.get("/users", (req, res) => {
  res.json({
    count: USERS.length,
    users: USERS
  });
});

// =====================
// AUTH MIDDLEWARE
// =====================
function authenticate(req, res, next) {
  const key = req.headers["x-api-key"];

  const user = USERS.find(u => u.apiKey === key);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid API Key"
    });
  }

  if (user.used >= user.limit) {
    return res.status(403).json({
      success: false,
      message: "API limit exceeded"
    });
  }

  req.user = user;
  next();
}

// =====================
// ROOT
// =====================
app.get("/", (req, res) => {
  res.send("Village SaaS API Running 🚀");
});

// =====================
// TEST SEARCH (NO KEY)
// =====================
app.get("/search-test", async (req, res) => {
  const q = req.query.q;

  if (!q) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT *
       FROM villages
       WHERE village_name ILIKE $1
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json(result.rows);

  } catch (error) {
    console.error("TEST ERROR:", error.message);
    res.status(500).json({ error: "Test search failed" });
  }
});

// =====================
// 🔎 SEARCH API
// =====================
app.get("/search", authenticate, async (req, res) => {
  const q = req.query.q;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: "Query required"
    });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM villages
       WHERE village_name ILIKE $1
          OR subdistrict_name ILIKE $1
          OR district_name ILIKE $1
          OR state_name ILIKE $1
       ORDER BY village_name
       LIMIT 20`,
      [`%${q}%`]
    );

    req.user.used++;

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      usage: {
        used: req.user.used,
        limit: req.user.limit
      }
    });

  } catch (error) {
    console.error("SEARCH ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Database error",
      error: error.message
    });
  }
});

// =====================
// ⚡ AUTOCOMPLETE API
// =====================
app.get("/autocomplete", authenticate, async (req, res) => {
  const q = req.query.q;

  if (!q) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT village_name, subdistrict_name, district_name, state_name
       FROM villages
       WHERE village_name ILIKE $1
          OR district_name ILIKE $1
          OR state_name ILIKE $1
       ORDER BY village_name
       LIMIT 10`,
      [`%${q}%`]
    );

    req.user.used++;

    const formatted = result.rows.map(v => {
      const clean = v.village_name.replace(/\s*\(\d+\)/g, "");

      return {
        label: clean,
        full: `${clean}, ${v.subdistrict_name}, ${v.district_name}, ${v.state_name}, India`
      };
    });

    res.json({
      success: true,
      data: formatted
    });

  } catch (error) {
    console.error("AUTO ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});