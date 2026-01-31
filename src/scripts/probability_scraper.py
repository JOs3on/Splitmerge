import asyncio
import nodriver as uc
import time
import json
import os
import datetime
import re
import traceback

# Configuration
MARKET_DURATION_SEC = 15 * 60

async def get_current_market_timestamp():
    now = time.time()
    # Floor to nearest 15 mins (900 seconds)
    return int((now // 900) * 900)

async def get_market_url(timestamp):
    return f"https://polymarket.com/event/btc-updown-15m-{timestamp}"

class ProbabilityScraper:
    def __init__(self):
        self.browser = None
        self.page = None
        self.current_timestamp = None
        self.log_file = "/Users/jose/PL-Crypto_Latency/logs/market_probabilities.jsonl"
        
        log_dir = os.path.dirname(self.log_file)
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

    async def start(self):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Starting browser (Attempt {attempt + 1})...", flush=True)
                self.browser = await uc.start(
                    browser_executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                    no_sandbox=True
                )
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Browser started successfully.", flush=True)
                await self.run_loop()
                return
            except Exception as e:
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Browser startup failed: {e}", flush=True)
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)
                else:
                    print("Max retries reached. Exiting.", flush=True)
                    raise

    async def run_loop(self):
        while True:
            try:
                target_ts = await get_current_market_timestamp()
                
                if target_ts != self.current_timestamp:
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Market Rollover Detected -> {target_ts}")
                    # Update timestamp state immediately
                    self.current_timestamp = target_ts 
                    
                    success = await self.switch_market(target_ts)
                    if not success:
                        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Rollover failed. Raising error to restart browser.")
                        # Force a restart of the entire browser session on rollover failure
                        raise Exception("RolloverNavigationFailed")
                
                await self.scrape_current_probability()
                await asyncio.sleep(1) # Stream every second
                
            except Exception as e:
                # If it's a critical error where we should restart the browser:
                if "StopIteration" in str(e) or "Target closed" in str(e) or "RolloverNavigationFailed" in str(e):
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Critical browser error: {e}. Breaking loop for restart.")
                    raise # This will be caught by the start() loop and trigger a retry.
                
                print(f"Error in loop: {e}")
                await asyncio.sleep(5)

    async def switch_market(self, timestamp):
        url = await get_market_url(timestamp)
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Navigating to: {url}", flush=True)
        
        try:
            # Try to navigate existing page if it exists and is alive
            if self.page:
                try:
                    # page.get() navigates the current tab in nodriver
                    await self.page.get(url)
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Navigated existing tab to new market.", flush=True)
                except Exception as e:
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Existing tab navigation failed ({e}). Opening new one...", flush=True)
                    self.page = await self.browser.get(url)
            else:
                self.page = await self.browser.get(url)
                
            # --- Stealth Bypass: Force Visibility ---
            try:
                await self.page.evaluate("""
                    Object.defineProperty(document, 'visibilityState', {get: () => 'visible', configurable: true});
                    Object.defineProperty(document, 'hidden', {get: () => false, configurable: true});
                    document.dispatchEvent(new Event('visibilitychange'));
                """)
            except:
                pass

            # --- AGGRESSIVE HYDRATION: Force DOM to render even when on another desktop ---
            try:
                await self.page.evaluate("""
                    // 1. Disable Chrome's background tab throttling
                    if (window._hydrationInterval) clearInterval(window._hydrationInterval);
                    window._hydrationInterval = setInterval(() => {
                        // Force visibility
                        Object.defineProperty(document, 'visibilityState', {get: () => 'visible', configurable: true});
                        Object.defineProperty(document, 'hidden', {get: () => false, configurable: true});
                        document.dispatchEvent(new Event('visibilitychange'));
                        
                        // Trigger reflow and repaint
                        document.body.offsetHeight;
                        window.scrollTo(0, window.scrollY);
                        
                        // Force requestAnimationFrame to run
                        requestAnimationFrame(() => {});
                        
                        // Dispatch focus events
                        window.dispatchEvent(new Event('focus'));
                        document.dispatchEvent(new FocusEvent('focusin'));
                    }, 500);
                    
                    // 2. Force immediate hydration
                    document.body.offsetHeight;
                    window.scrollTo(0, 1);
                    window.scrollTo(0, 0);
                    
                    // 3. Trigger React re-render by simulating user interaction
                    document.dispatchEvent(new MouseEvent('mousemove', {clientX: 100, clientY: 100}));
                """)
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Hydration script injected.", flush=True)
            except Exception as e:
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Hydration injection failed: {e}", flush=True)

            # Wait for elements to be available
            await asyncio.sleep(8) 
            
            # 3. Click Polymarket chart tab
            try:
                radio_buttons = await self.page.select_all('button[role="radio"]')
                if len(radio_buttons) >= 2:
                    await radio_buttons[0].click()
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Switched to Polymarket chart view", flush=True)
                elif radio_buttons:
                    await radio_buttons[0].click()
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Clicked chart toggle", flush=True)
            except Exception as e:
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Chart switch failed: {e}", flush=True)

            # Debug: Verify page is ready for scraping
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Post-switch: Page ready. Checking for number-flow element...", flush=True)
            try:
                test_result = await self.page.evaluate("document.querySelector('number-flow, number-flow-react') ? 'FOUND' : 'NOT_FOUND'")
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Post-switch: number-flow element: {test_result}", flush=True)
            except Exception as e:
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Post-switch: element check failed: {e}", flush=True)
            
            return True

        except Exception as e:
            if "WebSocket connection: HTTP 500" in str(e) or "StopIteration" in str(e) or "Target closed" in str(e):
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Navigation/Switch logic caught exception: {e}", flush=True)
                return False
            else:
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Critical Switch logic error: {e}", flush=True)
                raise # Percolate critical errors up to run_loop

    async def scrape_current_probability(self):
        if not self.page:
            return

        # Ensure focus/visibility is maintained periodically
        try:
            await self.page.evaluate("""
                if (document.visibilityState !== 'visible') {
                    Object.defineProperty(document, 'visibilityState', {get: () => 'visible', configurable: true});
                    Object.defineProperty(document, 'hidden', {get: () => false, configurable: true});
                    document.dispatchEvent(new Event('visibilitychange'));
                }
                window.onblur = null;
                window.focus();
            """)
        except:
            pass

        # Targeted JS to penetrate number-flow shadow DOM and read --current variables
        js_code = """
        (() => {
            const flow = document.querySelector('number-flow, number-flow-react');
            if (!flow) return "ERR:NO_FLOW";
            
            const shadow = flow.shadowRoot;
            if (!shadow) return "ERR:NO_SHADOW";
            
            const digitSpans = Array.from(shadow.querySelectorAll('span[part~="digit"]'));
            if (digitSpans.length === 0) return "ERR:NO_DIGITS";
            
            let reconstructed = "";
            digitSpans.forEach(span => {
                const currentVal = span.style.getPropertyValue('--current');
                if (currentVal !== undefined && currentVal !== "") {
                    reconstructed += currentVal.trim();
                }
            });
            
            return reconstructed || "ERR:EMPTY";
        })()
        """
        
        try:
            result = await self.page.evaluate(js_code)
            
            if result and not str(result).startswith("ERR:"):
                # Success - reset consecutive error count if we ever implemented one
                self.consecutive_errors = 0 
                prob_val = result
                
                entry = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "market_timestamp": self.current_timestamp,
                    "probability": prob_val,
                    "raw": result
                }
                
                with open(self.log_file, "a") as f:
                    f.write(json.dumps(entry) + "\n")
                    f.flush()
                
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Probability Update: {prob_val}%", flush=True)
                self.err_count = 0  # Reset ERR counter on success
            else:
                # Log ERR: states to help debug post-rollover hangs
                if not hasattr(self, 'err_count'):
                    self.err_count = 0
                self.err_count += 1
                if self.err_count % 10 == 1:  # Log every 10th error to avoid spam
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Scrape state: {result} (count: {self.err_count})", flush=True)
                
                # Auto-recovery: If NO_FLOW persists for 60 attempts (~1 minute), reload the page
                if self.err_count >= 60 and "NO_FLOW" in str(result):
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] ERR:NO_FLOW persisted for 60+ attempts. Forcing page reload to re-hydrate...", flush=True)
                    self.err_count = 0
                    await self.switch_market(self.current_timestamp)

        except Exception as e:
            error_msg = str(e)
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Scrape error: {error_msg}", flush=True)
            traceback.print_exc()
            
            # Recovery logic for persistent WebSocket 500 or connection errors
            if "WebSocket connection: HTTP 500" in error_msg or "Target closed" in error_msg:
                if not hasattr(self, 'consecutive_errors'):
                    self.consecutive_errors = 0
                self.consecutive_errors += 1
                
                if self.consecutive_errors >= 10:
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Persistent errors detected. Forcing page reload...", flush=True)
                    self.consecutive_errors = 0
                    await self.switch_market(self.current_timestamp)

async def main():
    """Perpetual restart wrapper for the scraper."""
    while True:
        scraper = ProbabilityScraper()
        try:
            await scraper.start()
        except KeyboardInterrupt:
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Keyboard interrupt. Exiting.", flush=True)
            break
        except Exception as e:
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Scraper crashed with: {e}. Restarting in 5 seconds...", flush=True)
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
