// CSV/Excel Export Utilities

/**
 * Convert data array to CSV string
 */
const arrayToCSV = (data, headers) => {
  const headerRow = headers.map(h => `"${h.label}"`).join(',')

  const dataRows = data.map(item => {
    return headers.map(h => {
      let value = item[h.key]

      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join(', ')
      }

      // Handle null/undefined
      if (value === null || value === undefined) {
        value = ''
      }

      // Convert to string and escape quotes
      const stringValue = String(value).replace(/"/g, '""')
      return `"${stringValue}"`
    }).join(',')
  })

  // Add BOM for Excel Korean support
  return '\uFEFF' + [headerRow, ...dataRows].join('\n')
}

/**
 * Download CSV file
 */
const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

/**
 * Export companies to CSV
 */
export const exportCompanies = (companies) => {
  const headers = [
    { key: 'name', label: '기업명' },
    { key: 'representative', label: '대표자' },
    { key: 'business_number', label: '사업자번호' },
    { key: 'industry', label: '업종' },
    { key: 'contact', label: '연락처' },
    { key: 'email', label: '이메일' },
    { key: 'district', label: '자치구' },
    { key: 'address', label: '주소' },
    { key: 'notes', label: '비고' },
  ]

  const csv = arrayToCSV(companies, headers)
  const date = new Date().toISOString().split('T')[0]
  downloadCSV(csv, `기업목록_${date}.csv`)
}

/**
 * Export reservations to CSV
 */
export const exportReservations = (reservations) => {
  const headers = [
    { key: 'reservation_date', label: '예약일자' },
    { key: 'time_slot', label: '시간대' },
    { key: 'company_name', label: '기업명' },
    { key: 'industry', label: '업종' },
    { key: 'equipment_types', label: '장비' },
    { key: 'attendees', label: '인원' },
    { key: 'status', label: '상태' },
    { key: 'work_2d', label: '2D 작업량' },
    { key: 'work_3d', label: '3D 작업량' },
    { key: 'work_video', label: '영상 작업량' },
    { key: 'notes', label: '비고' },
  ]

  // Transform data for export
  const transformedData = reservations.map(r => ({
    ...r,
    time_slot: r.time_slot === 'morning' ? '오전' : '오후',
    status: getStatusLabel(r.status),
  }))

  const csv = arrayToCSV(transformedData, headers)
  const date = new Date().toISOString().split('T')[0]
  downloadCSV(csv, `예약목록_${date}.csv`)
}

/**
 * Export equipment to CSV
 */
export const exportEquipment = (equipment) => {
  const headers = [
    { key: 'name', label: '장비명' },
    { key: 'type', label: '타입' },
    { key: 'description', label: '설명' },
    { key: 'status', label: '상태' },
  ]

  const transformedData = equipment.map(e => ({
    ...e,
    status: getEquipmentStatusLabel(e.status),
  }))

  const csv = arrayToCSV(transformedData, headers)
  const date = new Date().toISOString().split('T')[0]
  downloadCSV(csv, `장비목록_${date}.csv`)
}

// Helper functions
const getStatusLabel = (status) => {
  const labels = {
    confirmed: '확정',
    pending: '대기',
    completed: '완료',
    cancelled: '취소',
    no_show: '노쇼',
  }
  return labels[status] || status
}

const getEquipmentStatusLabel = (status) => {
  const labels = {
    active: '활성',
    maintenance: '정비중',
    inactive: '비활성',
  }
  return labels[status] || status
}
