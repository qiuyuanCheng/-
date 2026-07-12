# 球球对决网页端

## 本地运行

复制 `.env.example` 为 `.env.local`，填入 Supabase 项目的 URL 与 publishable key；在项目根目录执行：

```bash
npm install
npm run dev:web
```

需要在 Supabase Auth 中启用 **Anonymous Sign-Ins**。数据库迁移已记录在 `supabase/migrations/202607110001_ball_duel_web.sql`。

未配置环境变量时，网站仍可进行本地自由对战和使用浏览器本地战绩；好友房与云端战绩需要 Supabase。
