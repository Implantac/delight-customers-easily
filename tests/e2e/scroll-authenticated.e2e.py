"""
Testa que Dashboard e Customer 360 rolam sem travar em três larguras
(320, 375, 768) tanto via wheel do mouse quanto via touch/swipe.

Requer sessão Supabase injetada no ambiente:
  LOVABLE_BROWSER_AUTH_STATUS=injected
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON
  LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
  LOVABLE_BROWSER_SUPABASE_COOKIES_JSON (opcional, para SSR)

Sem sessão o teste faz skip explícito (exit 0) — para permitir CI que
rode só quando a sessão está disponível.

Como rodar:
  python3 tests/e2e/scroll-authenticated.e2e.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/scroll_authenticated/shots")
OUT.mkdir(parents=True, exist_ok=True)

BASE = "http://localhost:8080"
ROUTES = [
    ("dashboard", "/dashboard"),
    ("customer360", "/customer-360"),
]
VIEWPORTS = [
    ("320", 320, 720),
    ("375", 375, 780),
    ("768", 768, 1024),
]

# Distância mínima esperada de rolagem para considerar "não travou".
MIN_WHEEL_SCROLL_PX = 400
MIN_TOUCH_SCROLL_PX = 400


def require_session_or_skip():
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "")
    if status != "injected":
        print(f"SKIP: LOVABLE_BROWSER_AUTH_STATUS={status!r} (esperado 'injected'). "
              "Faça login no preview do Lovable e rode novamente.")
        sys.exit(0)


async def restore_session(context, page):
    """Injeta sessão Supabase antes de navegar em rotas autenticadas."""
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        await context.add_cookies(cookies)

    await page.goto(BASE, wait_until="domcontentloaded")

    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )


async def find_scroll_container(page):
    """
    Descobre em runtime qual elemento é o container de scroll:
    - se document.scrollingElement rola, é ele
    - senão procura o primeiro <main>/<div> com overflow-y auto|scroll
    Retorna um selector CSS estável para uso em screenshots/assert.
    """
    return await page.evaluate("""
      () => {
        const de = document.scrollingElement;
        if (de && de.scrollHeight > de.clientHeight + 20) return {kind:'document'};
        const all = document.querySelectorAll('main, div');
        for (const el of all) {
          const s = getComputedStyle(el);
          if ((s.overflowY === 'auto' || s.overflowY === 'scroll') &&
              el.scrollHeight > el.clientHeight + 20) {
            const path = [];
            let n = el;
            while (n && n.nodeType === 1 && path.length < 6) {
              let seg = n.tagName.toLowerCase();
              if (n.id) { seg += '#' + n.id; path.unshift(seg); break; }
              const cls = (n.className || '').toString().trim().split(/\\s+/).slice(0,2).join('.');
              if (cls) seg += '.' + cls;
              path.unshift(seg);
              n = n.parentElement;
            }
            return {kind:'element', selector: path.join(' > ')};
          }
        }
        return {kind:'none'};
      }
    """)


async def read_scroll_top(page, container):
    if container["kind"] == "document":
        return await page.evaluate("() => document.scrollingElement.scrollTop")
    return await page.evaluate(
        "(sel) => { const e = document.querySelector(sel); return e ? e.scrollTop : -1; }",
        container["selector"],
    )


async def reset_scroll(page, container):
    if container["kind"] == "document":
        await page.evaluate("() => window.scrollTo(0, 0)")
    else:
        await page.evaluate(
            "(sel) => { const e = document.querySelector(sel); if (e) e.scrollTop = 0; }",
            container["selector"],
        )


async def wheel_scroll(page, x, y, delta):
    await page.mouse.move(x, y)
    await page.mouse.wheel(0, delta)
    await asyncio.sleep(0.4)


async def touch_swipe(client, x, y_from, y_to, steps=12):
    await client.send("Input.dispatchTouchEvent", {
        "type": "touchStart",
        "touchPoints": [{"x": x, "y": y_from}],
    })
    dy = (y_to - y_from) / steps
    for i in range(1, steps + 1):
        await client.send("Input.dispatchTouchEvent", {
            "type": "touchMove",
            "touchPoints": [{"x": x, "y": y_from + dy * i}],
        })
        await asyncio.sleep(0.015)
    await client.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    await asyncio.sleep(0.5)


async def test_route(pw, route_name, route_path, vp_name, w, h):
    is_mobile = w < 600
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context(
        viewport={"width": w, "height": h},
        has_touch=True,
        is_mobile=is_mobile,
    )
    page = await context.new_page()

    console_errors = []
    page.on("pageerror", lambda e: console_errors.append(str(e)))

    await restore_session(context, page)
    await page.goto(f"{BASE}{route_path}", wait_until="networkidle")

    # Se caiu em /login/auth, sessão não vale — falhar explicito
    if "/login" in page.url or "/auth" in page.url:
        await browser.close()
        raise AssertionError(
            f"[{route_name}@{vp_name}] redirecionado para {page.url} — sessão inválida"
        )

    # Aguarda um pouco de conteúdo pintar
    await asyncio.sleep(1.2)
    container = await find_scroll_container(page)
    assert container["kind"] != "none", (
        f"[{route_name}@{vp_name}] nenhum container de scroll com conteúdo overflow"
    )

    # === Wheel ===
    await reset_scroll(page, container)
    y0 = await read_scroll_top(page, container)
    await wheel_scroll(page, w // 2, h // 2, 1500)
    y_wheel = await read_scroll_top(page, container)
    wheel_delta = y_wheel - y0

    await page.screenshot(path=str(OUT / f"{route_name}_{vp_name}_wheel.png"))

    # === Touch swipe ===
    await reset_scroll(page, container)
    client = await context.new_cdp_session(page)
    await touch_swipe(client, w // 2, int(h * 0.85), int(h * 0.15))
    y_touch = await read_scroll_top(page, container)
    touch_delta = y_touch

    await page.screenshot(path=str(OUT / f"{route_name}_{vp_name}_touch.png"))

    await browser.close()

    ok = wheel_delta >= MIN_WHEEL_SCROLL_PX and touch_delta >= MIN_TOUCH_SCROLL_PX
    return {
        "route": route_name,
        "viewport": vp_name,
        "container": container,
        "wheel_delta": wheel_delta,
        "touch_delta": touch_delta,
        "console_errors": console_errors,
        "ok": ok,
    }


async def main():
    require_session_or_skip()
    results = []
    async with async_playwright() as pw:
        for route_name, route_path in ROUTES:
            for vp_name, w, h in VIEWPORTS:
                try:
                    r = await test_route(pw, route_name, route_path, vp_name, w, h)
                except Exception as e:
                    r = {
                        "route": route_name, "viewport": vp_name,
                        "ok": False, "error": str(e),
                    }
                print(r)
                results.append(r)

    failed = [r for r in results if not r.get("ok")]
    print("\n=== RESUMO ===")
    print(f"passou: {len(results) - len(failed)}/{len(results)}")
    if failed:
        for f in failed:
            print("  FAIL:", f)
        sys.exit(1)
    print("todos os cenários passaram ✅")


if __name__ == "__main__":
    asyncio.run(main())
