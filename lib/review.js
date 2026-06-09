/**
 * Daily review report generation
 */
const { TASKS_URL, BASE_URL } = require('./config');
const { httpGet } = require('./http');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function safeInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

function safeFloat(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0.0 : n;
}

async function fetchAllTasks(day, ak, pageSize = 200) {
  const items = [];
  let page = 1;

  while (true) {
    const qs = new URLSearchParams({ day, page: String(page), pageSize: String(pageSize) });
    const url = `${TASKS_URL}?${qs}`;
    const { status, body } = await httpGet(url, ak);

    if (!(status >= 200 && status < 300 && body.items)) {
      return { items: null, error: { status, response: body } };
    }

    items.push(...body.items);
    const total = safeInt(body.total);

    if (items.length >= total || body.items.length === 0) break;
    page++;
    if (page > 50) break; // Safety limit
  }

  return { items, error: null };
}

function aggregate(items) {
  const totalCount = items.reduce((sum, t) => sum + safeInt(t.totalCount), 0);
  const successCount = items.reduce((sum, t) => sum + safeInt(t.successCount), 0);
  const failureCount = items.reduce((sum, t) => sum + safeInt(t.failureCount), 0);
  const skipCount = items.reduce((sum, t) => sum + safeInt(t.skipCount), 0);
  const pushCount = items.reduce((sum, t) => sum + safeInt(t.pushCount), 0);
  const readCount = items.reduce((sum, t) => sum + safeInt(t.readCount), 0);
  const clickCount = items.reduce((sum, t) => sum + safeInt(t.clickCount), 0);

  const rate = (numer, denom) => denom > 0 ? Math.round((numer / denom) * 100 * 100) / 100 : 0.0;

  const readRate = rate(readCount, pushCount);
  const actionRate = rate(clickCount, readCount);
  const overallRate = rate(clickCount, pushCount);

  const statusDist = {};
  items.forEach(t => {
    const s = t.status || 'unknown';
    statusDist[s] = (statusDist[s] || 0) + 1;
  });

  return {
    task_count: items.length,
    status_dist: statusDist,
    total_count: totalCount,
    success_count: successCount,
    failure_count: failureCount,
    skip_count: skipCount,
    push_count: pushCount,
    read_count: readCount,
    click_count: clickCount,
    read_rate: readRate,
    action_rate: actionRate,
    overall_rate: overallRate,
    success_rate: rate(successCount, totalCount),
  };
}

function commentPerTask(task, agg) {
  const parts = [];
  const push = safeInt(task.pushCount);

  if (push === 0) {
    return '尚未下发或目标人群为 0，无可比性。';
  }

  const readRate = safeFloat(task.readRate);
  const actionRate = safeFloat(task.actionRate);
  const overallRate = safeFloat(task.overallRate);

  const cmp = (name, val, avg) => {
    if (avg <= 0) return null;
    const diff = Math.round((val - avg) * 100) / 100;
    if (Math.abs(diff) < 1) {
      return `${name}≈日均(${val}% vs ${avg}%)`;
    }
    const arrow = diff > 0 ? '↑' : '↓';
    return `${name}${arrow}${Math.abs(diff)}pp(${val}% vs 日均${avg}%)`;
  };

  const c1 = cmp('阅读率', readRate, agg.read_rate);
  const c2 = cmp('执行率', actionRate, agg.action_rate);
  const c3 = cmp('转化率', overallRate, agg.overall_rate);

  if (c1) parts.push(c1);
  if (c2) parts.push(c2);
  if (c3) parts.push(c3);

  return parts.join('; ') || '指标在日均附近';
}

function buildMarkdown(day, items, agg) {
  const lines = [];
  lines.push(`## LBP 推送复盘 · ${day}`);
  lines.push('');

  if (items.length === 0) {
    lines.push('> 当天没有任何推送任务记录。');
    return lines.join('\n');
  }

  // Overview
  lines.push('### 当日总览');
  lines.push('');
  lines.push(`- 任务数:**${agg.task_count}** 条 (状态分布: ${Object.entries(agg.status_dist).map(([k, v]) => `${k}×${v}`).join(', ')})`);
  lines.push(`- 圈选总数(totalCount):**${agg.total_count.toLocaleString()}** (发送数 ${agg.success_count.toLocaleString()} / 失败 ${agg.failure_count.toLocaleString()} / 跳过 ${agg.skip_count.toLocaleString()},发送成功率 **${agg.success_rate}%**)`);
  lines.push(`- 推送数(pushCount):**${agg.push_count.toLocaleString()}** 次`);
  lines.push(`- 阅读数(readCount):**${agg.read_count.toLocaleString()}** 次 · 加权阅读率 **${agg.read_rate}%**`);
  lines.push(`- 执行数(clickCount):**${agg.click_count.toLocaleString()}** 次 · 加权执行率 **${agg.action_rate}%** · 加权转化率 **${agg.overall_rate}%**`);
  lines.push('');
  lines.push('> 口径:阅读率=阅读/推送、执行率=执行/阅读、转化率=执行/推送(整体均为加权口径)。');
  lines.push('');

  // Insights
  lines.push('### 数据解读');
  lines.push('');

  const insights = [];
  if (agg.push_count === 0) {
    insights.push('- 当日有任务，但推送数(pushCount)为 0，可能全部仍是草稿或刚提交未下发。');
  } else {
    if (agg.read_rate >= 60) {
      insights.push(`- 阅读率 ${agg.read_rate}% 处于高位(≥60%)，触达质量良好。`);
    } else if (agg.read_rate >= 40) {
      insights.push(`- 阅读率 ${agg.read_rate}% 处于中段(40%–60%)，仍有提升空间，可优化推送时段或卡片首屏。`);
    } else {
      insights.push(`- 阅读率 ${agg.read_rate}% 偏低(<40%)，建议检查推送时机、目标人群匹配度或卡片标题吸引力。`);
    }

    if (agg.action_rate >= 25) {
      insights.push(`- 执行率(阅读→执行) ${agg.action_rate}% 较高，卡片 CTA 设计有效。`);
    } else if (agg.action_rate >= 10) {
      insights.push(`- 执行率 ${agg.action_rate}% 中等，建议在文案/按钮上做 A/B 测试进一步优化。`);
    } else {
      insights.push(`- 执行率 ${agg.action_rate}% 偏低(<10%)，CTA 引导可能不够明确。`);
    }

    if (agg.success_rate < 95 && agg.total_count > 0) {
      insights.push(`- 发送成功率 ${agg.success_rate}% 不足 95%，需关注失败原因(权限/账号有效性等)。`);
    }
  }

  if (insights.length === 0) {
    insights.push('- 各项指标暂无明显异常。');
  }

  lines.push(...insights);
  lines.push('');

  // Per task details
  const pushed = items.filter(t => safeInt(t.pushCount) > 0);
  const notPushed = items.filter(t => safeInt(t.pushCount) === 0);
  pushed.sort((a, b) => safeInt(b.pushCount) - safeInt(a.pushCount));

  lines.push('### 单任务明细(按下发量倒序)');
  lines.push('');

  if (pushed.length > 0) {
    lines.push('| # | 任务名 | 状态 | 圈选数 | 推送数 | 阅读数 | 执行数 | 阅读率 | 执行率 | 转化率 | 评价 |');
    lines.push('|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|');

    pushed.forEach((t, i) => {
      const name = (t.name || '(未命名)').replace(/\|/g, '/');
      const status = t.status || '-';
      const row = `| ${i + 1} | ${name} | ${status} | ${safeInt(t.totalCount).toLocaleString()} | ${safeInt(t.pushCount).toLocaleString()} | ${safeInt(t.readCount).toLocaleString()} | ${safeInt(t.clickCount).toLocaleString()} | ${t.readRate || 0}% | ${t.actionRate || 0}% | ${t.overallRate || 0}% | ${commentPerTask(t, agg)} |`;
      lines.push(row);
    });
  } else {
    lines.push('> 当日没有任何任务真正下发。');
  }

  if (notPushed.length > 0) {
    lines.push('');
    lines.push(`### 未推送任务(${notPushed.length} 条)`);
    lines.push('');
    lines.push('以下任务推送数(pushCount)=0，可能是草稿、被跳过或仍在等待执行，不计入率值评估:');
    lines.push('');
    lines.push('| 任务名 | 状态 | 圈选数 |');
    lines.push('|---|---|---:|');

    notPushed.forEach(t => {
      const name = (t.name || '(未命名)').replace(/\|/g, '/');
      const status = t.status || '-';
      lines.push(`| ${name} | ${status} | ${safeInt(t.totalCount).toLocaleString()} |`);
    });
  }

  return lines.join('\n');
}

async function generateReview(ak, day, pageSize = 200) {
  const actualDay = day || yesterday();

  const { items, error } = await fetchAllTasks(actualDay, ak, pageSize);

  if (error) {
    return {
      ok: false,
      stage: 'review',
      day: actualDay,
      message: `获取任务失败: ${JSON.stringify(error)}`,
      summary: {
        task_count: 0,
        status_dist: {},
        total_count: 0,
        success_count: 0,
        failure_count: 0,
        skip_count: 0,
        push_count: 0,
        read_count: 0,
        click_count: 0,
        read_rate: 0.0,
        action_rate: 0.0,
        overall_rate: 0.0,
        success_rate: 0.0,
      },
      perTask: [],
      reportMd: `获取 ${actualDay} 的任务数据失败`,
    };
  }

  const agg = aggregate(items);
  const md = buildMarkdown(actualDay, items, agg);

  return {
    ok: true,
    stage: 'review',
    day: actualDay,
    summary: agg,
    perTask: items.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      total_count: safeInt(t.totalCount),
      push_count: safeInt(t.pushCount),
      read_count: safeInt(t.readCount),
      click_count: safeInt(t.clickCount),
      read_rate: t.readRate,
      action_rate: t.actionRate,
      overall_rate: t.overallRate,
      preview_url: t.id ? `${BASE_URL}/sync/${t.id}` : null,
    })),
    reportMd: md,
  };
}

module.exports = {
  yesterday,
  generateReview,
};
