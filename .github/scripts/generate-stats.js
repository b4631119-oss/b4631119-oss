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

async function rest(endpoint) {
  const res = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function escapeXml(str) {
  return String(str).replace(/[<>&"']/g, c => ({'<':'<','>':'>','&':'&','"':'"',"'":'&apos;'}[c]));
}

function statsSvg(data) {
  const { totalStars, totalCommits, totalPRs, totalIssues, totalRepos, followers, following } = data;
  const width = 495, height = 195;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="10"/>
  <style>
    .title { font: 600 14px 'Segoe UI', sans-serif; fill: #cdd6f4; }
    .stat { font: 600 28px 'Segoe UI', sans-serif; fill: #f9e2af; }
    .label { font: 400 12px 'Segoe UI', sans-serif; fill: #a6adc8; }
    .card { fill: #313244; rx: 8; }
  </style>
  <text x="20" y="30" class="title">${escapeXml(USERNAME)}'s GitHub Stats</text>
  <g transform="translate(20, 50)">
    <rect class="card" x="0" y="0" width="145" height="120"/>
    <text x="10" y="35" class="stat">${totalStars}</text>
    <text x="10" y="55" class="label">Total Stars</text>
    <text x="10" y="85" class="stat">${totalRepos}</text>
    <text x="10" y="105" class="label">Repositories</text>
  </g>
  <g transform="translate(175, 50)">
    <rect class="card" x="0" y="0" width="145" height="120"/>
    <text x="10" y="35" class="stat">${totalCommits}</text>
    <text x="10" y="55" class="label">Commits (year)</text>
    <text x="10" y="85" class="stat">${totalPRs}</text>
    <text x="10" y="105" class="label">Pull Requests</text>
  </g>
  <g transform="translate(330, 50)">
    <rect class="card" x="0" y="0" width="145" height="120"/>
    <text x="10" y="35" class="stat">${followers}</text>
    <text x="10" y="55" class="label">Followers</text>
    <text x="10" y="85" class="stat">${following}</text>
    <text x="10" y="105" class="label">Following</text>
  </g>
</svg>`;
}

function langsSvg(langs) {
  const width = 320, height = 160;
  const colors = {
    JavaScript: '#f1e05a', TypeScript: '#2b7489', Python: '#3572A5',
    HTML: '#e34c26', CSS: '#563d7c', 'C++': '#f34b7d',
    Java: '#b07219', Go: '#00ADD8', Rust: '#dea584',
    PHP: '#4F5D95', Ruby: '#701516', Swift: '#ffac45',
    Kotlin: '#F18E33', Dart: '#00B4AB', Shell: '#89e051',
    Vue: '#41b883', Svelte: '#ff3e00'
  };
  const sorted = Object.entries(langs).sort((a,b) => b[1] - a[1]).slice(0, 8);
  const total = sorted.reduce((s, [,v]) => s + v, 0);
  let y = 30;
  let bars = '';
  for (const [lang, bytes] of sorted) {
    const pct = ((bytes / total) * 100).toFixed(1);
    const w = Math.max(4, (bytes / total) * 260);
    const color = colors[lang] || '#89b4fa';
    bars += `<rect x="100" y="${y-8}" width="${w}" height="14" fill="${color}" rx="3"/>`;
    bars += `<text x="95" y="${y+4}" font="600 11px sans-serif" fill="#cdd6f4" text-anchor="end">${escapeXml(lang)}</text>`;
    bars += `<text x="105+${w}" y="${y+4}" font="500 11px sans-serif" fill="#a6adc8">${pct}%</text>`;
    y += 24;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="10"/>
  <style>
    .title { font: 600 14px 'Segoe UI', sans-serif; fill: #cdd6f4; }
  </style>
  <text x="20" y="24" class="title">Most Used Languages</text>
  ${bars}
</svg>`;
}

async function main() {
  const user = await rest(`/users/${USERNAME}`);
  const repos = [];
  for (let page = 1; ; page++) {
    const pageRepos = await rest(`/users/${USERNAME}/repos?per_page=100&page=${page}&sort=pushed`);
    if (!pageRepos.length) break;
    repos.push(...pageRepos);
  }

  const contributionsQuery = `
    query($user: String!) {
      user(login: $user) {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays { contributionCount date }
            }
          }
        }
        repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
          nodes {
            stargazerCount
            languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
              edges { size node { name color } }
            }
          }
        }
        followers { totalCount }
        following { totalCount }
      }
    }`;
  const gql = await graphql(contributionsQuery, { user: USERNAME });
  const u = gql.user;
  const cc = u.contributionsCollection;
  const totalCommits = cc.totalCommitContributions;
  const totalPRs = cc.totalPullRequestContributions;
  const totalIssues = cc.totalIssueContributions;
  const totalStars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const totalRepos = u.repositories.nodes.length;
  const followers = u.followers.totalCount;
  const following = u.following.totalCount;

  const langs = {};
  for (const repo of u.repositories.nodes) {
    for (const edge of repo.languages.edges) {
      const { name, color } = edge.node;
      langs[name] = (langs[name] || 0) + edge.size;
    }
  }

  fs.mkdirSync('dist-stats', { recursive: true });
  fs.mkdirSync('dist-langs', { recursive: true });
  fs.writeFileSync('dist-stats/stats.svg', statsSvg({ totalStars, totalCommits, totalPRs, totalIssues, totalRepos, followers, following }));
  fs.writeFileSync('dist-langs/languages.svg', langsSvg(langs));
  console.log('Generated stats.svg and languages.svg');
}

main().catch(e => { console.error(e); process.exit(1); });