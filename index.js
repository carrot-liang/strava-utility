// 加载环境变量
require('dotenv').config();

// 初始化环境变量
let Env = {
  STRAVA_COOKIES: null,
  TILE_CACHE_SECS: 0,
  API_KEY: null,
};

// 异步初始化 STRAVA_COOKIES
async function initializeEnv() {
  try {
    // 验证必需的环境变量
    if (!process.env.API_KEY) {
      console.error('Error: API_KEY environment variable is required');
      process.exit(1);
    }
    Env.API_KEY = process.env.API_KEY;
    if (!process.env.TILE_CACHE_SECS) {
      Env.TILE_CACHE_SECS = 0;
    }
    Env.TILE_CACHE_SECS = parseInt(process.env.TILE_CACHE_SECS);
    if (!process.env.KUDO_SECS) {
      Env.KUDO_SECS = 3600;
    }
    Env.KUDO_SECS = parseInt(process.env.KUDO_SECS);
    if (!process.env.STRAVA_COOKIES) {
      console.error('Error: STRAVA_COOKIES environment variable is required');
      process.exit(1);
    }    
    Env.STRAVA_COOKIES = await getFullCookies(process.env.STRAVA_COOKIES);
    console.log('Env initialized successfully');
  } catch (error) {
    console.error('Error initializing STRAVA_COOKIES:', error);
    process.exit(1);
  }
}

const PERSONAL_MAP_URL =
  "https://personal-heatmaps-external.strava.com/tiles/" +
  "{strava_id}/{color}/{z}/{x}/{y}{res}.png" +
  "?filter_type={activity}&include_everyone=true&include_followers_only=true&include_only_me=true&respect_privacy_zones=false&include_commutes=true";

const GLOBAL_MAP_URL =
  "https://content-a.strava.com/identified/globalheat/" +
  "{activity}/{color}/{z}/{x}/{y}{res}.png?v=19";

function getCookies(res) {
  const cookies = [];
  for (const [k, v] of res.headers) {
    if (k === "set-cookie") {
      const stripped = v.match(/^([^;]+);/);
      stripped !== null && cookies.push(stripped[1]);
    }
  }
  return cookies;
}

function extractStravaId() {
  const parts = Env.STRAVA_COOKIES.split(';').map(c => c.trim());
  const idPart = parts.find(c => c.startsWith('strava_remember_id='));
  return idPart ? idPart.split('=')[1] : undefined;
}

async function getFullCookies(sessionCookies) {
  const mapCookiesResp  = await fetch("https://www.strava.com/maps", {
    headers: { "Cookie": sessionCookies },
  });
  if (mapCookiesResp.status !== 200) {
    console.error('Error: Authentication failed.');
    process.exit(1);
  }
  const fullCookies = getCookies(mapCookiesResp).concat(sessionCookies);
  return fullCookies.join(';');
}

// 统一的瓦片请求处理函数
async function handleTileRequest(req, res, resolution) {
  try {
    const { color, activity, z, x, y } = req.params;

    // 验证参数
    if (!color || !activity || !z || !x || !y) {
      return res.status(400).send('Invalid parameters');
    }

    const data = {
      strava_id: extractStravaId(),
      color,
      activity,
      x,
      y,
      z,
      res: resolution || '',
    };

    const kind = req.path.startsWith('/personal') ? 'personal' : 'global';
    const baseUrl = kind === "personal" ? PERSONAL_MAP_URL : GLOBAL_MAP_URL;

    // replace templated data in base URL
    const proxyUrl = baseUrl.replace(/\{(\w+)\}/g, (_, key) => data[key]);

    console.log(proxyUrl);
    console.log(Env.STRAVA_COOKIES);
    const response = await fetch(proxyUrl, { headers: { Cookie: Env.STRAVA_COOKIES } });

    if (!response.ok) {
      console.error(`Strava API error: ${response.status} ${response.statusText}`);
      return res.status(response.status).send(`Error fetching tile: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 设置响应头
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', `max-age=${Env.TILE_CACHE_SECS || 0}`);

    res.send(buffer);
  } catch (error) {
    console.error('Error handling tile request:', error);
    res.status(500).send('Internal server error');
  }
}

async function kudoActivity(activityId, csrfToken) {
  const kudoUrl = `https://www.strava.com/feed/activity/${activityId}/kudo`;
  const tokenToUse = csrfToken || await getCsrfToken();
  if (!tokenToUse) {
    console.warn(`Skip kudo for ${activityId}: CSRF token not found`);
    return;
  }
  const kudoResp = await fetch(kudoUrl, {
    method: 'POST',
    headers: {
      Cookie: Env.STRAVA_COOKIES,
      'x-csrf-token': tokenToUse
    }
  });
  let kudoJson = await kudoResp.json();
  return kudoJson.success;
}

async function getCsrfToken() {
  const csrfTokenUrl = 'https://www.strava.com/dashboard';
  const csrfTokenResp = await fetch(csrfTokenUrl, {
    headers: { Cookie: Env.STRAVA_COOKIES }
  });
  let html = await csrfTokenResp.text();
  // 获取name是csrf-token的meta标签中的content值（更健壮的匹配，支持单双引号和可变空白）
  const match = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
  if (!match) {
    console.error('Error: CSRF token meta tag not found , cookies may be expired');
    process.exit(1);
  }
  const csrfToken = match[1];
  console.log("csrfToken: " + csrfToken);
  return csrfToken;
}

async function fetchStravaFeed() {
  try {
    // 获取csrf token
    let csrfToken = await getCsrfToken();
    let stravaId = extractStravaId();

    const url = 'https://www.strava.com/dashboard/feed?feed_type=following&athlete_id=' + stravaId + '&cursor=' + Date.now();

    console.log(`[${new Date().toISOString()}] 正在请求 Strava feed ...`);

    const response = await fetch(url, {
      headers: { Cookie: Env.STRAVA_COOKIES }
    });

    if (response.ok) {
      // 输出请求结果摘要
      console.log(`[${new Date().toISOString()}] Strava feed 请求成功:`);
      // 解析json
      const json = await response.json();
      // 遍历json.entries  
      for (const entry of json.entries) {
        if (entry.entity == "Activity") {
          let activity = entry.activity;
          let athlete = activity.athlete;
          if (activity.flagged == null && athlete.athleteId != stravaId && activity.kudosAndComments.canKudo) {
            let athleteName = athlete.athleteName;
            let activityName = activity.activityName;
            let activityId = activity.id;
            let success = await kudoActivity(activityId, csrfToken);
            console.log(activityId + "(" + activityName + ") By " + athleteName + " Kudoed:" + success);
            // 随机等待5-10秒
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 5000) + 5000));
          }
        }
      }
    } else {
      console.error(`[${new Date().toISOString()}] Strava feed 请求失败: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 请求 Strava feed 时发生错误:`, error.message);
  }
}

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  // API 密钥验证
  const apiKey = req.query.apiKey;
  if (!apiKey || apiKey !== Env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const contentLength = res.getHeader('Content-Length') || '-';
    const ip = req.ip || req.connection?.remoteAddress || '-';
    const ua = req.headers['user-agent'] || '-';
    const referer = req.headers['referer'] || req.headers['referrer'] || '-';
    console.log(
      `[${new Date().toISOString()}] ${ip} ${req.method} ${req.originalUrl} -> ${res.statusCode} ${contentLength}b ${durationMs.toFixed(2)}ms UA="${ua}" Referer="${referer}"`
    );
  });
  next();
});

app.get('/(personal|global)/:color/:activity/:z/:x/:y@2x.png', async (req, res) => {
  handleTileRequest(req, res, '@2x');
});

app.get('/(personal|global)/:color/:activity/:z/:x/:y.png', async (req, res) => {
  handleTileRequest(req, res, '');
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// 404 处理
app.use((req, res) => {
  res.status(404).send('Resource not found');
});

// 启动服务器
async function startServer() {
  await initializeEnv();
  
  app.listen(PORT, () => {
    console.log(`Strava Heatmap Proxy server running on port ${PORT}`);
    console.log('Starting task: Auto Feed Kudos');
    setInterval(fetchStravaFeed, Env.KUDO_SECS * 1000);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
