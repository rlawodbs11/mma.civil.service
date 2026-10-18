import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// .env가 있으면 읽고 없어도 기본값으로 동작
try {
  const envText = await fs.readFile(path.join(root, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const entriesFile = path.join(dataDir, 'entries.jsonl');
const publicDir = path.join(root, 'public');
const MAX_BODY = 100_000;

function send(res, status, value, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function entriesSince(since) {
  try {
    const text = await fs.readFile(entriesFile, 'utf8');
    return text.split('\n').filter(Boolean).map(JSON.parse)
      .filter((entry) => !since || entry.createdAt > since);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

const staticFiles = {
  '/': { file: 'index.html', mime: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', mime: 'text/html; charset=utf-8' },
  '/style.css': { file: 'style.css', mime: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', mime: 'text/javascript; charset=utf-8' },
  '/image.png': { file: 'image.png', mime: 'image/png' },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 정적 파일 서빙
  if (req.method === 'GET' && staticFiles[url.pathname]) {
    try {
      const { file, mime } = staticFiles[url.pathname];
      const content = await fs.readFile(path.join(publicDir, file));
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      return res.end(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return send(res, 404, { error: 'File not found.' });
      }
      throw err;
    }
  }

  // 텍스트/로그인 캡처 저장 API
  if (req.method === 'POST' && url.pathname === '/api/captures') {
    try {
      const body = await readJson(req);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      const source = typeof body.source === 'string' ? body.source.trim().slice(0, 120) : 'Web Form';

      if (!text) return send(res, 400, { error: '내용을 입력해주세요.' });

      const entry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        source,
        text,
      };

      await fs.mkdir(dataDir, { recursive: true });
      await fs.appendFile(entriesFile, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
      return send(res, 201, { id: entry.id, createdAt: entry.createdAt, message: '저장되었습니다.' });
    } catch (error) {
      return send(res, 400, { error: error instanceof SyntaxError ? 'Invalid JSON.' : error.message });
    }
  }

  // 기록 조회/동기화 API
  if (req.method === 'GET' && url.pathname === '/api/entries') {
    const since = url.searchParams.get('since');
    if (since && Number.isNaN(Date.parse(since))) {
      return send(res, 400, { error: 'Invalid since timestamp.' });
    }
    return send(res, 200, { entries: await entriesSince(since) });
  }

  return send(res, 404, { error: 'Not found.' });
});

await fs.mkdir(dataDir, { recursive: true });
server.listen(port, host, () => {
  console.log(`서버가 시작되었습니다: http://${host}:${port}`);
});
