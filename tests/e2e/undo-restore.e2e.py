import asyncio, re
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/undo_restore_e2e/shots")
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

        # Estado inicial: nada restaurado ainda.
        restored_before = (await page.get_by_test_id("restored").inner_text()).strip()
        assert restored_before == "", f"esperava vazio antes do clique, veio {restored_before!r}"

        # === Fluxo: delete → toast "Desfazer (Ns)" → clicar antes de expirar ===
        await page.get_by_test_id("trigger-3s").click()

        # Aguarda o botão aparecer com contagem "Desfazer (Ns)" > 0
        await page.wait_for_function(
            "() => Array.from(document.querySelectorAll('button[data-button=\"true\"]'))"
            ".some(b => /^Desfazer \\([1-3]s\\)$/.test((b.textContent||'').trim()))",
            timeout=5000,
        )
        toast_btn = page.locator(
            '[data-sonner-toaster] button[data-button="true"]',
            has_text=re.compile(r"^Desfazer \(\ds\)$"),
        ).first
        label = (await toast_btn.inner_text()).strip()
        assert re.match(r"^Desfazer \([1-3]s\)$", label), f"label inesperado: {label!r}"

        # Botão deve estar habilitado (sem pointer-events:none / opacity 0.5)
        style_before = (await toast_btn.get_attribute("style") or "").lower()
        assert "pointer-events: none" not in style_before and "pointer-events:none" not in style_before, \
            f"botão não deveria estar desabilitado antes de expirar — style={style_before!r}"
        await page.screenshot(path=str(OUT / "2_before_click.png"))

        # Clica ANTES de expirar → restauração deve ocorrer
        await toast_btn.click()

        # Aguarda o harness registrar o restore (data-testid="restored" recebe "act-1")
        await page.wait_for_function(
            "() => (document.querySelector('[data-testid=\"restored\"]')?.textContent || '').trim() === 'act-1'",
            timeout=3000,
        )
        restored_after = (await page.get_by_test_id("restored").inner_text()).strip()
        assert restored_after == "act-1", f"onRestore deveria ter recebido snapshot.id='act-1', veio {restored_after!r}"

        # Mensagem de expiração NÃO deve aparecer no fluxo de sucesso.
        expired_visible = await page.locator('text="Prazo para desfazer expirado"').count()
        assert expired_visible == 0, "mensagem de expiração não deveria aparecer no fluxo de sucesso"

        # Nota: `onExpire` também é usado como "cleanup" ao fechar o toast (limpa
        # localStorage), então pode ser chamado 1x após o restore — não é sinal
        # de expiração real. O que importa é que `onRestore` recebeu o snapshot.

        await page.screenshot(path=str(OUT / "3_after_restore.png"))

        print("OK — undo restore E2E passou (delete → clicar antes de expirar → restaurado)")
        print("erros de página:", errors)
        assert not errors, f"erros de página detectados: {errors}"
        await browser.close()

asyncio.run(main())
