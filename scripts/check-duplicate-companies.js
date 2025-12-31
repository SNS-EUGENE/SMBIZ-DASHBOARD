import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const usageRateFile = join(rootDir, '사용률 (2025년 1~9월).xlsx');
const facilityReserveFile = join(rootDir, 'facilityReserve.xlsx');

console.log('🔍 중복 기업명 분석 시작...\n');

// facilityReserve 데이터
const reserveWorkbook = XLSX.readFile(facilityReserveFile);
const reserveSheet = reserveWorkbook.Sheets['Sheet1'];
const reserveData = XLSX.utils.sheet_to_json(reserveSheet);

// 사용률 데이터
const usageWorkbook = XLSX.readFile(usageRateFile);
const usageSheet = usageWorkbook.Sheets['3층 디지털 콘텐츠 제작실'];
const usageRawData = XLSX.utils.sheet_to_json(usageSheet, { header: 1 });
const usageData = usageRawData.slice(4).filter(row => row[2]); // 업체명이 있는 행만

// 기업명 수집
const reserveCompanyNames = [...new Set(reserveData.map(r => r['신청기업명']).filter(Boolean))];
const usageCompanyNames = [...new Set(usageData.map(row => row[2]).filter(Boolean))];

const allCompanyNames = [...new Set([...reserveCompanyNames, ...usageCompanyNames])].sort();

console.log(`📊 총 고유 기업명: ${allCompanyNames.length}개\n`);

// 유사한 기업명 찾기
const similarGroups = new Map();

allCompanyNames.forEach(name1 => {
  const normalized1 = name1.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\(.*?\)/g, '') // 괄호 제거
    .replace(/㈜|주식회사/g, ''); // 회사 형태 제거

  allCompanyNames.forEach(name2 => {
    if (name1 === name2) return;

    const normalized2 = name2.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/㈜|주식회사/g, '');

    // 한쪽이 다른 쪽을 포함하거나, 매우 유사한 경우
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      const key = [name1, name2].sort().join('|');
      if (!similarGroups.has(key)) {
        similarGroups.set(key, [name1, name2]);
      }
    }
  });
});

if (similarGroups.size > 0) {
  console.log('⚠️  유사한 기업명 발견:\n');
  const processedGroups = new Set();

  similarGroups.forEach(([name1, name2]) => {
    const key = [name1, name2].sort().join('|');
    if (!processedGroups.has(key)) {
      console.log(`  - "${name1}" ↔ "${name2}"`);
      processedGroups.add(key);
    }
  });
} else {
  console.log('✅ 유사한 기업명이 없습니다.\n');
}

// 전체 기업명 목록 출력
console.log('\n📋 전체 기업명 목록 (알파벳순):\n');
allCompanyNames.forEach((name, i) => {
  const inReserve = reserveCompanyNames.includes(name) ? '📅' : '  ';
  const inUsage = usageCompanyNames.includes(name) ? '📈' : '  ';
  console.log(`${i + 1}. ${inReserve}${inUsage} ${name}`);
});

console.log('\n\n범례:');
console.log('  📅 = facilityReserve.xlsx에 존재');
console.log('  📈 = 사용률.xlsx에 존재');
