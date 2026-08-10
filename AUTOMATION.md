# 泉知 · 自动化更新方案

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│  你的电脑 (Windows)                                      │
│                                                         │
│  每天 08:00 ──→ Windows 定时任务                         │
│                     │                                   │
│                     ▼                                   │
│          daily-lightweight.mjs                          │
│          ├─ 发现赵涌新品 (API, 3min)                     │
│          ├─ 发现易金新品 (扫描, 3min)                    │
│          ├─ 下载新图片 (5min)                            │
│          ├─ OCR 识别盒号 (10min, 限100张)               │
│          ├─ 二次验证盒号 (5min)                          │
│          ├─ 导出静态 JSON (1min)                         │
│          └─ git commit + push ──────────┐               │
│                                         │               │
│  quanzhi.sqlite (85MB) ◀── 本地数据库    │               │
└─────────────────────────────────────────┼───────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub                                                 │
│                                                         │
│  收到 push ──→ GitHub Actions 自动触发                   │
│                     │                                   │
│                     ▼                                   │
│               npm run build (构建网站)                   │
│                     │                                   │
│                     ▼                                   │
│               部署到 GitHub Pages                        │
│                     │                                   │
│                     ▼                                   │
│        https://你的用户名.github.io/quanzhi              │
└─────────────────────────────────────────────────────────┘
```

## 为什么这样设计？

| 问题 | 方案 |
|---|---|
| SQLite 85MB 太大，不能放 GitHub | 数据库只在本地，只推送导出的 JSON 文件（~5MB） |
| OCR 需要 Tesseract.js，GitHub Actions 太慢 | OCR 在本地跑（有 GPU 加速的话更快） |
| 赵涌/易金可能屏蔽海外 IP | 本地网络访问无障碍 |
| 网站需要实时反映新数据 | 每次数据更新自动触发 GitHub Pages 重新部署 |

## 部署步骤

### 第一步：推送到 GitHub

```bash
cd C:\Users\仙女飞飞\Documents\Codex\2026-08-02\w
git init
git add .
git commit -m "泉知 · NGC/PCGS 评级币交易查询平台"
git branch -M main
git remote add origin https://github.com/你的用户名/quanzhi.git
git push -u origin main
```

### 第二步：启用 GitHub Pages

1. 打开 `https://github.com/你的用户名/quanzhi/settings/pages`
2. Source → **GitHub Actions**
3. 保存

推送代码后，GitHub Actions 会自动构建并部署。首次部署约 2-3 分钟。

### 第三步：安装每日自动更新

以**管理员身份**运行 PowerShell：
```powershell
.\scripts\setup-daily-update.ps1
```

这会在 Windows 任务计划程序中创建一个每天早上 8:00 运行的任务。

#### 可选：配置自动 Git Push

如果要让脚本自动推送（无需手动操作），需要配置 Git 凭据：

```bash
# 方法一：SSH Key（推荐）
ssh-keygen -t ed25519 -C "你的邮箱"
# 把公钥添加到 https://github.com/settings/keys
git remote set-url origin git@github.com:你的用户名/quanzhi.git

# 方法二：Personal Access Token
# 1. https://github.com/settings/tokens → 创建 token（勾选 repo）
# 2. git remote set-url origin https://你的用户名:TOKEN@github.com/你的用户名/quanzhi.git
```

然后编辑 `scripts/setup-daily-update.ps1`，把 `--no-push` 删掉，重新运行安装。

### 第四步：验证

```bash
# 手动跑一次完整更新
node collector/daily-lightweight.mjs

# 查看定时任务
taskschd.msc  # → 搜索「泉知」
```

## 文件清单

| 文件 | 作用 |
|---|---|
| `collector/daily-lightweight.mjs` | 每日增量更新脚本（~20分钟） |
| `collector/daily-update.mjs` | 完整更新脚本（~1-2小时，数据量大时使用） |
| `.github/workflows/deploy.yml` | GitHub Actions 自动部署 |
| `scripts/setup-daily-update.ps1` | Windows 定时任务安装脚本 |

## 手动命令

```bash
# 快速更新（仅导出，不采集）
node collector/daily-update.mjs --quick

# 完整每日更新
node collector/daily-lightweight.mjs

# 手动导出
npm run data:export

# 手动构建
npm run build

# 检查数据状态
node collector/check-progress.mjs
```
