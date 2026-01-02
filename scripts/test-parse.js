// 파싱 함수 테스트

const equipmentTypeMapping = {
  'XXL': 'XXL',
  'Table': '알파테이블',
  '알파테이블': '알파테이블',
  'Compact': 'Compact',
  'Micro': 'MICRO',
  'MICRO': 'MICRO',
  'Desk': '알파데스크',
  '알파데스크': '알파데스크',
  'XL': 'XL',
  'AS360': 'AS360',
  '패션스튜디오': 'Compact'
};

function parseEquipmentOptions(optionsStr) {
  if (!optionsStr) return []

  const result = optionsStr
    .split(/\s*\/\s*|\r?\n+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => equipmentTypeMapping[t] || t)
    .filter(t => ['XXL', 'XL', 'MICRO', 'AS360', 'Compact', '알파데스크', '알파테이블'].includes(t));

  return result;
}

// 테스트 - 실제 엑셀에서 나오는 포맷
const test1 = "MICRO\r\n\r\n";
const test2 = "알파테이블\r\n\r\nXL\r\n\r\n";
const test3 = "MICRO /  / AS360";
const test4 = "XXL /  / 알파테이블";

console.log('Test 1:', JSON.stringify(test1));
console.log('Result 1:', parseEquipmentOptions(test1));
console.log('');
console.log('Test 2:', JSON.stringify(test2));
console.log('Result 2:', parseEquipmentOptions(test2));
console.log('');
console.log('Test 3:', JSON.stringify(test3));
console.log('Result 3:', parseEquipmentOptions(test3));
console.log('');
console.log('Test 4:', JSON.stringify(test4));
console.log('Result 4:', parseEquipmentOptions(test4));
