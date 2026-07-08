const express = require('express');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

const WPS_CLIENT_ID = process.env.WPS_CLIENT_ID || '';
const WPS_CLIENT_SECRET = process.env.WPS_CLIENT_SECRET || '';
const API_BASE = 'https://openapi.wps.cn';
const basicAuth = Buffer.from(WPS_CLIENT_ID + ':' + WPS_CLIENT_SECRET).toString('base64');

app.use(express.json());

// ============================================================
// 原生 HTTPS 请求函数
// ============================================================
function httpsRequest(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? Buffer.from(body) : null;
    const options = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
    };
    if (data) options.headers['Content-Length'] = data.length;
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(text)); }
        catch (e) { resolve({ error: 'parse_error', raw: text }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function toFormBody(params) {
  return Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v || ''))
    .join('&');
}

// ============================================================
// API 路由（放在静态文件中间件之前）
// ============================================================

// 获取应用 token（用于操作多维表）
async function getAppToken() {
  const body = toFormBody({
    client_id: WPS_CLIENT_ID, client_secret: WPS_CLIENT_SECRET,
    grant_type: 'client_credentials', scope: 'kso.dbsheet.readwrite',
  });
  const data = await httpsRequest(`${API_BASE}/oauth2/token`, 'POST', body, {
    'Authorization': 'Basic ' + basicAuth,
  });
  if (!data.access_token) throw new Error(JSON.stringify(data));
  return data.access_token;
}

// 交换 OAuth code → access_token
app.post('/api/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    const body = toFormBody({
      client_id: WPS_CLIENT_ID, client_secret: WPS_CLIENT_SECRET,
      grant_type: 'authorization_code', code, redirect_uri,
    });
    const data = await httpsRequest(`${API_BASE}/oauth2/token`, 'POST', body, {
      'Authorization': 'Basic ' + basicAuth,
    });
    if (data.access_token) {
      res.json({ ok: true, access_token: data.access_token, refresh_token: data.refresh_token || '' });
    } else {
      res.json({ ok: false, error: JSON.stringify(data) });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 获取当前用户
app.get('/api/user/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ ok: false, error: '未提供令牌' });
    const data = await httpsRequest(`${API_BASE}/v7/user/me`, 'GET', null, {
      'Authorization': 'Bearer ' + token,
    });
    if (data.code === 0) res.json({ ok: true, data: data.data });
    else res.json({ ok: false, error: data.msg });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 刷新 token
app.post('/api/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const body = toFormBody({
      client_id: WPS_CLIENT_ID, client_secret: WPS_CLIENT_SECRET,
      grant_type: 'refresh_token', refresh_token,
    });
    const data = await httpsRequest(`${API_BASE}/oauth2/token`, 'POST', body, {
      'Authorization': 'Basic ' + basicAuth,
    });
    if (data.access_token) res.json({ ok: true, access_token: data.access_token, refresh_token: data.refresh_token || '' });
    else res.json({ ok: false, error: JSON.stringify(data) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 列出多维表记录
app.post('/api/dbsheet/records', async (req, res) => {
  try {
    const { file_id, sheet_id, page_size } = req.body;
    const token = await getAppToken();
    const url = `${API_BASE}/v7/coop/dbsheet/${file_id}/sheets/${sheet_id || 2}/records/list?page_size=${page_size || 100}`;
    const data = await httpsRequest(url, 'GET', null, {
      'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
    });
    if (data.code === 0) res.json({ ok: true, data: data.data });
    else res.json({ ok: false, error: data.msg });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 更新多维表记录
app.post('/api/dbsheet/records/update', async (req, res) => {
  try {
    const { file_id, sheet_id, records } = req.body;
    const token = await getAppToken();
    const data = await httpsRequest(
      `${API_BASE}/v7/coop/dbsheet/${file_id}/sheets/${sheet_id || 2}/records/update`,
      'POST', JSON.stringify({ records }), {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      }
    );
    if (data.code === 0) res.json({ ok: true, data: data.data });
    else res.json({ ok: false, error: data.msg });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============================================================
// 静态文件 + SPA 降级
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`座位预约系统后端已启动，端口: ${PORT}`);
  console.log(`CLIENT_ID: ${WPS_CLIENT_ID ? '已设置' : '未设置'}`);
  console.log(`CLIENT_SECRET: ${WPS_CLIENT_SECRET ? '已设置' : '未设置'}`);
});