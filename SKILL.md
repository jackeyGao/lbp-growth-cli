---
name: lbp-growth
description: LBP 实验增长系统 CLI - 推送任务管理、数据复盘、黑名单管理
metadata:
  author: LBP Growth Team
  version: 0.2.0
  tags:
    - lbp
    - growth
    - push
    - analytics
---

# LBP 实验增长系统 Agent

LBP 实验增长系统的 CLI 技能，支持推送任务管理、单日数据复盘、退订黑名单获取等功能。

## 前置要求

- Node.js 14+
- API Key（从 https://bytedance.aiforce.cloud/app/app_4k4t296e2nsut/agent-access 获取）
- Bearer Token（联系管理员获取）

## 安装

```bash
npm install -g lbp-growth-cli
```

## 配置凭据

### 方式 1: 使用 auth save 命令（推荐）

```bash
# 同时保存 API Key 和 Bearer Token（先验证，后保存）
lbp-growth auth save <API_KEY> <BEARER_TOKEN>

# 示例
lbp-growth auth save "your_api_key_here" "your_bearer_token_here"
```

### 方式 2: 环境变量

```bash
export LBP_BEARER_TOKEN="your_bearer_token_here"
# 然后使用 auth save 保存 API Key
lbp-growth auth save <API_KEY>
```

### 方式 3: 配置文件

```bash
# 全局配置文件
echo '{ "bearerToken": "your_bearer_token_here" }' > ~/.lbp_growth/config.json
chmod 600 ~/.lbp_growth/config.json

# 项目级配置文件
cp .lbp-growth.json.example .lbp-growth.json
# 编辑 .lbp-growth.json，填入你的 token
```

### 验证凭据

```bash
lbp-growth auth check
```

### 查看已保存的凭据

```bash
lbp-growth auth show
```

## 使用示例

### 创建推送任务

**CSV 格式要求：**
- 必须只有一列（表头可选：`app_id` 或 `bot_id`）
- 每行内容必须以 `cli_` 开头（如：`cli_app1`）

```bash
# 预览（dry-run）- content 必须是有效的 JSON 格式
lbp-growth push \
  --name "测试推送" \
  --format card \
  --content '{"title":"欢迎使用","content":"这是一条测试消息"}' \
  --apps cli_app1,cli_app2

# 确认推送
lbp-growth push \
  --name "测试推送" \
  --format card \
  --content '{"title":"欢迎使用","content":"这是一条测试消息"}' \
  --apps cli_app1,cli_app2 \
  --confirm

# 使用 CSV 文件推送（CSV 必须只有一列，每行以 cli_ 开头）
lbp-growth push \
  --name "批量推送" \
  --format card \
  --content '{"title":"通知","content":"重要更新"}' \
  --csv ./users.csv \
  --confirm

# Release Note 格式推送
lbp-growth push \
  --name "版本发布" \
  --format releaseNote \
  --release-note-ids "note1,note2" \
  --apps cli_app1 \
  --confirm

# 定时推送
lbp-growth push \
  --name "定时推送" \
  --format card \
  --content '{"title":"定时消息","content":"定时发送"}' \
  --apps cli_app1 \
  --schedule-type scheduled \
  --schedule-time "2026-06-10T10:00:00.000Z" \
  --confirm

# 忽略 CSV 限制强制推送
lbp-growth push ... --no-strict-limits --confirm
```

### 任务管理

```bash
# 查询任务列表
lbp-growth tasks list --day 2026-06-09
lbp-growth tasks list --day 2026-06-09 --page 1 --page-size 20

# 获取任务实时指标
lbp-growth tasks realtime <TASK_ID>

# 更新任务指标
lbp-growth tasks update <TASK_ID> --read-count 1000 --click-count 200
lbp-growth tasks update <TASK_ID> --push-count 1000 --read-rate 80.5 --action-rate 37.5

# 删除草稿任务（先预览，再确认）
lbp-growth tasks delete <TASK_ID>
lbp-growth tasks delete <TASK_ID> --confirm

# 生成批量确认 URL（支持 1-20 个 taskId）
lbp-growth tasks batch-confirm task_001 task_002 task_003

# 下载原始 AppID 列表 CSV
lbp-growth tasks csv-raw TASK_ID -o raw.csv

# 下载失败 AppID 列表 CSV
lbp-growth tasks csv-failure TASK_ID -o failure.csv

# 下载实时点击 AppID 列表 CSV
lbp-growth tasks csv-realtime-click TASK_ID -o realtime_click.csv
```

### 批量确认规则

- 仅 `status=draft`（草稿）状态的任务可以被确认
- 任务创建时间必须在 **7 天内**
- 单次最多处理 **20** 个任务
- 每个任务独立处理，部分成功、部分失败是正常情况

### 数据复盘

```bash
# 复盘昨天
lbp-growth review

# 复盘指定日期
lbp-growth review --day 2026-06-08

# 指定分页大小
lbp-growth review --day 2026-06-08 --page-size 200
```

### CSV 拆分

```bash
# 拆分大 CSV（超过 15 万行）
lbp-growth csv split big.csv --out-dir ./chunks --rows-per-file 150000

# 自定义文件名前缀
lbp-growth csv split big.csv --out-dir ./chunks --prefix "part" --rows-per-file 100000
```

### 黑名单管理

```bash
# 获取退订用户黑名单
lbp-growth blocklist

# 保存到文件
lbp-growth blocklist -o blocklist.json
```

## 命令参考

### Auth 命令 - 凭据管理

| 命令 | 说明 |
|------|------|
| `auth check` | 检查 API Key 和 Bearer Token 状态 |
| `auth save <API_KEY> <BEARER_TOKEN>` | 同时保存并验证 API Key 和 Bearer Token |
| `auth show` | 显示当前配置的凭据（脱敏） |

### Push 命令 - 创建推送

| 选项 | 说明 |
|------|------|
| `--name <name>` | 推送任务名称（必填） |
| `--format <format>` | 推送格式：`card` 或 `releaseNote`（必填） |
| `--content <json>` | 卡片内容（format=card 时必填），必须是有效 JSON 字符串 |
| `--release-note-ids <ids>` | Release Note ID 列表，逗号分隔（format=releaseNote 时必填） |
| `--apps <apps>` | app_id 列表，逗号分隔（与 --csv 二选一），每个 ID 必须以 `cli_` 开头 |
| `--csv <path>` | CSV 文件路径（与 --apps 二选一），CSV 必须只有一列，每行以 `cli_` 开头 |
| `--schedule-type <type>` | 调度类型：`immediate` 或 `scheduled`（默认 immediate） |
| `--schedule-time <time>` | 定时时间（ISO 格式，schedule-type=scheduled 时必填） |
| `--confirm` | 确认执行真实推送 |
| `--no-strict-limits` | 放行 CSV 超过限制 |

**注意：**
- `content` 是 JSON 字符串，不是 base64
- `fileContent`（内部自动处理）是 CSV 文件的 base64
- CSV 格式要求：单列表，表头可选 `app_id`，每行内容以 `cli_` 开头

### Tasks 命令 - 任务管理

| 命令 | 说明 |
|------|------|
| `tasks list [--day] [--page] [--page-size]` | 查询推送任务列表 |
| `tasks realtime <taskId>` | 获取任务实时指标 |
| `tasks update <taskId> [options]` | 更新任务指标（支持 --push-count, --read-count, --click-count, --read-rate, --action-rate, --overall-rate） |
| `tasks delete <taskId> [--confirm]` | 删除草稿状态的任务 |
| `tasks batch-confirm <taskIds...>` | 生成批量确认草稿任务的 URL（1-20 个 taskId） |
| `tasks csv-raw <taskId> -o <file>` | 下载任务原始 AppID 列表 CSV |
| `tasks csv-failure <taskId> -o <file>` | 下载任务失败 AppID 列表 CSV |
| `tasks csv-realtime-click <taskId> -o <file>` | 下载任务实时点击 AppID 列表 CSV |

### CSV 命令 - 文件处理

| 命令 | 说明 |
|------|------|
| `csv split <input> [--out-dir] [--rows-per-file] [--prefix]` | 拆分大 CSV 文件 |

### Review 命令 - 数据复盘

| 选项 | 说明 |
|------|------|
| `--day <day>` | 复盘日期（YYYY-MM-DD，默认昨天） |
| `--page-size <n>` | 分页大小（默认 200） |

### Blocklist 命令 - 黑名单

| 选项 | 说明 |
|------|------|
| `-o, --output <file>` | 输出到文件路径（JSON 格式） |

## Agent 使用示例

```javascript
const { execSync } = require('child_process');

// 检查凭据状态
const authResult = JSON.parse(execSync('lbp-growth auth check', { encoding: 'utf8' }));
if (!authResult.ok) {
  console.log('需要配置凭据');
}

// 推送预览（content 必须是有效 JSON）
const result = JSON.parse(execSync(
  'lbp-growth push --name "测试" --format card --content \'{"title":"测试"}\' --apps app1,app2',
  { encoding: 'utf8' }
));
console.log(`将推送至 ${result.request_preview.app_count} 个用户`);

// 确认推送
execSync('lbp-growth push --name "测试" --format card --content \'{"title":"测试"}\' --apps app1,app2 --confirm');

// 生成批量确认 URL
const confirmResult = JSON.parse(execSync(
  'lbp-growth tasks batch-confirm task_001 task_002',
  { encoding: 'utf8' }
));
console.log(`批量确认 URL: ${confirmResult.url}`);
```

## 凭据存储

凭据保存在 `~/.lbp_growth/credentials.json`，格式如下：

```json
{
  "api_key": "your_api_key_here",
  "bearer_token": "your_bearer_token_here"
}
```

## 返回码

| 码 | 含义 |
|----|------|
| 0 | 成功 |
| 1 | 参数错误 |
| 2 | 未配置凭据 |
| 3 | 凭据无效 |
| 4 | API 请求失败 |

## 更多信息

- 仓库: https://github.com/jackeyGao/lbp-growth-cli
- 问题反馈: https://github.com/jackeyGao/lbp-growth-cli/issues
