# 智能台账系统 - 部署文档

## 项目概述

本系统基于 **Cloudflare Pages + Functions + KV** 构建，提供以下功能模块：

| 模块 | 页面 | 说明 |
|------|------|------|
| 台账生成 | `px_tz.html` | 从 Excel 数据生成 Word 培训台账 |
| 工具集 | `tools.html` | 生成培训档案（.docx）和记录册（.xlsx），共享同一数据源 |
| 签名签署 | `signature/sign.html` | 手机端手写签名提交 |
| 签名管理 | `signature/admin.html` | 管理后台，管理模板、查看签名、一键打包合成 |

## 项目结构

```
台账/
├── index.html                     # 首页导航
├── px_tz.html                     # 台账填充生成
├── tools.html                     # 档案/记录册工具集
├── lib/
│   ├── base.css                   # 共享样式
│   └── base.js                    # 共享工具函数（API、消息提示、签名工具等）
├── signature/
│   ├── sign.html                  # 签名签署页面
│   └── admin.html                 # 签名管理后台
├── functions/
│   └── api/
│       ├── signatures.js          # 签名提交与列表查询 API
│       └── template.js            # 模板上传/获取/删除 API
├── 模板/
│   ├── 台账模板.docx              # px_tz.html 用的台账模板
│   ├── 公共区培训.docx            # tools.html 档案模板
│   ├── 安全通识培训.docx
│   ├── 岗位实操培训.docx
│   ├── 岗位技能培训.docx
│   └── 股份公司培训.docx
└── re.md                          # 本文档
```

## 架构说明

```
┌──────────────────────────────────────────┐
│            Cloudflare Pages              │
│  ┌────────────────────────────────────┐  │
│  │     静态资源 (HTML/CSS/JS)          │  │
│  │  index.html, px_tz.html,            │  │
│  │  tools.html, signature/*.html       │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │     Cloudflare Functions           │  │
│  │  /api/signatures  /api/template    │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│  ┌──────────────▼─────────────────────┐  │
│  │        Cloudflare KV               │  │
│  │  绑定名: DB                        │  │
│  │  - template:meta:{id}              │  │
│  │  - template:file:{id}              │  │
│  │  - sign:data:{templateId}:{key}    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │      Environment Variables          │  │
│  │  ADMIN_PASSWORD = 管理员密码        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## 前置条件

1. 一个 [Cloudflare](https://dash.cloudflare.com) 账号
2. 已完成实名认证（KV 和 Functions 需要）

## 部署步骤

### 第一步：创建 KV 命名空间

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com)
2. 左侧菜单点击 **存储与数据库 (Storage & Databases)** → **KV**
3. 点击 **创建命名空间 (Create Namespace)**
4. 输入名称（例如 `TAIZHANG_KV`），点击创建
5. 记录命名空间 ID（后续绑定需要，但通过页面选择即可）

### 第二步：部署到 Cloudflare Pages

1. 左侧菜单点击 **Workers & Pages** → 点击 **创建 (Create)**
2. 选择 **Pages** 选项卡 → **直接上传 (Direct Upload)**
3. 输入项目名称（例如 `taizhang`），点击 **创建项目**
4. 将本项目的**整个文件夹**拖拽上传到网页中
   - 确保 `functions/` 目录在根级别（Cloudflare 会自动识别为 Functions）
   - 确保 `lib/`、`signature/`、`模板/`、`*.html` 都在根级别
5. 点击 **部署站点 (Deploy site)**

### 第三步：绑定 KV 命名空间

1. 进入刚创建的 Pages 项目 → 切换到 **设置 (Settings)** 选项卡
2. 左侧子菜单点击 **函数 (Functions)**
3. 向下滚动找到 **KV 命名空间绑定 (KV namespace bindings)**，点击 **添加绑定 (Add binding)**
4. 填写绑定信息：
   - **变量名称 (Variable name)**：`DB`（必须与代码中 `env.DB` 一致）
   - **KV 命名空间 (KV namespace)**：选择第一步创建的命名空间
5. 点击 **保存 (Save)**

### 第四步：设置管理员密码

1. 在 **设置 (Settings)** → **环境变量 (Environment variables)**
2. 在生产环境 (Production) 下点击 **添加变量 (Add variable)**：
   - **变量名称 (Variable name)**：`ADMIN_PASSWORD`
   - **值 (Value)**：设置一个安全的自定义密码（例如 `MyTaizhang2026!`）
3. 建议预览环境 (Preview) 也添加相同的变量
4. 点击 **保存 (Save)**

### 第五步：重新部署使配置生效

1. 切换到 **部署 (Deployments)** 选项卡
2. 找到最新的部署记录，点击右侧的三个点 `...`
3. 选择 **重试部署 (Retry deployment)**

## 验证部署

部署成功后，Cloudflare 会分配一个 `*.pages.dev` 免费域名。

| 验证项 | URL | 预期结果 |
|--------|-----|----------|
| 首页 | `https://你的项目.pages.dev/` | 显示导航卡片 |
| 台账生成 | `/px_tz.html` | 可上传 Excel 生成 Word |
| 工具集 | `/tools.html` | 可上传共享 Excel 生成档案/记录册 |
| 签名管理 | `/signature/admin.html` | 输入密码后进入管理后台 |
| 签名签署 | `/signature/sign.html?templateId=xxx` | 手机端手写签名 |

### 签名管理后台验证步骤

1. 访问 `https://你的项目.pages.dev/signature/admin.html`
2. 输入在环境变量中设置的 `ADMIN_PASSWORD`
3. 点击"记住密码"
4. 上传 PDF 模板文件，在页面上拖拽确定签名区域，保存模板
5. 复制分享链接在手机上打开，输入姓名并手写签名提交
6. 回到管理后台，点击"一键合成并打包下载"获取带签名的 Zip 包

## CDN 依赖

所有第三方库通过 jsdelivr CDN 加载，无需本地安装：

| 库 | 用途 | 引用页面 |
|----|------|----------|
| PizZip | ZIP/Word 文档操作 | px_tz.html, tools.html |
| docxtemplater | Word 模板引擎 | px_tz.html, tools.html |
| docxtemplater-image-module | Word 图片模块 | px_tz.html, tools.html |
| ExcelJS | Excel 读取与写入 | px_tz.html, tools.html |
| XLSX (SheetJS) | Excel 解析 | tools.html |
| FileSaver.js | 浏览器文件下载 | px_tz.html, tools.html |

## 常见问题

### Q: 部署后访问 API 返回 500 错误？
检查 KV 绑定是否正确：变量名必须是 `DB`，命名空间必须已创建。

### Q: 签名管理后台一直提示密码错误？
检查环境变量 `ADMIN_PASSWORD` 是否已设置，且需重新部署后生效。

### Q: 生成文档时提示"PizZip is not defined"？
CDN 资源加载失败。检查网络是否能访问 `cdn.jsdelivr.net`。国内网络偶尔不稳定，刷新重试即可。

### Q: 模板文件在哪里？
`模板/` 目录下的 `.docx` 和 `.xlsx` 文件随项目一起部署到 Pages。`px_tz.html` 使用硬编码路径引用，`tools.html` 通过用户选择不同的 `.docx` 模板生成对应类型的档案。