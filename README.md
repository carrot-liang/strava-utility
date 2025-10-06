# strava-utility

这是一个简单的 Node.js 服务器，允许用户通过API认证的方式访问 Strava 的个人和全球热力图。它可以让您可以在“两步路”等应用中使用Strava 热力图叠加层。

本项目部分参考了[strava-heatmap-proxy](https://github.com/erik/strava-heatmap-proxy)

注意：使用个人热力图**需要** Strava Premium 订阅，而全球热力图对所有 Strava 账户开放。仅供个人使用，Strava 会进行速率限制。

# 功能特性

- 支持个人和全球 Strava 热力图
- 多种颜色主题和活动类型，多种分辨率 (512px, 1024px)
- 支持缓存
- 定时为Strava Feed中的活动点赞

# 安装和运行

## 环境要求

- Node.js 18.0.0 或更高版本
- npm

## 快速开始

1. 安装依赖
```bash
npm install
```

2. 获取Strava Cookies 

由于 Strava API 不直接支持这种访问方式，我们需要通过登录获取会话Cookie：

- 在浏览器中登录 Strava
- 打开开发者工具，查看 Network 标签
- 访问任意 Strava 页面，找到请求头中的 Cookie
- 复制 Cookie 值到 `STRAVA_COOKIES` 环境变量

![strava cookies](img/strava-cookies.png)

3. 配置环境变量

打开 `.env` 并配置以下变量：

- `STRAVA_COOKIES`: Strava Cookies
- `TILE_CACHE_SECS`: 瓦片缓存时间，单位秒 (默认: 0)
- `KUDO_SECS`: KUDO间隔，单位秒 (默认: 3600)
- `PORT`: 服务器端口 (默认: 3000)
- `API_KEY`: API 访问密钥


4. 启动服务器

- npm start
- ./app.sh start

服务器将在 http://localhost:3000 启动


5. 使用方法

所有请求都必须在 URL 查询参数中携带有效的 API 密钥：

```bash
curl "http://localhost:3000/global/mobileblue/all/11/351/817@2x.png?apiKey=your-api-key"
```

# 使用方法

## URL 模板

### 个人热力图
```
http://localhost:3000/personal/{color}/{activity}/{z}/{x}/{y}.png
http://localhost:3000/personal/{color}/{activity}/{z}/{x}/{y}@2x.png
```

### 全球热力图
```
http://localhost:3000/global/{color}/{activity}/{z}/{x}/{y}.png
http://localhost:3000/global/{color}/{activity}/{z}/{x}/{y}@2x.png
```

## 参数说明

- `{color}`: 颜色主题
  - 个人: orange, hot, blue, bluered, purple, gray
  - 全球: mobileblue, orange, hot, blue, bluered, purple, gray
- `{activity}`: 活动类型
  - 基础: all, ride, winter, run, water
  - 详细: sport_AlpineSki, sport_BackcountrySki, sport_Badminton, sport_Canoeing, sport_EBikeRide, sport_EMountainBikeRide, sport_Golf, sport_GravelRide, sport_Handcycle, sport_Hike, sport_IceSkate, sport_InlineSkate, sport_Kayaking, sport_Kitesurf, sport_MountainBikeRide, sport_NordicSki, sport_Pickleball, sport_Ride, sport_RockClimbing, sport_RollerSki, sport_Rowing, sport_Run, sport_Sail, sport_Skateboard, sport_Snowboard, sport_Snowshoe, sport_Soccer, sport_StandUpPaddling, sport_Surfing, sport_Swim, sport_Tennis, sport_TrailRun, sport_Velomobile, sport_VirtualRide, sport_VirtualRow, sport_VirtualRun, sport_Walk, sport_Wheelchair, sport_Windsurf
- `{z}`: 缩放级别 (0-18)
- `{x}`, `{y}`: 瓦片坐标
- 分辨率后缀:
  - 无后缀: 512px
  - `@2x`: 1024px

## 示例

- 洛杉矶市中心全球热力图: `/global/mobileblue/all/11/351/817@2x.png`
- 个人跑步热力图: `/personal/orange/run/11/1686/775.png`

