// @ts-check
'use strict';

/**
 * Release Notes → Confluence 내보내기
 * - 같은 제목의 페이지가 있으면 업데이트, 없으면 새로 생성
 * - Confluence REST API v2 사용
 */

const https = require('https');
const { URL } = require('url');

const {
  CONFLUENCE_BASE_URL,
  CONFLUENCE_TOKEN,
  CONFLUENCE_SPACE_KEY,
  CONFLUENCE_PARENT_PAGE_ID,
} = process.env;

/**
 * @param {object} data - AI 분석 결과
 * @param {string} version - 버전 문자열
 */
async function exportConfluence(data, version) {
  if (!CONFLUENCE_BASE_URL || !CONFLUENCE_TOKEN || !CONFLUENCE_SPACE_KEY) {
    console.warn('⚠️  Confluence secrets가 설정되지 않아 스킵합니다.');
    console.warn('   필요 secrets: CONFLUENCE_BASE_URL, CONFLUENCE_TOKEN, CONFLUENCE_SPACE_KEY');
    return;
  }

  const title = `VXTPlayer Release Notes v${version} (${data.date})`;
  const body = buildConfluenceBody(data, version);

  // 기존 페이지 검색
  const existingPage = await findPage(title);

  if (existingPage) {
    await updatePage(existingPage.id, existingPage.version.number + 1, title, body);
    console.log(`✅ Confluence 페이지 업데이트: ${CONFLUENCE_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${existingPage.id}`);
  } else {
    const newPage = await createPage(title, body);
    console.log(`✅ Confluence 페이지 생성: ${CONFLUENCE_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${newPage.id}`);
  }
}

// ─── Confluence Storage Format (HTML) 생성 ───────────────────────────────────

function buildConfluenceBody(data, version) {
  const sections = [];

  // 메타 정보 패널
  sections.push(`
<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>Version:</strong> ${version} &nbsp;|&nbsp;
       <strong>Date:</strong> ${data.date} &nbsp;|&nbsp;
       <strong>Range:</strong> ${data.fromRef} → ${data.toRef}</p>
    <p><strong>Files Changed:</strong> ${data.fileStat?.summary || 'N/A'}</p>
  </ac:rich-text-body>
</ac:structured-macro>`);

  // 요약
  sections.push(`
<h2>📋 릴리즈 요약</h2>
<p>${esc(data.summary || '')}</p>`);

  // Highlights
  if (data.highlights?.length) {
    sections.push(`
<h2>⭐ 주요 변경사항</h2>
<ul>
  ${data.highlights.map((h) => `<li>${esc(h)}</li>`).join('\n  ')}
</ul>`);
  }

  // Breaking Changes (경고 패널)
  if (data.breaking_changes?.length) {
    const rows = data.breaking_changes.map((b) => `
<tr>
  <td><strong>${esc(b.title)}</strong></td>
  <td>${esc(b.description)}</td>
</tr>`).join('');

    sections.push(`
<h2>⚠️ Breaking Changes</h2>
<ac:structured-macro ac:name="warning">
  <ac:rich-text-body>
    <table>
      <thead><tr><th>항목</th><th>설명 및 마이그레이션 가이드</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </ac:rich-text-body>
</ac:structured-macro>`);
  }

  // Features
  if (data.features?.length) {
    sections.push(buildChangeTable('✨ 새 기능 (Features)', data.features, data.prs));
  }

  // Bug Fixes
  if (data.bugfixes?.length) {
    sections.push(buildChangeTable('🐛 버그 수정 (Bug Fixes)', data.bugfixes, data.prs));
  }

  // Improvements
  if (data.improvements?.length) {
    sections.push(buildChangeTable('♻️ 개선사항 (Improvements)', data.improvements, data.prs));
  }

  // 영향 모듈
  if (data.affected_modules?.length) {
    sections.push(`
<h2>📦 영향받은 모듈</h2>
<p>${data.affected_modules.map((m) => `<code>${esc(m)}</code>`).join(' &nbsp; ')}</p>`);
  }

  // 전체 커밋 목록 (접기)
  if (data.commits?.length) {
    const commitRows = data.commits.map((c) => `
<tr>
  <td>${esc(c.date)}</td>
  <td>${esc(c.author)}</td>
  <td>${esc(c.subject)}</td>
  <td><code>${c.sha?.slice(0, 8)}</code></td>
</tr>`).join('');

    sections.push(`
<h2>📌 전체 커밋 목록</h2>
<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">커밋 ${data.commits.length}개 보기</ac:parameter>
  <ac:rich-text-body>
    <table>
      <thead><tr><th>날짜</th><th>작성자</th><th>메시지</th><th>SHA</th></tr></thead>
      <tbody>${commitRows}</tbody>
    </table>
  </ac:rich-text-body>
</ac:structured-macro>`);
  }

  // 변경 파일 (접기)
  if (data.fileStat?.files?.length) {
    const fileRows = data.fileStat.files.map((f) => `
<tr>
  <td><code>${esc(f.file)}</code></td>
  <td style="text-align:right;">${f.changes}</td>
  <td><code>${esc(f.bar)}</code></td>
</tr>`).join('');

    sections.push(`
<h2>📂 변경 파일</h2>
<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">파일 ${data.fileStat.files.length}개 보기</ac:parameter>
  <ac:rich-text-body>
    <table>
      <thead><tr><th>파일</th><th>변경 라인</th><th>+/-</th></tr></thead>
      <tbody>${fileRows}</tbody>
    </table>
    <p><strong>${esc(data.fileStat.summary)}</strong></p>
  </ac:rich-text-body>
</ac:structured-macro>`);
  }

  // 푸터
  sections.push(`
<hr/>
<p><em>🤖 이 릴리즈 노트는 Claude AI가 자동 생성했습니다. (GitHub Actions)</em></p>`);

  return sections.join('\n');
}

function buildChangeTable(title, items, prs) {
  const rows = items.map((item) => {
    const pr = prs?.find((p) => p.number === item.pr);
    const prLink = pr
      ? `<a href="${pr.url}">#${item.pr}</a>`
      : (item.pr ? `#${item.pr}` : '-');
    return `
<tr>
  <td>${prLink}</td>
  <td><strong>${esc(item.title)}</strong><br/><small>${esc(item.description || '')}</small></td>
  <td>${esc(item.author || pr?.author || '')}</td>
  <td>${pr?.mergedAt?.split('T')[0] || ''}</td>
</tr>`;
  }).join('');

  return `
<h2>${title}</h2>
<table>
  <thead>
    <tr><th>PR</th><th>내용</th><th>작성자</th><th>날짜</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Confluence REST API v2 ───────────────────────────────────────────────────

async function findPage(title) {
  const encoded = encodeURIComponent(title);
  const result = await confluenceRequest(
    'GET',
    `/wiki/api/v2/pages?spaceKey=${CONFLUENCE_SPACE_KEY}&title=${encoded}&limit=1`
  );
  return result?.results?.[0] || null;
}

async function createPage(title, body) {
  const payload = {
    spaceId: await getSpaceId(),
    status: 'current',
    title,
    parentId: CONFLUENCE_PARENT_PAGE_ID || undefined,
    body: { representation: 'storage', value: body },
  };
  return confluenceRequest('POST', '/wiki/api/v2/pages', payload);
}

async function updatePage(pageId, newVersion, title, body) {
  const payload = {
    id: pageId,
    status: 'current',
    title,
    version: { number: newVersion, message: 'Auto-updated by GitHub Actions' },
    body: { representation: 'storage', value: body },
  };
  return confluenceRequest('PUT', `/wiki/api/v2/pages/${pageId}`, payload);
}

async function getSpaceId() {
  const result = await confluenceRequest('GET', `/wiki/api/v2/spaces?keys=${CONFLUENCE_SPACE_KEY}&limit=1`);
  const space = result?.results?.[0];
  if (!space) throw new Error(`Confluence space '${CONFLUENCE_SPACE_KEY}'를 찾을 수 없습니다.`);
  return space.id;
}

function confluenceRequest(method, urlPath, body = null) {
  const base = new URL(CONFLUENCE_BASE_URL);
  const bodyStr = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: base.hostname,
      path: urlPath,
      method,
      headers: {
        Authorization: `Bearer ${CONFLUENCE_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Confluence API ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = { export: exportConfluence };
