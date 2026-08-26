const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const USERNAME = 'b4631119-oss';
const TOKEN = process.env.GITHUB_TOKEN;

const headers = {
  'Authorization': `token ${TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'github-readme-generator'
};

async function graphql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}

function escapeXml(str) {
  return String(str).replace(/[<>&"']/g, c => ({'<':'<','>':'>','&':'&','"':'"',"'":'&apos;'}[c]));
}

function activitySvg(weeks) {
  const width = 800, height = 400;
  const cellSize = 12, gap = 2;
  const colors = ['#1e1e2e', '#0d4429', '#266d3a', '#3bb143', '#5fc958'];
  const maxCount = Math.max(...weeks.flatMap(w => w.contributionDays.map(d => d.contributionCount)), 1);
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="10"/>
  <style>
    .month { font: 400 10px 'Segoe UI', sans-serif; fill: #a6adc8; }
    .day { font: 400 10px 'Segoe UI', sans-serif; fill: #a6adc8; }
    .title { font: 600 14px 'Segoe UI', sans-serif; fill: #cdd6f4; }
  </style>
  <text x="20" y="24" class="title">Contribution Activity</text>
  `;
  const dayLabels = ['Mon', 'Wed', 'Fri'];
  for (let i = 0; i < 3; i++) {
    svg += `<text x="5" y="${45 + i * (cellSize + gap) * 2 + 9}" class="day">${dayLabels[i]}</text>`;
  }
  let x = 30;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let monthIdx = 0;
  for (let wi = 0; wi < weeks.length; wi++) {
    const week = weeks[wi];
    if (week.contributionDays[0]) {
      const date = new Date(week.contributionDays[0].date);
      if (date.getDate() <= 7 && date.getMonth() !== monthIdx) {
        monthIdx = date.getMonth();
        svg += `<text x="${x + cellSize/2}" y="30" class="month" text-anchor="middle">${months[monthIdx]}</text>`;
      }
    }
    for (let di = 0; di < 7; di++) {
      const day = week.contributionDays[di];
      const count = day?.contributionCount || 0;
      const colorIdx = count === 0 ? 0 : Math.min(4, Math.floor((count / 10) * 4));
      svg += `<rect x="${x}" y="${45 + di * (cellSize + gap)}" width="${cellSize}" height="${cellSize}" fill="${colors[colorIdx]}" rx="2"/>`;
    }
    x += cellSize + gap;
  }
  svg += `
  <g transform="translate(${width - 200}, 30)">
    <text x="0" y="0" font="500 11px sans-serif" fill="#cdd6f4">Less</text>
    <text x="150" y="0" font="500 11px sans-serif" fill="#cdd6f4" text-anchor="end">More</text>
    <g transform="translate(0, 15)">
      ${colors.map((c, i) => `<rect x="${i * 30}" y="0" width="25" height="10" fill="${c}" rx="2"/>`).join('')}
    </g>
  </g>
</svg>`;
  return svg;
}

async function main() {
  const contributionsQuery = `
    query($user: String!) {
      user(login: $user) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays { contributionCount date }
            }
          }
        }
      }
    }`;
  const gql = await graphql(contributionsQuery, { user: USERNAME });
  const weeks = gql.user.contributionsCollection.contributionCalendar.weeks;

  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/activity-graph.svg', activitySvg(weeks));
  console.log('Generated activity-graph.svg');
}

main().catch(e => { console.error(e); process.exit(1); });