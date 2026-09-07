# 下班冲刺

打工人主题的无尽跑酷小游戏：点按跳跃，躲开井盖、积水、共享单车等路上的坑。纯前端静态站，可直接部署到 Vercel。

## 本地预览

用任意静态服务器打开根目录，例如：

```bash
npx --yes serve .
```

或直接用浏览器打开 `index.html`（部分浏览器对本地模块无限制时，优先用 `serve`）。

## 操作

- 点击画布 / 空格 / ↑：跳跃
- 撞障碍结束；本局分数与最高分（本地 `localStorage`）

## 部署到 Vercel

1. 把本仓库推到 GitHub  
2. 打开 [Vercel](https://vercel.com) → **Add New Project** → 导入该仓库  
3. Framework Preset 选 **Other**，Build Command 留空，Output 为根目录即可  
4. Deploy 后得到 `*.vercel.app` 链接，手机也能玩  

无需备案、无需 Node 构建。

## 目录

```
index.html      # 入口
css/style.css   # 样式
js/game.js      # Canvas 游戏逻辑
```

## 后续可加

- 下蹲躲低障
- 音效、皮肤（雨天 / 周五）
- Google AdSense（有流量后再接）
