// @ts-check
'use strict';

const { execSync } = require('child_process');
const https = require('https');

const SECTION_변경내용 = '## :pencil: 변경 내용';
const SECTION_PR_POINT = '## :pushpin: PR Point';
const MAX_DIFF_CHARS = 8000;
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

async function main() {
  const {
    ANTHROPIC_API_KEY,
    GITHUB_TOKEN,
    PR_NUMBER,
    PR_TITLE,
    PR_BODY,
    BASE_REF,
    REPO,
  } = process.env;

  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY secret이 설정되지 않았습니다.');
    console.error('   GitHub 리포지토리 Settings → Secrets → ANTHROPIC_API_KEY 를 추가하세요.');
    process.exit(1);
  }

  console.log(`\n🔍 PR #${PR_NUMBER} 분석 중...`);
  console.log(`   Title: ${PR_TITLE}`);
  console.log(`   Base: ${BASE_REF}`);

  // 이미 변경 내용이 작성된 경우 스킵
  if (hasUserContent(PR_BODY, SECTION_변경내용, SECTION_PR_POINT)) {
    console.log('\n✅ 변경 내용이 이미 작성되어 있어 스킵합니다.');
    process.exit(0);
  }

  // diff 수집
  const { stats, diff, commits } = getDiffInfo(BASE_REF);

  if (!diff && !commits) {
    console.log('\n⚠️  변경 사항이 없어 스킵합니다.');
    process.exit(0);
  }

  // Claude API 호출
  console.log('\n🤖 Claude API 호출 중...');
  const aiContent = await generateDescription({ PR_TITLE, stats, diff, commits, ANTHROPIC_API_KEY });

  if (!aiContent) {
    console.error('❌ AI 응답을 받지 못했습니다.');
    process.exit(1);
  }

  // PR 본문 업데이트
  const newBody = buildNewBody(PR_BODY, aiContent);
  await updatePR(GITHUB_TOKEN, REPO, PR_NUMBER, newBody);

  console.log('\n✅ PR 설명이 자동 생성되었습니다!');
}

// ─── diff 수집 ────────────────────────────────────────────────────────────────

function getDiffInfo(baseRef) {
  const run = (cmd) => {
    try {
      return execSync(cmd, { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }).trim();
    } catch {
      return '';
    }
  };

  const stats = run(`git diff --stat origin/${baseRef}...HEAD`);
  const commits = run(`git log origin/${baseRef}...HEAD --pretty=format:"%s" --no-merges`);

  let diff = run(
    `git diff origin/${baseRef}...HEAD -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.css" "*.styl"`
  );

  // 파일 변경 내용이 없으면 전체 diff
  if (!diff) {
    diff = run(`git diff origin/${baseRef}...HEAD`);
  }

  if (diff.length > MAX_DIFF_CHARS) {
    diff = diff.substring(0, MAX_DIFF_CHARS) + '\n\n... (diff 생략됨)';
  }

  return { stats, diff, commits };
}

// ─── Claude API 호출 ──────────────────────────────────────────────────────────

function generateDescription({ PR_TITLE, stats, diff, commits, ANTHROPIC_API_KEY }) {
  const prompt = `당신은 코드 변경사항을 분석하여 한국어로 PR 설명을 작성하는 도우미입니다.

PR 제목: ${PR_TITLE}

커밋 메시지:
${commits || '(없음)'}

변경된 파일 통계:
${stats || '(없음)'}

코드 diff:
${diff || '(없음)'}

위 정보를 바탕으로 PR의 "변경 내용" 섹션을 작성해 주세요.

규칙:
- 한국어로 작성
- 3~5개의 bullet point
- 각 항목은 관련 이모지로 시작 (예: ✨ 기능 추가, 🐛 버그 수정, ♻️ 리팩토링, 🔧 설정 변경, 📝 문서)
- 비즈니스 관점에서 무엇이 왜 바뀌었는지 간결하게
- "변경 내용" 섹션의 내용만 출력 (다른 텍스트 없이 bullet point만)`;

  const body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`Claude API error: ${parsed.error.message}`));
          } else {
            resolve(parsed.content?.[0]?.text?.trim() || null);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── PR 본문 조작 ─────────────────────────────────────────────────────────────

function hasUserContent(body, startSection, endSection) {
  if (!body) return false;

  const start = body.indexOf(startSection);
  if (start === -1) return false;

  const end = body.indexOf(endSection, start);
  const sectionText = end !== -1
    ? body.slice(start + startSection.length, end)
    : body.slice(start + startSection.length);

  // HTML 주석 제거 후 내용 확인
  const stripped = sectionText.replace(/<!--[\s\S]*?-->/g, '').trim();
  return stripped.length > 0;
}

function buildNewBody(currentBody, aiContent) {
  const aiBlock = `\n<!-- 🤖 AI 자동 생성 -->\n${aiContent}\n`;

  // 기존 본문이 없거나 섹션이 없으면 전체 템플릿 생성
  if (!currentBody || !currentBody.includes(SECTION_변경내용)) {
    return `## :bell: 관련 이슈
<!--
  지라 이슈 번호를 적어주세요.
-->

close

## :exclamation: 문제 & 변경 이유

## :pencil: 변경 내용
${aiBlock}
## :pushpin: PR Point

## :loudspeaker: 참고 사항
`;
  }

  // 변경 내용 섹션만 AI 내용으로 채우기
  const sectionStart = currentBody.indexOf(SECTION_변경내용);
  const nextSection = currentBody.indexOf(SECTION_PR_POINT, sectionStart);

  const before = currentBody.slice(0, sectionStart + SECTION_변경내용.length);
  const after = nextSection !== -1 ? currentBody.slice(nextSection) : '';

  // HTML 주석(기존 가이드)은 유지하고 그 아래에 AI 내용 삽입
  const middle = nextSection !== -1
    ? currentBody.slice(sectionStart + SECTION_변경내용.length, nextSection)
    : '';
  const comments = extractComments(middle);

  return `${before}${comments}${aiBlock}${after}`;
}

function extractComments(text) {
  const matches = text.match(/<!--[\s\S]*?-->/g);
  return matches ? '\n' + matches.join('\n') + '\n' : '\n';
}

// ─── GitHub API ───────────────────────────────────────────────────────────────

function updatePR(token, repo, prNumber, body) {
  const data = JSON.stringify({ body });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}/pulls/${prNumber}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'vxtplayer-pr-bot',
        Accept: 'application/vnd.github.v3+json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Entry ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('❌ 오류 발생:', err.message);
  process.exit(1);
});
