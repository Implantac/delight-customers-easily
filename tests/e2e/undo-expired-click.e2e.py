import asyncio, re
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/undo_expired_click_e2e/shots")
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

        # === Delete → dispara toast de "Desfazer (Ns)" com 3s de janela ===
        await page.get_by_test_id("trigger-3s").click()

        # Confirma que o botão renderiza com contagem inicial > 0.
        await page.wait_for_function(
            "() => Array.from(document.querySelectorAll('button[data-button=\"true\"]'))"
            ".some(b => /^Desfazer \\([1-3]s\\)$/.test((b.textContent||'').trim()))",
            timeout=5000,
        )
        await page.screenshot(path=str(OUT / "1_countdown_start.png"))

        # === Aguarda o contador chegar a 0 (botão vira "Desfazer (0s)") ===
        await page.wait_for_function(
            "() => Array.from(document.querySelectorAll('button[data-button=\"true\"]'))"
            ".some(b => (b.textContent||'').trim() === 'Desfazer (0s)')",
            timeout=6000,
        )
        expired_btn = page.locator(
            '[data-sonner-toaster] button[data-button="true"]',
            has_text=re.compile(r"^Desfazer \(0s\)$"),
        ).first

        # Botão desabilitado via style (pointer-events:none + opacity 0.5).
        style = (await expired_btn.get_attribute("style") or "").lower()
        assert "pointer-events: none" in style or "pointer-events:none" in style, \
            f"botão em 0s deveria ter pointer-events:none — style={style!r}"
        assert "opacity: 0.5" in style or "opacity:0.5" in style, \
            f"botão em 0s deveria ter opacity 0.5 — style={style!r}"
        await page.screenshot(path=str(OUT / "2_reached_zero.png"))

        # === Clica após expirar (via evaluate — pointer-events:none bloqueia clique real) ===
        await expired_btn.evaluate("el => el.click()")

        # Mensagem de expiração aparece.
        await page.wait_for_selector('text="Prazo para desfazer expirado"', timeout=2000)
        await page.screenshot(path=str(OUT / "3_expired_message.png"))

        # onRestore NÃO foi chamado — data-testid="restored" permanece vazio.
        restored = (await page.get_by_test_id("restored").inner_text()).strip()
        assert restored == "", f"onRestore não deveria ter sido chamado após expirar — veio {restored!r}"

        print("OK — clique após expirar: restauração bloqueada e mensagem de expiração exibida")
        assert not errors, f"erros de página: {errors}"
        await browser.close()

asyncio.run(main())
