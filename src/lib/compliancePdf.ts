import { PDFDocument, rgb } from 'pdf-lib'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as _fontkit from '@pdf-lib/fontkit'
const fontkit = (_fontkit as any).default || _fontkit

interface CompliancePdfData {
  agreed: boolean
  year: string
  month: string
  day: string
  companyName: string
  applicantName: string
  signatureData: string | null
}

/** Noto Sans KR 폰트 (로컬) — Pretendard OTF는 fontkit CFF 파싱 호환 문제 있음 */
const FONT_PATH = '/fonts/NotoSansKR-Regular.otf'

/**
 * 원본 이용자 준수사항 PDF 템플릿에 동의 데이터를 채워서 다운로드
 *
 * 좌표 기준: PDF 좌하단 원점 (y가 위로 증가)
 * A4: 595 x 842pt
 */
export async function generateCompliancePdf(data: CompliancePdfData): Promise<void> {
  // 1. 원본 PDF + 한국어 폰트 동시 로드
  const [templateBytes, fontBytes] = await Promise.all([
    fetch(`${window.location.origin}/compliance-template.pdf`).then((r) => r.arrayBuffer()),
    fetch(`${window.location.origin}${FONT_PATH}`).then((r) => r.arrayBuffer()),
  ])

  const pdfDoc = await PDFDocument.load(templateBytes)
  pdfDoc.registerFontkit(fontkit)
  const korFont = await pdfDoc.embedFont(fontBytes)

  const page = pdfDoc.getPages()[0]

  // 2. 동의 체크마크
  if (data.agreed) {
    page.drawText('V', {
      x: 270,
      y: 235,
      size: 16,
      color: rgb(0, 0, 0),
    })
  } else {
    page.drawText('V', {
      x: 360,
      y: 235,
      size: 16,
      color: rgb(0, 0, 0),
    })
  }

  // 3. 날짜 (년/월/일)
  page.drawText(data.year, {
    x: 210,
    y: 185,
    size: 12,
    font: korFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(data.month, {
    x: 290,
    y: 185,
    size: 12,
    font: korFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(data.day, {
    x: 350,
    y: 185,
    size: 12,
    font: korFont,
    color: rgb(0, 0, 0),
  })

  // 4. 신청 기업명
  page.drawText(data.companyName, {
    x: 475,
    y: 150,
    size: 11,
    font: korFont,
    color: rgb(0, 0, 0),
  })

  // 5. 신청자명
  page.drawText(data.applicantName, {
    x: 465,
    y: 110,
    size: 11,
    font: korFont,
    color: rgb(0, 0, 0),
  })

  // 6. 서명 이미지 삽입
  if (data.signatureData) {
    try {
      const sigBytes = await fetch(data.signatureData).then((r) => r.arrayBuffer())
      const sigImage = await pdfDoc.embedPng(new Uint8Array(sigBytes))
      const sigDims = sigImage.scale(0.25)
      page.drawImage(sigImage, {
        x: 480,
        y: 100,
        width: sigDims.width,
        height: sigDims.height,
      })
    } catch {
      // 서명 이미지 삽입 실패 시 무시
    }
  }

  // 7. PDF 다운로드
  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `이용자준수사항_${data.companyName}_${data.year}${data.month}${data.day}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
