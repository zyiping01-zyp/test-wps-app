# 座位预约系统 - 后端部署指南

## 部署到 Render（免费）

### 前置条件

1. 在 [WPS 开放平台](https://open.wps.cn) 已创建企业自建应用
2. 已获取 **App ID（Client ID）** 和 **App Secret（Client Secret）**
3. 已在开放平台配置回调地址为 Render 部署后的地址（部署后才知道）
4. 已在开放平台申请 `kso.user_base.read` 和 `kso.dbsheet.readwrite` 权限

### 部署步骤

#### 1. 上传代码到 GitHub

```bash
# 在本地执行
git init
git add .
git commit -m "座位预约系统"
git remote add origin https://github.com/你的用户名/seat-reservation.git
git push -u origin main
```

#### 2. 在 Render 部署

1. 打开 https://dashboard.render.com
2. 点击 **New +** → **Web Service**
3. 连接你的 GitHub 仓库
4. 填写：
   - **Name**: `seat-reservation`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. 在 **Environment Variables** 中添加：

   | 变量名 | 值 |
   |--------|-----|
   | `WPS_CLIENT_ID` | 你的 App ID（如 AK2026XXXXXXXX） |
   | `WPS_CLIENT_SECRET` | 你的 App Secret |

6. 点击 **Create Web Service**，等待部署完成（约 2-3 分钟）

#### 3. 配置回调地址

部署完成后，在 Render 面板顶部会显示你的应用地址，例如：
```
https://seat-reservation.onrender.com
```

将这个地址添加到 WPS 开放平台应用的 **安全配置 → 用户授权回调地址** 中（末尾要加斜杠）：
```
https://seat-reservation.onrender.com/
```

#### 4. 使用

1. 打开 Render 提供的地址
2. 点击 **"首次使用？先配置 Client ID"**
3. 输入你的 **App ID**（Client ID）
4. 点击 **保存配置**
5. 点击 **🔑 使用 WPS 账号登录**
6. 授权后即可使用

### 注意事项

- Render 免费版如果 15 分钟无访问会自动休眠，再次访问时会自动唤醒（需等待约 30 秒）
- 如需保持持续运行，可在 Render 控制台升级为付费计划