import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/undo_reload_expired_e2e/shots")
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://localhost:8080/dev/undo-toast"
STORAGE_KEY = "c360:undo:dev:harness"

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # === 1) Delete persistente com TTL curto (1s) ===
        await page.goto(URL, wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="trigger-persist-1s"]', timeout=15000)

        # Garante estado limpo
        await page.evaluate(f"localStorage.removeItem({STORAGE_KEY!r})")

        await page.get_by_test_id("trigger-persist-1s").click()

        # Chave foi escrita no localStorage
        stored = await page.evaluate(f"localStorage.getItem({STORAGE_KEY!r})")
        assert stored, "delete persistente deveria ter escrito no localStorage"
        await page.screenshot(path=str(OUT / "1_after_delete.png"))

        # === 2) Aguarda expirar (TTL 1s + margem) ===
        await page.wait_for_timeout(1500)

        # === 3) Reload — na carga, readUndo deve devolver null (expirado)
        #        e o harness dispara "Prazo para desfazer expirado" ===
        await page.reload(wait_until="domcontentloaded")

        # Mensagem de expiração aparece após o reload.
        await page.wait_for_selector('text="Prazo para desfazer expirado"', timeout=3000)
        await page.screenshot(path=str(OUT / "2_after_reload.png"))

        # Restauração NÃO ocorreu.
        restored = (await page.get_by_test_id("restored").inner_text()).strip()
        assert restored == "", f"onRestore não deveria ser chamado após reload expirado — veio {restored!r}"

        # Chave foi purgada do localStorage (readUndo remove entradas expiradas).
        after = await page.evaluate(f"localStorage.getItem({STORAGE_KEY!r})")
        assert after is None, f"localStorage deveria ter sido limpo após expirar — veio {after!r}"

        # Nenhum toast de "Desfazer (Ns)" ativo — só o de expiração.
        undo_btns = await page.locator(
            '[data-sonner-toaster] button[data-button="true"]'
        ).filter(has_text="Desfazer").count()
        assert undo_btns == 0, f"nenhum botão Desfazer deveria estar ativo após reload expirado — vi {undo_btns}"

        print("OK — reload após expirar: mensagem de expiração exibida e restauração bloqueada")
        assert not errors, f"erros de página: {errors}"
        await browser.close()

asyncio.run(main())
