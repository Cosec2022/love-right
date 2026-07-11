# 接入 CosecLab

## 项目标识

- 产品：Love Right
- 仓库：`love-right`
- Worker：`love-right`
- 域名：`love-right.coseclab.dev`
- 状态：Engine Alpha

## CosecLab 首页卡片

```html
<a class="project-card" href="https://love-right.coseclab.dev" target="_blank" rel="noreferrer">
  <span class="project-kicker">INTERACTIVE STORY ENGINE</span>
  <h3>Love Right</h3>
  <p>在一段段关系里作出选择，逐渐看见自己如何心动、靠近、怀疑与确认爱。</p>
  <span class="project-link">进入故事库 →</span>
</a>
```

## 部署

```bash
npm install
npm run check
npm run deploy
```

`wrangler.jsonc` 已继续使用 Cloudflare Static Assets 与 `love-right.coseclab.dev` 自定义域名。
