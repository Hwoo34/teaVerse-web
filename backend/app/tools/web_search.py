"""웹 검색 도구. DB에 없는 정보를 검색하고 출처(URL)를 함께 반환한다.

로컬/클라우드 공통으로 DuckDuckGo의 HTML 엔드포인트를 사용(키 불필요).
배포 시 AgentCore Browser 또는 검색 API로 교체 가능.
"""
from __future__ import annotations

import html
import re
from urllib.parse import unquote

import httpx

from .. import config

_DDG_HTML = "https://html.duckduckgo.com/html/"
_DDG_LITE = "https://lite.duckduckgo.com/lite/"
# 일반 브라우저 UA. 봇 티가 나는 UA는 DDG가 202(빈 페이지)로 차단한다.
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# 결과 링크와 스니펫 추출용 정규식 (DDG HTML 구조 기반)
# class="result__a" 앵커 태그를 찾고, 그 안에서 href/텍스트를 개별 추출한다
# (속성 순서에 무관하게 동작).
_RESULT_RE = re.compile(
    r'<a[^>]*\bclass="result__a"[^>]*>(?P<inner>.*?)</a>', re.S
)
_HREF_RE = re.compile(r'href="(?P<url>[^"]+)"')
_SNIPPET_RE = re.compile(
    r'<a[^>]*\bclass="result__snippet"[^>]*>(?P<snippet>.*?)</a>', re.S
)


def _strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def _clean_url(u: str) -> str:
    # DDG 리다이렉트 형태 //duckduckgo.com/l/?uddg=... 처리
    m = re.search(r"uddg=([^&]+)", u)
    if m:
        return unquote(m.group(1))
    if u.startswith("//"):
        return "https:" + u
    return u


def _fetch(url: str, query: str) -> str | None:
    """DDG 엔드포인트 POST. 202(봇 차단) 등 비정상 응답은 None."""
    try:
        with httpx.Client(
            timeout=10.0,
            headers={"User-Agent": _UA, "Referer": "https://duckduckgo.com/"},
            follow_redirects=True,
        ) as client:
            resp = client.post(url, data={"q": query})
            if resp.status_code != 200:
                return None
            return resp.text
    except Exception:
        return None


def _parse_html(body: str, max_results: int) -> list[dict]:
    """html.duckduckgo.com 결과 파싱 (result__a 앵커)."""
    anchors = re.findall(r'<a[^>]*\bclass="result__a"[^>]*>.*?</a>', body, re.S)
    snippets = list(_SNIPPET_RE.finditer(body))
    results: list[dict] = []
    for i, anchor in enumerate(anchors[:max_results]):
        href_m = _HREF_RE.search(anchor)
        inner_m = _RESULT_RE.search(anchor)
        if not href_m or not inner_m:
            continue
        url = _clean_url(href_m.group("url"))
        title = _strip_tags(inner_m.group("inner"))
        snippet = _strip_tags(snippets[i].group("snippet")) if i < len(snippets) else ""
        if url and title:
            results.append({"title": title, "url": url, "snippet": snippet})
    return results


def _parse_lite(body: str, max_results: int) -> list[dict]:
    """lite.duckduckgo.com 결과 파싱 (result-link 클래스 앵커)."""
    anchors = re.findall(
        r'<a[^>]*\bclass="result-link"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', body, re.S
    )
    results: list[dict] = []
    for url_raw, title_raw in anchors[:max_results]:
        url = _clean_url(url_raw)
        title = _strip_tags(title_raw)
        if url and title:
            results.append({"title": title, "url": url, "snippet": ""})
    return results


def search(query: str, max_results: int = 4) -> list[dict]:
    """검색 결과 리스트. 각 항목: {title, url, snippet}.

    html 엔드포인트를 먼저 시도하고, 실패(봇 차단 등) 시 lite로 폴백한다.
    """
    if not config.WEB_SEARCH_ENABLED:
        return []

    body = _fetch(_DDG_HTML, query)
    if body:
        results = _parse_html(body, max_results)
        if results:
            return results

    # 폴백: lite 엔드포인트
    body = _fetch(_DDG_LITE, query)
    if body:
        return _parse_lite(body, max_results)

    return []
