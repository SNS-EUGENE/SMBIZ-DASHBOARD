// Popup 스크립트
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const copyBtn = document.getElementById('copyBtn');
  const dataPreview = document.getElementById('dataPreview');
  const previewContent = document.getElementById('previewContent');

  let extractedData = null;

  // 현재 탭 확인
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || !tab.url.includes('smbiz.sba.kr/biz_manage/facilityReserve')) {
    statusEl.className = 'status error';
    statusEl.textContent = 'SMBIZ 예약 관리 페이지가 아닙니다.';
    return;
  }

  // 데이터 추출 시도
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });

    if (response && response.success && response.data) {
      extractedData = response.data;

      statusEl.className = 'status success';
      statusEl.textContent = '데이터 추출 완료! 복사 버튼을 클릭하세요.';
      copyBtn.disabled = false;

      // 미리보기 표시
      showPreview(extractedData);
    } else {
      throw new Error('데이터 추출 실패');
    }
  } catch (error) {
    statusEl.className = 'status warning';
    statusEl.textContent = '페이지에서 데이터를 불러오는 중입니다. 페이지를 새로고침 후 다시 시도하세요.';
    console.error('Error:', error);
  }

  // 복사 버튼 클릭
  copyBtn.addEventListener('click', async () => {
    if (!extractedData) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(extractedData));

      copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>복사 완료!</span>
      `;

      statusEl.className = 'status success';
      statusEl.textContent = 'SMBIZ Dashboard에 붙여넣기하세요!';

      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>데이터 복사하기</span>
        `;
      }, 2000);
    } catch (err) {
      statusEl.className = 'status error';
      statusEl.textContent = '클립보드 복사 실패: ' + err.message;
    }
  });

  // 미리보기 표시
  function showPreview(data) {
    dataPreview.style.display = 'block';

    const rows = [
      { label: '기업명', value: data.company.name },
      { label: '대표자', value: data.company.representative },
      { label: '예약일', value: data.reservation.date },
      { label: '시간대', value: data.reservation.timeSlot === 'morning' ? '오전' : '오후' },
      { label: '장비', value: data.reservation.equipment.join(', ') },
      { label: '2D 작업량', value: data.reservation.work2d + '장' },
      { label: '3D 작업량', value: data.reservation.work3d + '장' },
      { label: '영상 작업량', value: data.reservation.workVideo + '건' },
    ];

    previewContent.innerHTML = rows
      .map(row => `
        <div class="data-row">
          <span class="data-label">${row.label}</span>
          <span class="data-value">${row.value || '-'}</span>
        </div>
      `)
      .join('');
  }
});
