import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import SignatureCanvas from 'react-signature-canvas'

export interface SignaturePadHandle {
  toDataURL: () => string
  isEmpty: () => boolean
  clear: () => void
}

interface SignaturePadProps {
  onEnd?: () => void
  width?: number
  height?: number
}

/** 투명 배경 + 흰 펜 서명 → 투명 배경 + 검은 펜으로 변환 */
function invertToBlack(canvas: HTMLCanvasElement): string {
  const w = canvas.width
  const h = canvas.height
  const srcCtx = canvas.getContext('2d')!
  const srcData = srcCtx.getImageData(0, 0, w, h)
  const d = srcData.data

  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const ctx = tmp.getContext('2d')!
  const dstData = ctx.createImageData(w, h)
  const dst = dstData.data

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (a > 10) {
      // 잉크 → 검은색, 알파 유지
      dst[i] = 0
      dst[i + 1] = 0
      dst[i + 2] = 0
      dst[i + 3] = a
    }
    // 투명 픽셀은 그대로 (0,0,0,0)
  }
  ctx.putImageData(dstData, 0, 0)
  return tmp.toDataURL('image/png')
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ onEnd, height = 150 }, ref) => {
    const canvasRef = useRef<SignatureCanvas | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const resizeCanvas = useCallback(() => {
      if (!canvasRef.current || !containerRef.current) return
      const canvas = canvasRef.current.getCanvas()
      const container = containerRef.current
      const data = canvasRef.current.toData()
      canvas.width = container.offsetWidth
      canvas.height = height
      if (data.length > 0) {
        canvasRef.current.fromData(data)
      }
    }, [height])

    useEffect(() => {
      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
      return () => window.removeEventListener('resize', resizeCanvas)
    }, [resizeCanvas])

    useImperativeHandle(ref, () => ({
      toDataURL: () => {
        if (!canvasRef.current) return ''
        const canvas = canvasRef.current.getCanvas()
        return invertToBlack(canvas)
      },
      isEmpty: () => canvasRef.current?.isEmpty() ?? true,
      clear: () => canvasRef.current?.clear(),
    }))

    return (
      <div ref={containerRef} className="relative">
        <SignatureCanvas
          ref={canvasRef}
          penColor="#e2e8f0"
          minWidth={1.5}
          maxWidth={3}
          backgroundColor="transparent"
          canvasProps={{
            height,
            className: 'w-full rounded-lg border border-border bg-bg-tertiary/30 cursor-crosshair',
          }}
          onEnd={onEnd}
        />
        <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
          <div className="w-2/3 border-b border-text-tertiary/30" />
        </div>
      </div>
    )
  }
)

SignaturePad.displayName = 'SignaturePad'

export default SignaturePad
