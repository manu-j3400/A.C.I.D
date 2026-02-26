from playwright.sync_api import sync_playwright
import time

def test_pages_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Test Scanner Page
        print("Navigating to Scanner page...")
        page.goto("http://localhost:5173/scanner")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="verification/scanner.png")
        print("Scanner page screenshot saved.")

        # Test Desktop Home Page (Dashboard)
        print("Navigating to Dashboard...")
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="verification/dashboard.png")
        print("Dashboard screenshot saved.")

        # Test Neural Engine Page
        print("Navigating to Neural Engine...")
        page.goto("http://localhost:5173/engine")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="verification/neural_engine.png")
        print("Neural Engine screenshot saved.")

        # Test Batch Scanner Page
        print("Navigating to Batch Scanner...")
        page.goto("http://localhost:5173/batch")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="verification/batch_scanner.png")
        print("Batch Scanner screenshot saved.")

        browser.close()

if __name__ == "__main__":
    test_pages_load()
