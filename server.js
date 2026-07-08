const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 从环境变量读取 WPS 开放平台应用凭证
const WPS_CLIENT_ID = process.env.WPS_CLIENT_ID || '';
const WPS_CLIENT_SECRET = process.env.WPS_CLIENT_SECRET || '';

const API_BASE = 'https://openapi.wps.cn';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 托管前端静态文件
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// API 代理接口
// ============================================================

// 辅助函数：拼接 form 请求体
function toFormBody(params) {
  return Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v || ''))
    .join('&');
}

// 1. 获取应用级 access_token（用于操作多维表）
async function getAppToken() {
  const body = toFormBody({
    client_id: WPS_CLIENT_ID,
    client_secret: WPS_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'kso.dbsheet.readwrite',
  });
  const resp = await fetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json();
  if (!data.access_token) {
    throw new Error('获取应用 token 失败: ' + JSON.stringify(data));
  }
  return data.access_token;
}

// 2. 交换 OAuth code → 用户 access_token
app.post('/api/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    const body = toFormBody({
      client_id: WPS_CLIENT_ID,
      client_secret: WPS_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri,
    });
    const resp = await fetch(`${API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await resp.json();
    if (data.access_token) {
      res.json({
        ok: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
      });
    } else {
      res.json({ ok: false, error: data.error || JSON.stringify(data) });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 3. 获取当前用户信息（使用用户 access_token）
app.get('/api/user/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ ok: false, error: '未提供令牌' });
    const resp = await fetch(`${API_BASE}/v7/user/me`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await resp.json();
    if (data.code === 0) {
      res.json({ ok: true, data: data.data });
    } else {
      res.json({ ok: false, error: data.msg });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 4. 刷新用户 access_token
app.post('/api/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const body = toFormBody({
      client_id: WPS_CLIENT_ID,
      client_secret: WPS_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token,
    });
    const resp = await fetch(`${API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await resp.json();
    if (data.access_token) {
      res.json({
        ok: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
      });
    } else {
      res.json({ ok: false, error: JSON.stringify(data) });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 5. 列出多维表记录（使用应用 access_token 代理）
app.post('/api/dbsheet/records', async (req, res) => {
  try {
    const { file_id, sheet_id, page_size } = req.body;
    const appToken = await getAppToken();
    const url = `${API_BASE}/v7/coop/dbsheet/${file_id}/sheets/${sheet_id || 2}/records/list?page_size=${page_size || 100}`;
    const resp = await fetch(url, {
      headers: { Authorization: 'Bearer ' + appToken },
    });
    const data = await resp.json();
    if (data.code === 0) {
      res.json({ ok: true, data: data.data });
    } else {
      res.json({ ok: false, error: data.msg });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 6. 更新多维表记录（使用应用 access_token 代理）
app.post('/api/dbsheet/records/update', async (req, res) => {
  try {
    const { file_id, sheet_id, records } = req.body;
    const appToken = await getAppToken();
    const resp = await fetch(
      `${API_BASE}/v7/coop/dbsheet/${file_id}/sheets/${sheet_id || 2}/records/update`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + appToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records }),
      }
    );
    const data = await resp.json();
    if (data.code === 0) {
      res.json({ ok: true, data: data.data });
    } else {
      res.json({ ok: false, error: data.msg });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 所有其他路径返回前端页面（SPA 支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`座位预约系统后端已启动，端口: ${PORT}`);
});