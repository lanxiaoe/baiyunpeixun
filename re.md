# 智能台账系统 - 部署文档

## 项目概述

基于 **Cloudflare Pages + Functions + KV + D1 + R2** 构建，包含以下模块：

| 模块 | 页面 | 说明 |
|------|------|------|
| 首页导航 | `index.html` | 入口页面 |
| 台账生成 | `px_tz.html` | 从 Excel 数据生成 Word 培训台账 |
| 工具集 | `tools.html` | 生成培训档案（.docx）和记录册（.xlsx），共享同一数据源，上传时自动同步到云端 |
| 数据源管理 | `datasource/admin.html` | 查看已上传数据源列表、明细表格、下载、删除（公开访问） |
| 签名签署 | `signature/sign.html` | 手机端手写签名提交 |
| 签名管理 | `signature/admin.html` | 管理后台，密码保护。管理模板、查看签名、一键打包合成 |

## 项目结构

```
台账/
├── index.html                     # 首页导航
├── px_tz.html                     # 台账填充生成（独立样式）
├── tools.html                     # 档案/记录册工具集（含云端同步）
├── datasource/
│   ├── admin.html                 # 数据源管理后台（公开）
│   └── datasource.sql             # D1 数据库建表 SQL
├── signature/
│   ├── sign.html                  # 签名签署页面
│   └── admin.html                 # 签名管理后台（密码保护）
├── lib/
│   ├── base.css                   # 共享样式（部分页面引用）
│   └── base.js                    # 共享工具函数
├── functions/
│   └── api/
│       ├── signatures.js          # 签名提交/查询 API（KV 存储）
│       ├── template.js             # 模板上传/获取/删除 API（KV 存储）
│       └── datasource.js          # 数据源上传/列表/明细/删除 API（D1 + R2）
├── 模板/                          # 随部署上传的静态模板文件
│   ├── 台账模板.docx
│   ├── 公共区培训.docx
│   ├── 安全通识培训.docx
│   ├── 岗位实操培训.docx
│   ├── 岗位技能培训.docx
│   ├── 股份公司培训.docx
│   └── 记录册模板.xlsx
├── wrangler.toml                  # Cloudflare Workers/Pages 配置文件
└── re.md                          # 本文档
```

## 架构说明

```
┌──────────────────────────────────────────────────┐
│              Cloudflare Pages                      │
│  ┌────────────────────────────────────────────┐  │
│  │     静态资源 (HTML/CSS/JS/模板文件)          │  │
│  └─────────────┬──────────────────────────────┘  │
│                │                                  │
│  ┌─────────────▼──────────────────────────────┐  │
│  │     Cloudflare Functions (API Routes)        │  │
│  │  /api/signatures  /api/template             │  │
│  │  /api/datasource                            │  │
│  └───────┬──────────────────┬──────────────────┘  │
│          │                  │                    │
│  ┌───────▼───────┐  ┌───────▼────────┐          │
│  │  KV (DB)      │  │  D1 (D1_DB)   │          │
│  │  签名/模板     │  │  数据源元数据   │          │
│  └───────────────┘  └────────────────┘          │
│          │                                     │
│  ┌───────▼──────────────────────────────────┐  │
│  │  R2 (DATA_BUCKET)                         │  │
│  │  原始 Excel + 解析后 JSON                  │  │
│  └──────────────────────────────────────────┘  │
│                                                   │
│  ┌──────────────────────────────────────────┐   │
│  │      Environment Variables                 │   │
│  │  ADMIN_PASSWORD = 管理员密码                │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

## 存储绑定说明

| Binding 变量名 | 类型 | 用途 |
|---------------|------|------|
| `DB` | KV Namespace | 签名系统的模板文件和签名数据 |
| `D1_DB` | D1 Database | 数据源管理的元数据 |
| `DATA_BUCKET` | R2 Bucket | 数据源的原始 Excel 和 JSON 文件 |

## 前置条件

1. 一个 [Cloudflare](https://dash.cloudflare.com) 账号
2. 已完成实名认证（KV、D1、R2 需要）
3. 本地安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)：`npm install -g wrangler`

## 部署步骤

### 第一步：创建 Cloudflare 存储

**1.1 创建 KV 命名空间（签名系统用）**
1. [Cloudflare 控制台](https://dash.cloudflare.com) → **存储与数据库** → **KV** → **创建命名空间**
2. 名称：`PDF_SIGN_KV` → 创建

**1.2 创建 D1 数据库（数据源系统用）**
1. 命令行执行：
   ```bash
   wrangler d1 create tz-datasource
   ```
2. 将返回的 `database_id` 填入 `wrangler.toml` 的 `database_id` 字段
3. 初始化表结构：
   ```bash
   wrangler d1 execute tz-datasource --file=./datasource/datasource.sql
   ```

**1.3 创建 R2 存储桶（数据源文件用）**
1. Cloudflare 控制台 → **存储与数据库** → **R2** → **创建存储桶**
2. 名称：`tz-datasource-files`

### 第二步：配置并部署

**2.1 填写 wrangler.toml（已包含在项目中）**

```toml
name = "tz-app"
compatibility_date = "2024-01-01"

# KV - 签名系统
[[kv_namespaces]]
binding = "DB"
id = "<创建 KV 后填入的 ID>"

# D1 - 数据源系统
[[d1_databases]]
binding = "D1_DB"
database_name = "tz-datasource"
database_id = "<第一步 1.2 返回的 ID>"

# R2 - 数据源文件
[[r2_buckets]]
binding = "DATA_BUCKET"
bucket_name = "tz-datasource-files"
```

**2.2 设置管理员密码**
```bash
wrangler secret put ADMIN_PASSWORD
# 输入你的管理员密码
```

**2.3 部署**
```bash
wrangler deploy
```

### 第三步：验证部署

| 验证项 | URL | 预期结果 |
|--------|-----|----------|
| 首页 | `https://你的项目.pages.dev/` | 显示导航卡片 |
| 台账生成 | `/px_tz.html` | 可上传 Excel 生成 Word |
| 工具集 | `/tools.html` | 上传 Excel 后自动云端同步 |
| 数据源管理 | `/datasource/admin.html` | 直接显示管理界面（无密码） |
| 签名管理 | `/signature/admin.html` | 输入密码后进入管理后台 |
| 签名签署 | `/signature/sign.html?templateId=xxx` | 手机端手写签名 |

## CDN 依赖

所有第三方库统一使用 **jsdelivr** CDN，无需本地安装：

| 库 | jsdelivr 路径 | 用途页面 |
|----|---------------|----------|
| PizZip | `https://cdn.jsdelivr.net/npm/pizzip@3.1.4/dist/pizzip.min.js` | tools.html, px_tz.html |
| docxtemplater | `https://cdn.jsdelivr.net/npm/docxtemplater@3.49.0/build/docxtemplater.js` | tools.html, px_tz.html |
| docxtemplater-image-module | `https://cdn.jsdelivr.net/npm/docxtemplater-image-module-free-browserify@1.1.2/build/imagemodule.js` | tools.html |
| ExcelJS | `https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js` | tools.html |
| XLSX (SheetJS) | `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js` | tools.html |
| FileSaver.js | `https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js` | tools.html, px_tz.html |
| pdf.js | `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.min.js` | signature/admin.html |
| pdf.js worker | `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js` | signature/admin.html |
| pdf-lib | `https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js` | signature/admin.html |
| JSZip | `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js` | signature/admin.html |

## 签名管理后台使用流程

1. 访问 `/signature/admin.html`，输入 `ADMIN_PASSWORD` 登录
2. 上传 PDF 模板，用鼠标拖拽框选签名区域，点击发布
3. 复制生成的链接在手机端打开，输入姓名并手写签名提交
4. 回到管理后台，点击"一键打包下载"获取带所有签名的 ZIP 文件

## 数据源管理说明

- **tools.html** 上传 Excel 时自动静默上传到云端，无需额外操作
- 数据源元数据存入 D1，原始文件和 JSON 存入 R2
- 管理页面 `/datasource/admin.html` 公开访问，支持查看明细表格、下载原始 Excel、删除
- 删除操作会同时清理 D1 元数据和 R2 文件，不可恢复

## 常见问题

### Q: API 返回 500 或 "env.DB undefined"？
检查 `wrangler.toml` 中 KV 绑定名称是否为 `DB`，D1 绑定名称是否为 `D1_DB`。

### Q: 数据源上传后管理页面不显示？
1. 确认 D1 表已创建：`wrangler d1 execute tz-datasource --file=./datasource/datasource.sql`
2. 确认 R2 存储桶已创建并绑定为 `DATA_BUCKET`

### Q: 签名管理后台提示密码错误？
确认 `ADMIN_PASSWORD` 环境变量已通过 `wrangler secret put` 设置，且需重新 `wrangler deploy` 使其生效。

### Q: tools.html 生成文档提示 "PizZip is not defined"？
CDN 加载失败，刷新页面重试。国内网络可能需稍等或使用代理。

### Q: 部署后页面空白或资源 404？
确认项目文件夹完整上传，所有 HTML/CSS/JS 和 `模板/` 目录都在根目录。`functions/` 目录也必须在根目录（Cloudflare 会自动识别其中的 API）。
