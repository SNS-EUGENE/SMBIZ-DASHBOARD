// smbiz.sba.kr fetch 기반 HTTP 클라이언트
// Deno 환경 — Puppeteer 없이 서버사이드 렌더링된 HTML을 직접 fetch

const BASE_URL = 'https://smbiz.sba.kr'
const LOGIN_PAGE_URL = `${BASE_URL}/biz_manage/index.do`
const LOGIN_PROC_URL = `${BASE_URL}/biz_manage/login_proc.do`
const LIST_URL = `${BASE_URL}/biz_manage/facilityReserve/list.do`
const DETAIL_URL = `${BASE_URL}/biz_manage/facilityReserve/updateForm.do`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Referer': `${BASE_URL}/biz_manage/`,
}

/** Set-Cookie 헤더에서 JSESSIONID 추출 */
function extractSessionCookie(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() ?? []
  for (const cookie of setCookies) {
    const match = cookie.match(/JSESSIONID=([^;]+)/)
    if (match) return `JSESSIONID=${match[1]}`
  }
  // getSetCookie 없는 환경 fallback
  const raw = res.headers.get('set-cookie') || ''
  const match = raw.match(/JSESSIONID=([^;]+)/)
  if (match) return `JSESSIONID=${match[1]}`
  return ''
}

/** 로그인 → JSESSIONID 쿠키 반환 */
export async function login(adminId: string, adminPw: string): Promise<string> {
  // 1) GET 로그인 페이지 → 초기 JSESSIONID 획득
  const getRes = await fetch(LOGIN_PAGE_URL, {
    method: 'GET',
    headers: COMMON_HEADERS,
    redirect: 'manual',
  })

  let sessionCookie = extractSessionCookie(getRes)

  // GET이 리다이렉트하면 따라가면서 쿠키 수집
  if (getRes.status >= 300 && getRes.status < 400) {
    const location = getRes.headers.get('location')
    if (location) {
      const redirectUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`
      const redirectRes = await fetch(redirectUrl, {
        headers: { ...COMMON_HEADERS, Cookie: sessionCookie },
        redirect: 'manual',
      })
      const newCookie = extractSessionCookie(redirectRes)
      if (newCookie) sessionCookie = newCookie
    }
  }

  if (!sessionCookie) {
    throw new Error('로그인 실패: 초기 JSESSIONID를 받지 못했습니다.')
  }

  // 2) POST 로그인 — action="/biz_manage/login_proc.do"
  const body = new URLSearchParams({ id: adminId, pw: adminPw })

  const postRes = await fetch(LOGIN_PROC_URL, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: body.toString(),
    redirect: 'manual',
  })

  // 로그인 후 새 JSESSIONID가 발급될 수 있음
  const newCookie = extractSessionCookie(postRes)
  if (newCookie) sessionCookie = newCookie

  // 리다이렉트 따라가기
  if (postRes.status >= 300 && postRes.status < 400) {
    const location = postRes.headers.get('location')
    if (location) {
      const redirectUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`
      const redirectRes = await fetch(redirectUrl, {
        headers: { ...COMMON_HEADERS, Cookie: sessionCookie },
        redirect: 'manual',
      })
      const redirectCookie = extractSessionCookie(redirectRes)
      if (redirectCookie) sessionCookie = redirectCookie
    }
  }

  return sessionCookie
}

/** HTML에서 hidden input 필드 추출 → URLSearchParams용 Record */
function extractHiddenFields(html: string, formName?: string): Record<string, string> {
  const fields: Record<string, string> = {}

  // formName이 지정되면 해당 폼 블록만 추출
  let formHtml = html
  if (formName) {
    const formRe = new RegExp(
      `<form[^>]*name=["']${formName}["'][^>]*>([\\s\\S]*?)</form>`,
      'i'
    )
    const match = html.match(formRe)
    if (match) formHtml = match[1]
  }

  // <input type="hidden" name="xxx" value="yyy">
  const re = /<input[^>]*type=["']hidden["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(formHtml)) !== null) {
    const tag = m[0]
    const nameMatch = tag.match(/name=["']([^"']+)["']/)
    const valueMatch = tag.match(/value=["']([^"']*)["']/)
    if (nameMatch) {
      fields[nameMatch[1]] = valueMatch ? valueMatch[1] : ''
    }
  }

  return fields
}

/**
 * 목록 페이지 초기 로드 (GET)
 * → 첫 페이지 HTML + 숨겨진 폼 필드 반환
 */
export async function initListPage(
  sessionCookie: string
): Promise<{ html: string; hiddenFields: Record<string, string> }> {
  const res = await fetch(LIST_URL, {
    method: 'GET',
    headers: {
      ...COMMON_HEADERS,
      Cookie: sessionCookie,
    },
  })

  if (!res.ok) {
    throw new Error(`목록 페이지 초기 로드 실패: HTTP ${res.status}`)
  }

  const html = await res.text()
  const hiddenFields = extractHiddenFields(html, 'listForm')

  return { html, hiddenFields }
}

/** 목록 페이지 HTML 조회 (POST with hidden fields) */
export async function getListPageHtml(
  sessionCookie: string,
  pageIndex: number,
  hiddenFields: Record<string, string>
): Promise<string> {
  const body = new URLSearchParams({
    ...hiddenFields,
    pageIndex: String(pageIndex),
  })

  const res = await fetch(LIST_URL, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`목록 페이지 조회 실패: HTTP ${res.status}`)
  }

  return await res.text()
}

/** 상세 페이지 HTML 조회 */
export async function getDetailPageHtml(
  sessionCookie: string,
  reserveIdx: string
): Promise<string> {
  const body = new URLSearchParams({ f_res_idx: reserveIdx })

  const res = await fetch(DETAIL_URL, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sessionCookie,
    },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`상세 페이지 조회 실패 (${reserveIdx}): HTTP ${res.status}`)
  }

  return await res.text()
}
