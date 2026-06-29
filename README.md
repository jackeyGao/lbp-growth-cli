# LBP Growth CLI

LBP 实验增长系统 CLI：Agent 友好的推送任务管理工具。

纯 Node.js 实现，无需 Python 依赖。

## 安装

```bash
npm install -g lbp-growth-cli
```

安装完成后，可以使用 `lbp-growth` 或 `lbp` 命令。

## 前置要求

在使用前，需要配置 API Key 和 Bearer Token（从 https://bytedance.aiforce.cloud/app/app_4k4t296e2nsut/agent-access 获取）。

### 方式 1：使用 auth save 命令（推荐）

```bash
# 同时保存 API Key 和 Bearer Token（先验证，后保存）
lbp-growth auth save <YOUR_API_KEY> <YOUR_BEARER_TOKEN>
```

### 方式 2：环境变量 + auth save

```bash
export LBP_BEARER_TOKEN="your_bearer_token_here"
lbp-growth auth save <YOUR_API_KEY>
```

### 方式 3：配置文件

```bash
# 全局配置文件
mkdir -p ~/.lbp_growth
echo '{ "bearerToken": "your_bearer_token_here" }' > ~/.lbp_growth/config.json
chmod 600 ~/.lbp_growth/config.json

# 项目级配置文件
cp .lbp-growth.json.example .lbp-growth.json
# 编辑 .lbp-growth.json，填入你的 token
```

## 快速开始

```bash
# 1. 配置凭据（同时保存 API Key 和 Bearer Token）
lbp-growth auth save <YOUR_API_KEY> <YOUR_BEARER_TOKEN>

# 2. 检查凭据
lbp-growth auth check

# 3. 创建推送任务（预览）
lbp-growth push --name "测试推送" --format card --content '{"title":"测试"}' --apps cli_app1,cli_app2

# 4. 确认推送
lbp-growth push --name "测试推送" --format card --content '{"title":"测试"}' --apps cli_app1,cli_app2 --confirm

# 5. 查询任务
lbp-growth tasks list --day 2026-06-09

# 6. 生成批量确认 URL（支持 1-20 个 taskId）
lbp-growth tasks batch-confirm task_001 task_002 task_003

# 7. 生成复盘报告
lbp-growth review
```

## 命令参考

### Auth 命令：凭据管理

| 命令 | 说明 |
|------|------|
| `auth check` | 检查 API Key 和 Bearer Token 状态 |
| `auth save <API_KEY> [BEARER_TOKEN]` | 保存并校验 API Key 和 Bearer Token；未传 Bearer Token 时读取环境变量或配置文件 |
| `auth show` | 显示当前凭据（脱敏） |

### Push 命令：创建推送

创建推送任务。`--content` 必须是有效的 JSON 字符串。

```bash
# Card 格式推送
lbp-growth push --name "测试" --format card --content '{"title":"hello"}' --apps cli_app1,cli_app2

# Release Note 格式推送
lbp-growth push --name "发布" --format releaseNote --release-note-ids note1 --csv users.csv

# 定时推送
lbp-growth push --name "定时" --format card --content '{"title":"hello"}' --apps cli_app1 \
    --schedule-type scheduled --schedule-time 2026-06-09T10:00:00.000Z

# 使用 CSV 文件推送
lbp-growth push --name "批量推送" --format card --content '{"title":"通知"}' --csv users.csv --confirm

# 正式发送（必须加 --confirm）
lbp-growth push ... --confirm
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `--name` | 是 | 推送任务名称 |
| `--format` | 是 | 推送格式：`card` 或 `releaseNote` |
| `--content` | card 时 | 卡片内容，必须是有效 JSON 字符串 |
| `--release-note-ids` | releaseNote 时 | Release Note ID 列表，逗号分隔 |
| `--apps` | 二选一 | app_id 列表，逗号分隔，每个 ID 必须以 `cli_` 开头 |
| `--csv` | 二选一 | CSV 文件路径，必须只有一列，每行以 `cli_` 开头 |
| `--schedule-type` | 否 | 调度类型：`immediate` 或 `scheduled`，默认 `immediate` |
| `--schedule-time` | scheduled 时 | 定时时间（ISO 格式） |
| `--confirm` | 否 | 确认执行真实推送 |
| `--no-strict-limits` | 否 | 放行 CSV 超过限制 |

**CSV 格式要求：**
- 必须只有一列（表头可选：`app_id` 或 `bot_id`）
- 每行内容必须以 `cli_` 开头（如：`cli_app1`）

### Tasks 命令：任务管理

| 命令 | 说明 |
|------|------|
| `tasks list [--day] [--page] [--page-size]` | 查询推送任务列表 |
| `tasks realtime <taskId>` | 获取任务实时指标 |
| `tasks update <taskId> [options]` | 更新任务指标（支持 `--push-count`, `--read-count`, `--click-count`, `--read-rate`, `--action-rate`, `--overall-rate`） |
| `tasks delete <taskId> [--confirm]` | 删除草稿状态的任务 |
| `tasks batch-confirm <taskIds...>` | 生成批量确认草稿任务的 URL（支持 1-20 个 taskId） |
| `tasks csv-raw <taskId> -o <file>` | 下载任务原始 AppID 列表 CSV |
| `tasks csv-failure <taskId> -o <file>` | 下载任务失败 AppID 列表 CSV |
| `tasks csv-realtime-click <taskId> -o <file>` | 下载任务实时点击 AppID 列表 CSV |

```bash
# 查询任务列表
lbp-growth tasks list --day 2026-06-09

# 获取任务实时指标
lbp-growth tasks realtime task_abc123

# 更新任务指标
lbp-growth tasks update task_abc123 --read-count 1000 --click-count 200

# 删除草稿任务
lbp-growth tasks delete task_abc123 --confirm

# 批量确认任务（生成 URL）
lbp-growth tasks batch-confirm task_001 task_002 task_003

# 下载原始 AppID 列表 CSV
lbp-growth tasks csv-raw task_abc123 -o raw.csv

# 下载失败 AppID 列表 CSV
lbp-growth tasks csv-failure task_abc123 -o failure.csv

# 下载实时点击 AppID 列表 CSV
lbp-growth tasks csv-realtime-click task_abc123 -o realtime_click.csv
```

**批量确认规则：**
- 仅 `status=draft`（草稿）状态的任务可以被确认
- 任务创建时间必须在 **7 天内**
- 单次最多处理 **20** 个任务

### TEA 命令：每日点击数据同步

```bash
# 同步 TEA 平台预创建激活链接每日点击数据（仅 super_admin）
lbp-growth tea daily \
  --date 2026-06-01 \
  --open-from instruction_do_you_know_me \
  --pv 1286
```

该命令会调用 `POST /openapi/tea/daily`，按 `date + open_from` 去重：已有记录更新 `pv`，不存在则新建。

### CSV 命令：文件处理

```bash
# 拆分大 CSV（超过 15 万行）
lbp-growth csv split big.csv --out-dir ./chunks --rows-per-file 150000

# 自定义文件名前缀
lbp-growth csv split big.csv --out-dir ./chunks --prefix "part" --rows-per-file 100000
```

### Review 命令：数据复盘

```bash
# 复盘昨天
lbp-growth review

# 复盘指定日期
lbp-growth review --day 2026-06-08

# 指定分页大小
lbp-growth review --day 2026-06-08 --page-size 200
```

### Blocklist 命令：黑名单

```bash
# 获取退订用户黑名单
lbp-growth blocklist

# 保存到文件
lbp-growth blocklist -o blocklist.json
```

## 返回码说明

| 返回码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 参数错误 |
| 2 | 未配置凭据 |
| 3 | 凭据无效 |
| 4 | API 请求失败 |

## Agent 使用示例

```javascript
const { execSync } = require('child_process');

// 检查凭据
const authResult = JSON.parse(execSync('lbp-growth auth check', { encoding: 'utf8' }));
if (!authResult.ok) {
  console.log('需要配置凭据');
}

// 推送预览（content 必须是有效 JSON）
const result = JSON.parse(execSync(
  'lbp-growth push --name "测试" --format card --content \'{"title":"hello"}\' --apps cli_app1,cli_app2',
  { encoding: 'utf8' }
));
console.log(`将推送至 ${result.request_preview.app_count} 个用户`);

// 确认推送
execSync('lbp-growth push --name "测试" --format card --content \'{"title":"hello"}\' --apps cli_app1,cli_app2 --confirm');

// 生成批量确认 URL
const confirmResult = JSON.parse(execSync(
  'lbp-growth tasks batch-confirm task_001 task_002',
  { encoding: 'utf8' }
));
console.log(`批量确认 URL: ${confirmResult.url}`);
```

## 项目结构

```
lbp-growth-cli/
├── bin/                     # CLI 入口
│   ├── lbp-growth          # 主命令
│   └── lbp                 # 别名
├── lib/                     # 核心模块
│   ├── config.js           # 配置常量
│   ├── http.js             # HTTP 工具
│   ├── auth.js             # 凭据管理
│   ├── push.js             # 推送功能
│   ├── tasks.js            # 任务管理
│   ├── csv.js              # CSV 工具
│   └── review.js           # 数据复盘
├── SKILL.md                 # 技能定义
├── package.json
└── README.md
```

## 开发

```bash
# 安装依赖
npm install

# 本地测试
./bin/lbp-growth --help

# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

### 测试覆盖

当前测试覆盖 83%+ 的代码：
- `config.js`: 100%
- `csv.js`: 96%
- `push.js`: 85%
- `tasks.js`: 85%
- `review.js`: 84%
- `auth.js`: 51%

## 安全说明

### 凭据配置

API Key 和 Bearer Token 用于服务端认证，**不应硬编码在代码中或提交到版本控制**。

支持以下配置方式（按优先级排序）：

1. **auth save 命令**（推荐）
   ```bash
   lbp-growth auth save <YOUR_API_KEY> <YOUR_BEARER_TOKEN>
   ```

2. **环境变量**（适合 CI/CD）
   ```bash
   export LBP_BEARER_TOKEN="your_bearer_token_here"
   ```

3. **全局配置文件**
   ```bash
   mkdir -p ~/.lbp_growth
   echo '{ "bearerToken": "your_bearer_token_here" }' > ~/.lbp_growth/config.json
   chmod 600 ~/.lbp_growth/config.json
   ```

4. **项目级配置文件**（仅当前项目）
   ```bash
   cp .lbp-growth.json.example .lbp-growth.json
   # 编辑 .lbp-growth.json，填入你的 token
   ```
   
   ⚠️ **注意**：`.lbp-growth.json` 已添加到 `.gitignore`，不会被提交。

### 凭据存储

凭据通过 `auth save` 命令保存到本地：

```bash
lbp-growth auth save <YOUR_API_KEY> <YOUR_BEARER_TOKEN>
```

存储位置：`~/.lbp_growth/credentials.json`（权限 600）

存储格式：
```json
{
  "api_key": "your_api_key_here",
  "bearer_token": "your_bearer_token_here"
}
```

## License

MIT
