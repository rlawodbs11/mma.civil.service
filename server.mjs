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
  res.end(JSON.stringify(value, null, 2));
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

  // 기록 조회/동기화 API 및 웹 화면
  if (req.method === 'GET' && (url.pathname === '/api/entries' || url.pathname === '/entries')) {
    const since = url.searchParams.get('since');
    const format = url.searchParams.get('format');
    if (since && Number.isNaN(Date.parse(since))) {
      return send(res, 400, { error: 'Invalid since timestamp.' });
    }
    const entries = await entriesSince(since);

    // 브라우저에서 직접 접속했을 때 (HTML 요청이고 ?format=json이 아닌 경우) -> 깔끔한 줄바꿈 카드 화면 제공
    const isBrowser = req.headers.accept && req.headers.accept.includes('text/html') && format !== 'json';
    if (isBrowser) {
      const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>기록된 로그인 목록</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 24px 16px; }
    .container { max-width: 650px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    h1 { font-size: 22px; color: #111; margin: 0; }
    .badge { background: #03c75a; color: white; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: bold; }
    .card { background: #ffffff; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e3e5e8; }
    .card-top { display: flex; justify-content: space-between; font-size: 13px; color: #777; margin-bottom: 12px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; }
    .source-tag { background: #e8f7ee; color: #03c75a; padding: 2px 8px; border-radius: 6px; font-weight: 600; font-size: 12px; }
    .content-box { white-space: pre-wrap; font-size: 15px; color: #222; line-height: 1.7; word-break: break-all; background: #fbfbfb; padding: 14px 16px; border-radius: 8px; border: 1px solid #f0f0f0; font-family: inherit; }
    .empty { text-align: center; color: #888; padding: 60px 0; font-size: 16px; }
    .footer { text-align: center; margin-top: 30px; font-size: 13px; }
    .footer a { color: #03c75a; text-decoration: none; font-weight: 500; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 로그인 기록 관리자</h1>
      <span class="badge">총 ${entries.length}건</span>
    </div>
    ${entries.length === 0 ? '<div class="empty">아직 기록된 내용이 없습니다.</div>' : ''}
    ${entries.map(e => `
      <div class="card">
        <div class="card-top">
          <span>🕒 ${new Date(e.createdAt).toLocaleString('ko-KR')}</span>
          <span class="source-tag">${escapeHtml(e.source || '웹 폼')}</span>
        </div>
        <div class="content-box">${escapeHtml(e.text)}</div>
      </div>
    `).reverse().join('')}
    <div class="footer">
      <a href="?format=json">JSON 원본 데이터 보기</a>
    </div>
  </div>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }

    return send(res, 200, { entries });
  }

  return send(res, 404, { error: 'Not found.' });
});

await fs.mkdir(dataDir, { recursive: true });
server.listen(port, host, () => {
  console.log(`서버가 시작되었습니다: http://${host}:${port}`);
});
