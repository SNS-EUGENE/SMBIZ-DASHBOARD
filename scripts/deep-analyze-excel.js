import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const usageRateFile = join(rootDir, '사용률 (2025년 1~9월).xlsx');
const facilityReserveFile = join(rootDir, 'facilityReserve.xlsx');

console.log('📊 상세 분석 시작...\n');

// 1. facilityReserve.xlsx 깊게 파보기
console.log('='.repeat(80));
console.log('📅 facilityReserve.xlsx - 예약 데이터 상세 분석');
console.log('='.repeat(80));

const reserveWorkbook = XLSX.readFile(facilityReserveFile);
const reserveSheet = reserveWorkbook.Sheets['Sheet1'];
const reserveData = XLSX.utils.sheet_to_json(reserveSheet);

console.log('\n📊 총 예약 건수:', reserveData.length);
console.log('\n📋 첫 5개 예약 데이터:\n');
reserveData.slice(0, 5).forEach((row, i) => {
  console.log(`[예약 ${i + 1}]`);
  console.log('  신청기업명:', row['신청기업명']);
  console.log('  예약시작일:', row['예약시작일']);
  console.log('  예약시작시간:', row['예약시작시간']);
  console.log('  예약종료시간:', row['예약종료시간']);
  console.log('  옵션:', row['옵션']);
  console.log('  기업규모:', row['기업규모']);
  console.log('  업종:', row['업종']);
  console.log('  담당자명:', row['담당자명']);
  console.log('  예약상태:', row['예약상태']);
  console.log('');
});

// 날짜 범위 확인
const dates = reserveData.map(r => r['예약시작일']).filter(Boolean).sort();
console.log('📅 예약 날짜 범위:');
console.log('  최초:', dates[0]);
console.log('  최근:', dates[dates.length - 1]);

// 기업명 중복 제거
const uniqueCompanies = [...new Set(reserveData.map(r => r['신청기업명']))].filter(Boolean);
console.log('\n🏢 고유 기업 수:', uniqueCompanies.length);
console.log('  기업 목록 (처음 10개):', uniqueCompanies.slice(0, 10).join(', '));

// 장비 타입 추출
const equipmentTypes = new Set();
reserveData.forEach(row => {
  const options = row['옵션'];
  if (options) {
    const types = options.split('\n').map(t => t.trim()).filter(Boolean);
    types.forEach(t => equipmentTypes.add(t));
  }
});
console.log('\n🔧 장비 타입:', [...equipmentTypes].join(', '));

// 예약 상태 통계
const statusCount = {};
reserveData.forEach(row => {
  const status = row['예약상태'] || '없음';
  statusCount[status] = (statusCount[status] || 0) + 1;
});
console.log('\n📊 예약 상태별 통계:');
Object.entries(statusCount).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}건`);
});

// 2. 사용률 파일 깊게 파보기
console.log('\n\n' + '='.repeat(80));
console.log('📈 사용률 (2025년 1~9월).xlsx - 사용률 데이터 상세 분석');
console.log('='.repeat(80));

const usageWorkbook = XLSX.readFile(usageRateFile);

// 첫 번째 시트 상세 분석
console.log('\n[시트 1: 3층 디지털 콘텐츠 제작실]');
const mainSheet = usageWorkbook.Sheets['3층 디지털 콘텐츠 제작실'];
const mainData = XLSX.utils.sheet_to_json(mainSheet, { header: 1, defval: '' });

console.log('총 행 수:', mainData.length);
console.log('\n처음 20행 출력:\n');
mainData.slice(0, 20).forEach((row, i) => {
  console.log(`행 ${i + 1}:`, row);
});

// 신규기업 시트
console.log('\n\n[시트 4: 신규기업]');
const newCompaniesSheet = usageWorkbook.Sheets['신규기업'];
const newCompaniesData = XLSX.utils.sheet_to_json(newCompaniesSheet);

console.log('신규 기업 수:', newCompaniesData.length);
console.log('\n신규 기업 목록 (처음 10개):\n');
newCompaniesData.slice(0, 10).forEach((company, i) => {
  console.log(`[${i + 1}] ${company['기업명']} - ${company['업종']}`);
});

console.log('\n\n' + '='.repeat(80));
console.log('✅ 상세 분석 완료!');
console.log('='.repeat(80));

console.log('\n\n💡 분석 결과 요약:');
console.log('─'.repeat(80));
console.log('1. facilityReserve.xlsx:');
console.log('   - 2024년 9월부터 현재까지 전체 예약 내역 (649건)');
console.log('   - 기업명, 날짜, 시간, 장비, 업종, 예약상태 포함');
console.log('   - 베이스 데이터로 활용 가능');
console.log('');
console.log('2. 사용률 (2025년 1~9월).xlsx:');
console.log('   - 2025년 1-9월 월별 통계 데이터');
console.log('   - 장비별 가동률, 업종별 통계 등 고도화된 메트릭');
console.log('   - 신규 기업 정보 포함');
console.log('');
console.log('💡 매칭 전략:');
console.log('   1) facilityReserve를 베이스로 전체 예약 데이터 구축');
console.log('   2) 사용률 파일에서 추가 메트릭/통계 정보 보강');
console.log('   3) 기업명을 키로 매칭하여 통합');
console.log('─'.repeat(80));
