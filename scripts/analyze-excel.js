import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 엑셀 파일 경로
const usageRateFile = join(rootDir, '사용률 (2025년 1~9월).xlsx');
const facilityReserveFile = join(rootDir, 'facilityReserve.xlsx');

console.log('📊 엑셀 파일 분석 시작...\n');

// 1. 사용률 파일 분석
console.log('=' .repeat(60));
console.log('📈 사용률 (2025년 1~9월).xlsx 분석');
console.log('=' .repeat(60));

try {
  const usageWorkbook = XLSX.readFile(usageRateFile);
  console.log('\n📋 시트 목록:', usageWorkbook.SheetNames);

  usageWorkbook.SheetNames.forEach((sheetName, index) => {
    console.log(`\n[${index + 1}] 시트: "${sheetName}"`);
    const sheet = usageWorkbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // 헤더 출력
    if (data.length > 0) {
      console.log('   헤더:', data[0]);
      console.log('   총 행 수:', data.length - 1, '개');

      // 샘플 데이터 2개 출력
      if (data.length > 1) {
        console.log('\n   샘플 데이터 (1):');
        data[0].forEach((header, i) => {
          console.log(`     - ${header}: ${data[1][i]}`);
        });
      }

      if (data.length > 2) {
        console.log('\n   샘플 데이터 (2):');
        data[0].forEach((header, i) => {
          console.log(`     - ${header}: ${data[2][i]}`);
        });
      }
    }
  });
} catch (error) {
  console.error('❌ 사용률 파일 읽기 실패:', error.message);
}

// 2. facilityReserve 파일 분석
console.log('\n\n' + '='.repeat(60));
console.log('📅 facilityReserve.xlsx 분석');
console.log('=' .repeat(60));

try {
  const reserveWorkbook = XLSX.readFile(facilityReserveFile);
  console.log('\n📋 시트 목록:', reserveWorkbook.SheetNames);

  reserveWorkbook.SheetNames.forEach((sheetName, index) => {
    console.log(`\n[${index + 1}] 시트: "${sheetName}"`);
    const sheet = reserveWorkbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // 헤더 출력
    if (data.length > 0) {
      console.log('   헤더:', data[0]);
      console.log('   총 행 수:', data.length - 1, '개');

      // 샘플 데이터 2개 출력
      if (data.length > 1) {
        console.log('\n   샘플 데이터 (1):');
        data[0].forEach((header, i) => {
          console.log(`     - ${header}: ${data[1][i]}`);
        });
      }

      if (data.length > 2) {
        console.log('\n   샘플 데이터 (2):');
        data[0].forEach((header, i) => {
          console.log(`     - ${header}: ${data[2][i]}`);
        });
      }
    }
  });
} catch (error) {
  console.error('❌ facilityReserve 파일 읽기 실패:', error.message);
}

console.log('\n\n' + '='.repeat(60));
console.log('✅ 분석 완료!');
console.log('=' .repeat(60));
