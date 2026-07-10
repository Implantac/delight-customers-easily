import asyncio, re
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/undo_toast_e2e/shots")
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:8080/dev/undo-toast"

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_selector('[data-testid="trigger-3s"]')
        await page.screenshot(path=str(OUT / "1_loaded.png"))

        # === Scenario 1: 3s toast — botão renderiza "Desfazer (Ns)" com contagem ===
        await page.get_by_test_id("trigger-3s").click()
        # Aguarda toast aparecer
        await page.wait_for_function(
            "() => Array.from(document.querySelectorAll('button[data-button=\"true\"]')).some(b => /^Desfazer \\(\\d+s\\)$/.test((b.textContent||'').trim()))",
            timeout=5000,
        )
        toast_btn = page.locator('button[data-button="true"]').first
        label_initial = await toast_btn.first.inner_text()
        assert re.match(r"Desfazer \(3s\)", label_initial), f"esperava Desfazer (3s), veio {label_initial!r}"
        await page.screenshot(path=str(OUT / "2_countdown_3s.png"))

        # Aguarda contagem cair para 2s (~1.2s)
        await page.wait_for_timeout(1200)
        label_2 = await toast_btn.first.inner_text()
        assert "2s" in label_2 or "1s" in label_2, f"contagem não decrementou: {label_2!r}"

        # Aguarda expiração — botão vira "Desfazer (0s)" e desabilita via style
        await page.wait_for_function(
            "() => Array.from(document.querySelectorAll('button[data-button=\"true\"]')).some(b => b.textContent && b.textContent.trim() === 'Desfazer (0s)')",
            timeout=5000,
        )
        expired_btn = page.locator('[data-sonner-toaster] button[data-button="true"]', has_text=re.compile(r"^Desfazer \(0s\)$")).first
        style = await expired_btn.get_attribute("style") or ""
        assert "pointer-events: none" in style.lower() or "pointer-events:none" in style.lower(), f"botão expirado deveria ter pointer-events:none — style={style!r}"
        assert "opacity: 0.5" in style or "opacity:0.5" in style, f"botão expirado deveria ter opacity 0.5 — style={style!r}"
        await page.screenshot(path=str(OUT / "3_zero_disabled.png"))

        # Clica no botão expirado (via evaluate — pointer-events:none bloqueia clique real)
        await expired_btn.evaluate("el => el.click()")
        await page.wait_for_selector('text="Prazo para desfazer expirado"', timeout=2000)
        await page.screenshot(path=str(OUT / "4_expired_error.png"))

        # Garante que o restore NÃO foi chamado
        restored = (await page.get_by_test_id("restored").inner_text()).strip()
        assert restored == "", f"onRestore não deveria ter sido chamado após expirar — veio {restored!r}"

        print("OK — undo toast E2E passou")
        print("erros de página:", errors)
        await browser.close()

asyncio.run(main())
