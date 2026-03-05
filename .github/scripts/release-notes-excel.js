// @ts-check
'use strict';

/**
 * Release Notes → Excel (.xlsx) 내보내기
 * Sheet 1: Summary   – 버전, 날짜, 요약, 하이라이트
 * Sheet 2: Changes   – PR별 카테고리/제목/작성자
 * Sheet 3: Commits   – 전체 커밋 목록
 * Sheet 4: Files     – 변경 파일 통계
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// 헤더 스타일 (xlsx community edition은 스타일 미지원, SheetJS Pro 필요)
// 현재는 값만 채우고 열 너비만 조정

/**
 * @param {object} data - AI 분석 결과
 * @param {string} version - 버전 문자열
 */
async function exportExcel(data, version) {
  const fileName = `release-notes-${version}-${data.date}.xlsx`;
  const wb = XLSX.utils.book_new();

  addSummarySheet(wb, data);
  addChangesSheet(wb, data);
  addCommitsSheet(wb, data);
  addFilesSheet(wb, data);

  XLSX.writeFile(wb, fileName);
  console.log(`✅ Excel 저장 완료: ${fileName}`);
}

// ─── Sheet 1: Summary ────────────────────────────────────────────────────────

function addSummarySheet(wb, data) {
  const rows = [
    ['VXTPlayer 릴리즈 노트'],
    [],
    ['버전',       data.version],
    ['릴리즈 일자', data.date],
    ['비교 범위',   `${data.fromRef} → ${data.toRef}`],
    ['변경 파일 요약', data.fileStat?.summary || ''],
    [],
    ['▶ 요약'],
    [data.summary || ''],
    [],
    ['▶ 주요 변경사항 (Highlights)'],
    ...(data.highlights || []).map((h) => [`  • ${h}`]),
    [],
    ['▶ 영향받은 모듈'],
    [(data.affected_modules || []).join(', ')],
    [],
    ['▶ Breaking Changes'],
    ...(data.breaking_changes?.length
      ? data.breaking_changes.map((b) => [`  ⚠️ ${b.title}`, b.description])
      : [['  (없음)']]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [30, 80]);
  XLSX.utils.book_append_sheet(wb, ws, '📋 Summary');
}

// ─── Sheet 2: Changes ────────────────────────────────────────────────────────

function addChangesSheet(wb, data) {
  const header = ['카테고리', 'PR #', '제목', '설명', '작성자', '날짜', 'URL'];

  const rows = [
    header,
    ...buildChangeRows('✨ Feature',     data.features     || [], data.prs),
    ...buildChangeRows('🐛 Bug Fix',     data.bugfixes     || [], data.prs),
    ...buildChangeRows('♻️ Improvement', data.improvements || [], data.prs),
  ];

  // PR이 없으면 커밋 기반으로 채우기
  if (rows.length === 1) {
    for (const commit of (data.commits || []).slice(0, 100)) {
      rows.push(['커밋', '', commit.subject, '', commit.author, commit.date, '']);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [16, 8, 40, 60, 16, 12, 50]);
  XLSX.utils.book_append_sheet(wb, ws, '📝 Changes');
}

function buildChangeRows(category, items, prs) {
  return items.map((item) => {
    const pr = prs?.find((p) => p.number === item.pr);
    return [
      category,
      item.pr ? `#${item.pr}` : '',
      item.title,
      item.description || '',
      item.author || pr?.author || '',
      pr?.mergedAt?.split('T')[0] || '',
      pr?.url || '',
    ];
  });
}

// ─── Sheet 3: Commits ────────────────────────────────────────────────────────

function addCommitsSheet(wb, data) {
  const header = ['날짜', '작성자', '커밋 메시지', 'SHA'];
  const rows = [
    header,
    ...(data.commits || []).map((c) => [c.date, c.author, c.subject, c.sha?.slice(0, 8)]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [12, 18, 70, 10]);
  XLSX.utils.book_append_sheet(wb, ws, '📌 Commits');
}

// ─── Sheet 4: Files ──────────────────────────────────────────────────────────

function addFilesSheet(wb, data) {
  const header = ['파일 경로', '변경 라인 수', '+/-'];
  const rows = [
    header,
    ...(data.fileStat?.files || []).map((f) => [f.file, f.changes, f.bar]),
    [],
    ['합계', data.fileStat?.summary || ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [70, 16, 20]);
  XLSX.utils.book_append_sheet(wb, ws, '📂 Files');
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

module.exports = { export: exportExcel };
