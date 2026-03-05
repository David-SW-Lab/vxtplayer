// @ts-check
'use strict';

/**
 * Release Notes Generator
 * - Git log / PR 정보 수집
 * - Claude API로 분류·요약
 * - Excel / Confluence 내보내기
 */

const { execSync } = require('child_process');
const https = require('https');
const path = require('path');

const {
  ANTHROPIC_API_KEY,
  GITHUB_TOKEN,
  REPO,
  VERSION,
  FROM_REF,
  TO_REF = 'HEAD',
  EXPORT_TO = 'both',
} = process.env;

// ─── Entry ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📋 Release Notes Generator 시작');
  console.log(`   Version : ${VERSION}`);
  console.log(`   From    : ${FROM_REF || '(이전 태그 자동 감지)'}`);
  console.log(`   To      : ${TO_REF}`);
  console.log(`   Export  : ${EXPORT_TO}\n`);

  const fromRef = FROM_REF || detectPreviousTag();
  console.log(`✅ 비교 기준: ${fromRef} → ${TO_REF}\n`);

  // 1. 데이터 수집
  const rawData = await collectData(fromRef, TO_REF);

  // 2. Claude AI 분석
  console.log('🤖 Claude API로 릴리즈 노트 생성 중...');
  const releaseNote = await analyzeWithClaude(rawData, VERSION);
  console.log('✅ AI 분석 완료\n');

  // 3. 내보내기
  if (EXPORT_TO === 'excel' || EXPORT_TO === 'both') {
    const excelExporter = require('./release-notes-excel');
    await excelExporter.export(releaseNote, VERSION);
  }

  if (EXPORT_TO === 'confluence' || EXPORT_TO === 'both') {
    const confluenceExporter = require('./release-notes-confluence');
    await confluenceExporter.export(releaseNote, VERSION);
  }

  console.log('\n🎉 릴리즈 노트 생성 완료!');
}

// ─── 이전 태그 자동 감지 ──────────────────────────────────────────────────────

function detectPreviousTag() {
  try {
    return execSync('git describe --tags --abbrev=0 HEAD^', { encoding: 'utf-8' }).trim();
  } catch {
    // 태그가 없으면 첫 커밋부터
    return execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf-8' }).trim();
  }
}

// ─── 데이터 수집 ─────────────────────────────────────────────────────────────

async function collectData(fromRef, toRef) {
  console.log('📊 변경 데이터 수집 중...');

  // 1) 커밋 목록
  const commits = getCommits(fromRef, toRef);
  console.log(`   커밋 수: ${commits.length}`);

  // 2) PR 목록 (커밋 메시지에서 PR 번호 추출 + GitHub API)
  const prs = await getMergedPRs(commits);
  console.log(`   PR 수  : ${prs.length}`);

  // 3) 파일 변경 통계
  const fileStat = getFileStat(fromRef, toRef);

  return { commits, prs, fileStat, fromRef, toRef };
}

function getCommits(fromRef, toRef) {
  const raw = run(
    `git log ${fromRef}..${toRef} --pretty=format:"%H|||%s|||%an|||%ae|||%ad" --date=short --no-merges`
  );
  if (!raw) return [];

  return raw.split('\n').map((line) => {
    const [sha, subject, author, email, date] = line.split('|||');
    return { sha: sha?.trim(), subject: subject?.trim(), author: author?.trim(), email: email?.trim(), date: date?.trim() };
  }).filter((c) => c.sha);
}

async function getMergedPRs(commits) {
  const prNumbers = new Set();

  // 커밋 메시지에서 PR 번호 추출 (Merge PR #123 패턴)
  for (const commit of commits) {
    const match = commit.subject?.match(/#(\d+)/);
    if (match) prNumbers.add(Number(match[1]));
  }

  if (prNumbers.size === 0) return [];

  // GitHub API로 PR 상세 정보 조회
  const prs = await Promise.all(
    [...prNumbers].map((num) => fetchGitHub(`/repos/${REPO}/pulls/${num}`).catch(() => null))
  );

  return prs.filter(Boolean).map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login,
    labels: pr.labels?.map((l) => l.name) || [],
    body: pr.body?.slice(0, 500) || '',
    mergedAt: pr.merged_at,
    url: pr.html_url,
  }));
}

function getFileStat(fromRef, toRef) {
  const raw = run(`git diff --stat ${fromRef}..${toRef}`);
  const lines = raw.split('\n').filter(Boolean);
  const summary = lines[lines.length - 1] || '';

  const files = lines.slice(0, -1).map((line) => {
    const match = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s+([\+\-]+)/);
    if (!match) return null;
    return { file: match[1].trim(), changes: Number(match[2]), bar: match[3] };
  }).filter(Boolean);

  return { files, summary };
}

// ─── Claude AI 분석 ──────────────────────────────────────────────────────────

async function analyzeWithClaude(rawData, version) {
  const { commits, prs, fileStat, fromRef, toRef } = rawData;

  const prSummary = prs.map((pr) =>
    `PR #${pr.number}: [${pr.labels.join(', ') || 'unlabeled'}] ${pr.title} (@${pr.author})`
  ).join('\n');

  const commitSummary = commits.slice(0, 50).map((c) =>
    `${c.date} ${c.subject} (${c.author})`
  ).join('\n');

  const prompt = `당신은 소프트웨어 릴리즈 노트 작성 전문가입니다.
아래 정보를 바탕으로 릴리즈 노트를 JSON으로 작성해 주세요.

버전: ${version}
비교 범위: ${fromRef} → ${toRef}
파일 변경 요약: ${fileStat.summary}

PR 목록:
${prSummary || '(PR 정보 없음)'}

커밋 목록:
${commitSummary || '(커밋 정보 없음)'}

아래 JSON 스키마를 반드시 지켜서 응답해 주세요 (다른 텍스트 없이 JSON만 출력):
{
  "summary": "한 문단 요약 (3~4문장, 한국어)",
  "highlights": ["주요 하이라이트 1", "주요 하이라이트 2"],
  "features": [
    { "title": "기능명", "description": "설명", "pr": 123, "author": "작성자" }
  ],
  "bugfixes": [
    { "title": "버그 수정명", "description": "설명", "pr": 123, "author": "작성자" }
  ],
  "improvements": [
    { "title": "개선명", "description": "설명", "pr": 123, "author": "작성자" }
  ],
  "breaking_changes": [
    { "title": "변경명", "description": "설명 및 마이그레이션 가이드" }
  ],
  "affected_modules": ["영향받은 모듈명 목록"]
}`;

  const response = await callClaude(prompt);

  try {
    // JSON 블록 추출 (```json ... ``` 형태 대응)
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) ||
                      response.match(/```\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;
    const parsed = JSON.parse(jsonStr.trim());

    return {
      version,
      date: new Date().toISOString().split('T')[0],
      fromRef,
      toRef,
      fileStat,
      commits,
      prs,
      ...parsed,
    };
  } catch {
    console.warn('⚠️ JSON 파싱 실패, 원문 요약만 사용');
    return {
      version,
      date: new Date().toISOString().split('T')[0],
      fromRef,
      toRef,
      fileStat,
      commits,
      prs,
      summary: response.slice(0, 1000),
      highlights: [],
      features: [],
      bugfixes: [],
      improvements: [],
      breaking_changes: [],
      affected_modules: [],
    };
  }
}

// ─── HTTP 헬퍼 ───────────────────────────────────────────────────────────────

function fetchGitHub(apiPath) {
  return request('api.github.com', apiPath, 'GET', null, {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'User-Agent': 'vxtplayer-release-notes',
    Accept: 'application/vnd.github.v3+json',
  });
}

function callClaude(prompt) {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return request('api.anthropic.com', '/v1/messages', 'POST', body, {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'Content-Length': Buffer.byteLength(body),
  }).then((res) => res.content?.[0]?.text || '');
}

function request(hostname, urlPath, method, body, headers) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path: urlPath, method, headers };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }).trim();
  } catch {
    return '';
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
