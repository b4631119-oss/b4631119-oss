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

function trophySvg(data) {
  const { totalStars, totalRepos, followers, totalCommits, trophies } = data;
  const width = 495, height = 195;
  const trophyList = [
    { name: 'Starstruck', icon: '⭐', value: totalStars, threshold: 16 },
    { name: 'Repo Master', icon: '📦', value: totalRepos, threshold: 10 },
    { name: 'Popular', icon: '👥', value: followers, threshold: 20 },
    { name: 'Committer', icon: '💻', value: totalCommits, threshold: 100 },
    { name: 'Heart On Your Sleeve', icon: '❤️', value: trophies.starsReceived || 0, threshold: 1 }
  ];
  let y = 30;
  let items = '';
  for (const t of trophyList) {
    const earned = t.value >= t.threshold;
    items += `<g transform="translate(20, ${y})">`;
    items += `<rect x="0" y="0" width="455" height="28" fill="${earned ? '#313244' : '#282a36'}" rx="6"/>`;
    items += `<text x="12" y="19" font="600 12px sans-serif" fill="${earned ? '#f9e2af' : '#6272a4'}">${t.icon} ${t.name}</text>`;
    items += `<text x="440" y="19" font="500 11px sans-serif" fill="#a6adc8" text-anchor="end">${earned ? '✓' : t.value + '/' + t.threshold}</text>`;
    items += `</g>`;
    y += 32;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="195" viewBox="0 0 495 195" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1e1e2e" rx="10"/>
  <style>
    .title { font: 600 14px 'Segoe UI', sans-serif; fill: #cdd6f4; }
  </style>
  <text x="20" y="24" class="title">GitHub Profile Trophy</text>
  ${items}
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
        }
        repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
          nodes { stargazerCount }
        }
        followers { totalCount }
      }
    }`;
  const gql = await graphql(contributionsQuery, { user: USERNAME });
  const u = gql.user;
  const cc = u.contributionsCollection;
  const totalCommits = cc.totalCommitContributions;
  const totalStars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const totalRepos = u.repositories.nodes.length;
  const followers = u.followers.totalCount;

  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/trophy.svg', trophySvg({ totalStars, totalRepos, followers, totalCommits, trophies: {} }));
  fs.writeFileSync('dist/github-contribution-trophy.svg', trophySvg({ totalStars, totalRepos, followers, totalCommits, trophies: {} }));
  console.log('Generated trophy.svg');
}

main().catch(e => { console.error(e); process.exit(1); });