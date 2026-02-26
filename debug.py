from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser error: {err}"))
        page.goto("http://localhost:8000")
        
        # Check nav buttons
        print("Nav buttons:")
        for btn in page.locator(".nav-btn").all():
            print(f" - {btn.text_content()} (id: {btn.get_attribute('id')})")
            
        # Click settings
        print("Clicking settings...")
        page.click("#nav-settings")
        
        # Check if view-settings is active
        is_active = page.locator("#view-settings").evaluate("el => el.classList.contains('active')")
        print(f"Is Settings active? {is_active}")
        
        browser.close()

run()
