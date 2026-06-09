---
name: lbp-growth
description: LBP 实验增长系统 CLI - 推送任务管理、数据复盘、黑名单管理
metadata:
  author: LBP Growth Team
  version: 0.1.0
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

## 安装

```bash
# 安装技能
npx skills add lbp-growth

# 或使用本仓库
npx skills add bytedance/lbp-growth-cli
```

## 配置

```bash
# 配置 API Key
lbp-growth auth save <YOUR_API_KEY>

# 验证配置
lbp-growth auth check
```

## 使用示例

### 创建推送任务

```bash
# 预览（dry-run）
lbp-growth push \
  --name "测试推送" \
  --format card \
  --content "这是一条测试消息" \
  --apps cli_app1,cli_app2

# 确认推送
lbp-growth push \
  --name "测试推送" \
  --format card \
  --content "这是一条测试消息" \
  --apps cli_app1,cli_app2 \
  --confirm
```

### 查询任务

```bash
# 列出今天的任务
lbp-growth tasks list --day 2026-06-09

# 更新任务指标
lbp-growth tasks update <TASK_ID> --read-count 1000 --click-count 200
```

### 数据复盘

```bash
# 复盘昨天
lbp-growth review

# 复盘指定日期
lbp-growth review --day 2026-06-08
```

### CSV 拆分

```bash
# 拆分大 CSV（超过 15 万行）
lbp-growth csv split big.csv --out-dir ./chunks --rows-per-file 150000
```

### 黑名单管理

```bash
# 获取退订用户黑名单
lbp-growth blocklist -o blocklist.json
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `auth check` | 检查凭据状态 |
| `auth save <AK>` | 保存 API Key |
| `push` | 创建推送任务（支持 --confirm） |
| `tasks list` | 查询任务列表 |
| `tasks update` | 更新任务指标 |
| `tasks delete` | 删除草稿任务 |
| `csv split` | 拆分大 CSV |
| `review` | 单日数据复盘 |
| `blocklist` | 获取退订黑名单 |

## Agent 使用示例

```python
import subprocess
import json

# 推送预览
result = subprocess.run(
    ["lbp-growth", "push", "--name", "测试", "--format", "card",
     "--content", "hello", "--apps", "app1,app2"],
    capture_output=True, text=True
)
data = json.loads(result.stdout)
print(f"将推送至 {data['request_preview']['app_count']} 个用户")

# 确认推送
subprocess.run([
    "lbp-growth", "push", "--name", "测试", "--format", "card",
    "--content", "hello", "--apps", "app1,app2", "--confirm"
])
```

## 返回码

| 码 | 含义 |
|----|------|
| 0 | 成功 |
| 1 | 参数错误 |
| 2 | 未配置 AK |
| 3 | AK 无效 |
| 4 | API 请求失败 |

## 更多信息

- 仓库: https://github.com/bytedance/lbp-growth-cli
- 问题反馈: https://github.com/bytedance/lbp-growth-cli/issues
