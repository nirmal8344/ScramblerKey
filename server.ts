import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("scrambler.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    layout_map TEXT,
    password_buffer TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
  );
`);

// Migrations for new columns
try {
  db.exec("ALTER TABLE sessions ADD COLUMN username_buffer TEXT DEFAULT ''");
} catch (e) {}
try {
  db.exec("ALTER TABLE sessions ADD COLUMN active_field TEXT DEFAULT 'username'");
} catch (e) {}

const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = 3000;

// Keyboard Config
const KEYBOARD_STRUCTURE = [
  ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '⌫'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  ['Ctrl', 'Alt', 'Space', 'Alt', 'Ctrl', '←', '↑', '↓', '→']
];

const NUM_CHARS = "1234567890".split("");
const ALPHA_CHARS = "QWERTYUIOPASDFGHJKLZXCVBNM".split("");

function generateLayout(scramble: boolean = true, isUppercase: boolean = true) {
  let nums = [...NUM_CHARS];
  let alphas = [...ALPHA_CHARS];
  
  if (scramble) {
    nums.sort(() => Math.random() - 0.5);
    alphas.sort(() => Math.random() - 0.5);
  }

  let numIdx = 0;
  let alphaIdx = 0;
  
  const layout = KEYBOARD_STRUCTURE.map(row => 
    row.map(key => {
      if (NUM_CHARS.includes(key)) {
        return nums[numIdx++];
      } else if (ALPHA_CHARS.includes(key)) {
        let char = alphas[alphaIdx++];
        return isUppercase ? char : char.toLowerCase();
      }
      return key;
    })
  );
  return layout;
}

// Middleware to get or create session
const sessionMiddleware = (req: any, res: any, next: any) => {
  let sessionId = req.cookies.sessionId;
  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie("sessionId", sessionId, { httpOnly: true, sameSite: "none", secure: true });
  }

  let session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
  if (!session) {
    const initialLayout = JSON.stringify(generateLayout(true, true));
    db.prepare("INSERT INTO sessions (id, layout_map, expires_at, username_buffer, password_buffer, active_field) VALUES (?, ?, ?, '', '', 'username')")
      .run(sessionId, initialLayout, new Date(Date.now() + 3600000).toISOString());
    session = { id: sessionId, layout_map: initialLayout, username_buffer: "", password_buffer: "", active_field: "username" };
  }
  req.session = session;
  next();
};

// API Routes
app.get("/api/keyboard/layout", sessionMiddleware, (req: any, res) => {
  const scramble = req.query.scramble === 'true';
  const isUppercase = req.query.isUppercase !== 'false';
  const layout = generateLayout(scramble, isUppercase);
  
  db.prepare("UPDATE sessions SET layout_map = ? WHERE id = ?")
    .run(JSON.stringify(layout), req.session.id);
  
  res.json({ layout });
});

app.post("/api/keyboard/input", sessionMiddleware, (req: any, res) => {
  const { x, y, width, height, scramble, isUppercase, keyWidths, rowOffsets, targetField } = req.body;
  const layout = JSON.parse(req.session.layout_map);
  const field = targetField || req.session.active_field || 'username';

  const rowHeight = height / KEYBOARD_STRUCTURE.length;
  const rowIdx = Math.floor(y / rowHeight);

  if (rowIdx >= 0 && rowIdx < KEYBOARD_STRUCTURE.length) {
    const rowWidths = keyWidths[rowIdx];
    const offset = rowOffsets[rowIdx];
    
    let currentX = offset;
    let colIdx = -1;
    for (let i = 0; i < rowWidths.length; i++) {
      if (x >= currentX && x <= currentX + rowWidths[i]) {
        colIdx = i;
        break;
      }
      currentX += rowWidths[i];
    }

    if (colIdx !== -1) {
      const keyLabel = layout[rowIdx][colIdx];
      const originalLabel = KEYBOARD_STRUCTURE[rowIdx][colIdx];
      
      let isAlphanumeric = NUM_CHARS.includes(originalLabel) || ALPHA_CHARS.includes(originalLabel);
      let response: any = { success: true, key: keyLabel };

      const bufferKey = field === 'username' ? 'username_buffer' : 'password_buffer';

      if (isAlphanumeric) {
        const newBuffer = req.session[bufferKey] + keyLabel;
        const newLayout = generateLayout(scramble !== false, isUppercase !== false);
        
        db.prepare(`UPDATE sessions SET ${bufferKey} = ?, layout_map = ? WHERE id = ?`)
          .run(newBuffer, JSON.stringify(newLayout), req.session.id);
        
        response.layout = newLayout;
        response.count = newBuffer.length;
        response.value = field === 'username' ? newBuffer : undefined; // Only return username for display
      } else {
        if (keyLabel === '⌫') {
          const newBuffer = req.session[bufferKey].slice(0, -1);
          db.prepare(`UPDATE sessions SET ${bufferKey} = ? WHERE id = ?`)
            .run(newBuffer, req.session.id);
          response.count = newBuffer.length;
          response.value = field === 'username' ? newBuffer : undefined;
        } else if (keyLabel === 'Space') {
          const newBuffer = req.session[bufferKey] + " ";
          db.prepare(`UPDATE sessions SET ${bufferKey} = ? WHERE id = ?`)
            .run(newBuffer, req.session.id);
          response.count = newBuffer.length;
          response.value = field === 'username' ? newBuffer : undefined;
        }
      }

      res.json(response);
    } else {
      res.status(400).json({ error: "Invalid column" });
    }
  } else {
    res.status(400).json({ error: "Invalid row" });
  }
});

app.post("/api/keyboard/clear", sessionMiddleware, (req: any, res) => {
  const { targetField } = req.body;
  const field = targetField || req.session.active_field || 'username';
  const bufferKey = field === 'username' ? 'username_buffer' : 'password_buffer';
  
  db.prepare(`UPDATE sessions SET ${bufferKey} = '' WHERE id = ?`).run(req.session.id);
  res.json({ success: true });
});

app.post("/api/keyboard/backspace", sessionMiddleware, (req: any, res) => {
  const { targetField } = req.body;
  const field = targetField || req.session.active_field || 'username';
  const bufferKey = field === 'username' ? 'username_buffer' : 'password_buffer';
  
  const current = req.session[bufferKey] || "";
  const updated = current.slice(0, -1);
  db.prepare(`UPDATE sessions SET ${bufferKey} = ? WHERE id = ?`).run(updated, req.session.id);
  res.json({ success: true, count: updated.length, value: field === 'username' ? updated : undefined });
});

app.post("/api/auth", sessionMiddleware, async (req: any, res) => {
  const { isSignup } = req.body;
  const username = req.session.username_buffer;
  const password = req.session.password_buffer;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Both username and password must be typed using the secure keyboard" });
  }

  if (isSignup) {
    const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }
    const hash = await bcrypt.hash(password, 10);
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)")
      .run(uuidv4(), username, hash);
    
    // Clear buffers
    db.prepare("UPDATE sessions SET password_buffer = '', username_buffer = '' WHERE id = ?").run(req.session.id);
    
    return res.json({ success: true, message: "Account created successfully!" });
  } else {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    // Clear buffers
    db.prepare("UPDATE sessions SET password_buffer = '', username_buffer = '' WHERE id = ?").run(req.session.id);

    if (isValid) {
      return res.json({ success: true, message: "Welcome back!" });
    } else {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  }
});

app.get("/api/admin/users", (req, res) => {
  const users = db.prepare("SELECT username, password_hash FROM users").all();
  res.json(users);
});

// Vite integration
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
