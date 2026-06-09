# LBP Growth CLI

LBP 实验增长系统 CLI - Agent 友好的推送任务管理工具。

纯 Node.js 实现，无需 Python 依赖。

## 安装

### 方式 1: 使用 npx（推荐）

```bash
npx lbp-growth-cli --help
npx lbp-growth-cli auth check
```

### 方式 2: 全局安装

```bash
npm install -g lbp-growth-cli
lbp-growth --help
```

### 方式 3: Skills 管理器

```bash
npx skills add bytedance/lbp-growth-cli
npx skills run lbp-growth --help
```

## 快速开始

```bash
# 1. 配置 API Key
lbp-growth auth save <YOUR_API_KEY>

# 2. 检查凭据
lbp-growth auth check

# 3. 创建推送任务（预览）
lbp-growth push --name "测试推送" --format card --content "你好" --apps app1,app2

# 4. 确认推送
lbp-growth push --name "测试推送" --format card --content "你好" --apps app1,app2 --confirm

# 5. 查询任务
lbp-growth tasks list --day 2026-06-09

# 6. 生成复盘报告
lbp-growth review
```

## 命令参考

### Auth 命令 - 凭据管理

```bash
lbp-growth auth check                    # 检查凭据状态
lbp-growth auth save <API_KEY>           # 保存并校验 API Key
lbp-growth auth show                     # 显示当前凭据（脱敏）
```

### Push 命令 - 创建推送

```bash
# Card 格式
lbp-growth push --name "测试" --format card --content "hello" --apps a1,a2

# Release Note 格式
lbp-growth push --name "发布" --format releaseNote --release-note-ids note1 --csv users.csv

# 定时推送
lbp-growth push --name "定时" --format card --content "..." --apps a1 \
    --schedule-type scheduled --schedule-time 2026-06-09T10:00:00.000Z

# 正式发送（必须加 --confirm）
lbp-growth push ... --confirm
```

### Tasks 命令 - 任务管理

```bash
# 查询任务列表
lbp-growth tasks list --day 2026-06-09 --page 1 --page-size 20

# 更新任务指标
lbp-growth tasks update <TASK_ID> --read-count 1000 --click-count 200

# 删除草稿任务
lbp-growth tasks delete <TASK_ID> --confirm
```

### CSV 命令 - 文件处理

```bash
# 拆分大 CSV（超过 15 万行）
lbp-growth csv split big.csv --out-dir ./chunks --rows-per-file 150000
```

### Review 命令 - 数据复盘

```bash
# 复盘昨天
lbp-growth review

# 复盘指定日期
lbp-growth review --day 2026-06-08
```

### Blocklist 命令 - 黑名单

```bash
# 获取黑名单
lbp-growth blocklist

# 保存到文件
lbp-growth blocklist -o blocklist.json
```

## 返回码说明

| 返回码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 参数错误 |
| 2 | 未配置 AK |
| 3 | AK 无效 |
| 4 | API 请求失败 |

## Agent 使用示例

```javascript
const { execSync } = require('child_process');

// 检查凭据
const authResult = JSON.parse(execSync('lbp-growth auth check', { encoding: 'utf8' }));
if (!authResult.ok) {
  console.log('需要配置 API Key');
}

// 推送预览
const result = JSON.parse(execSync(
  'lbp-growth push --name "测试" --format card --content "hello" --apps app1,app2',
  { encoding: 'utf8' }
));
console.log(`将推送至 ${result.request_preview.app_count} 个用户`);

// 确认推送
execSync('lbp-growth push --name "测试" --format card --content "hello" --apps app1,app2 --confirm');
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
├── SKILL.md                 # 技能定义（for npx skills）
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

## License

MIT
