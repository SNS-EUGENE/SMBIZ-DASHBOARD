import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind 클래스 조건부 병합 유틸리티 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 숫자 포맷: 3자리 쉼표 + 스마트 소수점 (불필요한 .0 / .00 제거)
 * fmtNum(375.00) → "375"
 * fmtNum(374.5)  → "374.5"
 * fmtNum(374.58) → "374.58"
 * fmtNum(12345)  → "12,345"
 */
export function fmtNum(value: number, maxDecimals = 2): string {
  const rounded = Number(value.toFixed(maxDecimals))
  return rounded.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })
}

/** 퍼센트 포맷: 스마트 소수점 + % 접미사 */
export function fmtPct(value: number): string {
  return `${fmtNum(value, 1)}%`
}

/** 부호 포함 퍼센트포인트: +3.5%p / -1.2%p */
export function fmtPctDiff(value: number): string {
  return `${value >= 0 ? '+' : ''}${fmtNum(value, 1)}%p`
}
