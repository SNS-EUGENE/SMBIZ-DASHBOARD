// SMBIZ 예약 관리 페이지에서 데이터 추출
(function() {
  'use strict';

  // 데이터 추출 함수
  function extractReservationData() {
    const data = {
      // 예약 정보
      reservation: {
        status: '',
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        equipment: [],
      },
      // 기업 정보
      company: {
        representative: '',
        name: '',
        businessNumber: '',
        size: '',
        industry: '',
        contact: '',
      },
      // 작업량 (장비별)
      workload: {
        still: {}, // 2D - 장비별
        video360: {}, // 360 - 장비별
        video: {}, // 영상 - 장비별
      },
      // 메모
      notes: '',
      memo: '',
    };

    try {
      // 예약 상태
      const statusSelect = document.getElementById('reserve_status');
      if (statusSelect) {
        const selectedOption = statusSelect.options[statusSelect.selectedIndex];
        data.reservation.status = selectedOption ? selectedOption.text : '';
      }

      // 예약 날짜
      const sDateInput = document.getElementById('s_date');
      const eDateInput = document.getElementById('e_date');
      if (sDateInput) data.reservation.startDate = sDateInput.value;
      if (eDateInput) data.reservation.endDate = eDateInput.value;

      // 예약 시간
      const sTimeSelect = document.getElementById('s_time');
      const eTimeSelect = document.getElementById('e_time');
      if (sTimeSelect) {
        const opt = sTimeSelect.options[sTimeSelect.selectedIndex];
        data.reservation.startTime = opt ? opt.value : '';
      }
      if (eTimeSelect) {
        const opt = eTimeSelect.options[eTimeSelect.selectedIndex];
        data.reservation.endTime = opt ? opt.value : '';
      }

      // 장비 옵션 (체크된 것들)
      const optionCheckboxes = document.querySelectorAll('input[name="opt_code"]:checked');
      const equipmentMap = {
        'OP_2_0': 'AS360',
        'OP_2_1': 'MICRO',
        'OP_2_2': 'XL',
        'OP_2_3': '알파데스크',
        'OP_2_4': '알파테이블',
        'OP_2_5': 'Compact',
        'OP_2_6': 'XXL',
      };
      optionCheckboxes.forEach(cb => {
        const eqName = equipmentMap[cb.value];
        if (eqName) {
          data.reservation.equipment.push(eqName);
        }
      });

      // 대표자명 - th에서 "대표자명" 찾아서 td 값 가져오기
      const rows = document.querySelectorAll('table.bbs_write tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');
        if (th && td) {
          const label = th.textContent.trim();

          if (label === '대표자명') {
            data.company.representative = td.textContent.trim();
          }
        }
      });

      // 기업명
      const companyInput = document.getElementById('company');
      if (companyInput) data.company.name = companyInput.value;

      // 사업자등록번호
      const bizNumInput = document.getElementById('biz_num');
      if (bizNumInput) data.company.businessNumber = bizNumInput.value;

      // 기업 규모
      const sizeSelect = document.getElementById('size');
      if (sizeSelect) {
        const opt = sizeSelect.options[sizeSelect.selectedIndex];
        data.company.size = opt ? opt.text : '';
      }

      // 업종
      const sectorSelect = document.getElementById('sector');
      if (sectorSelect) {
        const opt = sectorSelect.options[sectorSelect.selectedIndex];
        data.company.industry = opt ? opt.text : '';
      }

      // 연락처
      const telInput = document.getElementById('tel');
      if (telInput) data.company.contact = telInput.value;

      // 작업량 테이블 파싱 (관리자 입력항목)
      const workloadTable = document.querySelectorAll('table.bbs_write')[1]; // 두 번째 테이블
      if (workloadTable) {
        const workRows = workloadTable.querySelectorAll('tr');
        const equipmentHeaders = ['AS360', 'MICRO', 'XL', '알파데스크', '알파테이블', 'Compact', 'XXL'];

        workRows.forEach(row => {
          const th = row.querySelector('th:first-child');
          const inputs = row.querySelectorAll('input[name="opt_val"]');

          if (th && inputs.length > 0) {
            const rowType = th.textContent.trim();

            inputs.forEach((input, idx) => {
              const value = parseInt(input.value) || 0;
              if (value > 0 && idx < equipmentHeaders.length) {
                const equipment = equipmentHeaders[idx];
                if (rowType === 'Still') {
                  data.workload.still[equipment] = value;
                } else if (rowType === '360') {
                  data.workload.video360[equipment] = value;
                } else if (rowType === '영상') {
                  data.workload.video[equipment] = value;
                }
              }
            });
          }
        });
      }

      // 요청사항
      const noteTextarea = document.getElementById('note');
      if (noteTextarea) data.notes = noteTextarea.value;

      // 메모
      const memoTextarea = document.getElementById('memo');
      if (memoTextarea) data.memo = memoTextarea.value;

    } catch (error) {
      console.error('SMBIZ 데이터 추출 오류:', error);
    }

    return data;
  }

  // 시간대 결정 (오전/오후)
  function determineTimeSlot(startTime, endTime) {
    const start = parseInt(startTime);
    const end = parseInt(endTime);

    // 09-13 = 오전, 14-18 = 오후
    if (start >= 9 && end <= 13) return 'morning';
    if (start >= 14 && end <= 18) return 'afternoon';

    // 시작 시간 기준으로 판단
    if (start < 14) return 'morning';
    return 'afternoon';
  }

  // 날짜 포맷 변환 (YYYYMMDD -> YYYY-MM-DD)
  function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }

  // SMBIZ Dashboard용 포맷으로 변환
  function convertToSmbizDashboardFormat(data) {
    // 작업량 합계 계산
    let total2D = 0;
    let total3D = 0;
    let totalVideo = 0;

    Object.values(data.workload.still).forEach(v => total2D += v);
    Object.values(data.workload.video360).forEach(v => total3D += v);
    Object.values(data.workload.video).forEach(v => totalVideo += v);

    const formatted = {
      _type: 'SMBIZ_RESERVATION_DATA',
      _version: '1.0',
      reservation: {
        date: formatDate(data.reservation.startDate),
        timeSlot: determineTimeSlot(data.reservation.startTime, data.reservation.endTime),
        equipment: data.reservation.equipment,
        work2d: total2D,
        work3d: total3D,
        workVideo: totalVideo,
      },
      company: {
        name: data.company.name,
        representative: data.company.representative,
        businessNumber: data.company.businessNumber,
        industry: data.company.industry,
        contact: data.company.contact,
      },
      notes: [data.notes, data.memo].filter(Boolean).join('\n'),
    };

    return formatted;
  }

  // 클립보드에 복사
  async function copyToClipboard(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
      return true;
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      return false;
    }
  }

  // 복사 버튼 추가
  function addCopyButton() {
    // 이미 버튼이 있으면 제거
    const existing = document.getElementById('smbiz-copy-btn');
    if (existing) existing.remove();

    // 버튼 생성
    const btn = document.createElement('button');
    btn.id = 'smbiz-copy-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      <span>SMBIZ Dashboard로 복사</span>
    `;
    btn.className = 'smbiz-copy-button';

    btn.addEventListener('click', async () => {
      const rawData = extractReservationData();
      const formattedData = convertToSmbizDashboardFormat(rawData);

      const success = await copyToClipboard(formattedData);

      if (success) {
        btn.classList.add('success');
        btn.querySelector('span').textContent = '복사 완료!';
        setTimeout(() => {
          btn.classList.remove('success');
          btn.querySelector('span').textContent = 'SMBIZ Dashboard로 복사';
        }, 2000);
      } else {
        btn.classList.add('error');
        btn.querySelector('span').textContent = '복사 실패';
        setTimeout(() => {
          btn.classList.remove('error');
          btn.querySelector('span').textContent = 'SMBIZ Dashboard로 복사';
        }, 2000);
      }
    });

    // 페이지에 추가 (상단에 고정)
    const container = document.createElement('div');
    container.id = 'smbiz-copy-container';
    container.appendChild(btn);
    document.body.appendChild(container);
  }

  // 메시지 리스너 (popup에서 호출 시)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractData') {
      const rawData = extractReservationData();
      const formattedData = convertToSmbizDashboardFormat(rawData);
      sendResponse({ success: true, data: formattedData });
    }
    return true;
  });

  // 페이지 로드 시 버튼 추가
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCopyButton);
  } else {
    addCopyButton();
  }

})();
