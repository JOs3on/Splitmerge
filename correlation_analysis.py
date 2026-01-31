import pandas as pd
import numpy as np
from datetime import datetime

def load_data(filename, label):
    df = pd.read_csv(filename, names=['timestamp', label])
    # Use a dummy date so we can use datetime objects
    df['dt'] = pd.to_datetime('2026-01-05 ' + df['timestamp'])
    df = df.set_index('dt')
    return df[[label]]

def analyze():
    print("Loading datasets...")
    try:
        spot = load_data('binance.csv', 'spot')
        futures = load_data('binance_futures.csv', 'futures')
    except Exception as e:
        print(f"Error loading files: {e}")
        return

    # Merge on nearest timestamp (asof merge)
    # Ensure they are sorted
    spot = spot.sort_index()
    futures = futures.sort_index()

    print(f"Spot records: {len(spot)}")
    print(f"Futures records: {len(futures)}")

    # Align data by merging on spot indices with the nearest future price
    # We'll use a 1-second tolerance
    merged = pd.merge_asof(spot, futures, left_index=True, right_index=True, direction='nearest', tolerance=pd.Timedelta('1s'))
    merged = merged.dropna()

    if len(merged) < 10:
        print("Not enough overlapping data within 1s tolerance.")
        return

    # Basic stats
    correlation = merged['spot'].corr(merged['futures'])
    spread = merged['futures'] - merged['spot']
    
    print("\n--- Correlation Analysis ---")
    print(f"Observations: {len(merged)}")
    print(f"Pearson Correlation: {correlation:.6f}")
    print(f"Average Spread (Fut - Spot): ${spread.mean():.4f}")
    print(f"Spread Std Dev: ${spread.std():.4f}")
    print(f"Min Spread: ${spread.min():.4f}")
    print(f"Max Spread: ${spread.max():.4f}")

    # Lead/Lag Analysis
    # We resample to a fixed 100ms grid for shift analysis
    grid = merged.resample('100ms').last().ffill()
    
    lags = []
    corrs = []
    # Test shifts from -1s to +1s in 100ms steps
    for i in range(-10, 11):
        shifted_corr = grid['spot'].corr(grid['futures'].shift(i))
        lags.append(i * 100)
        corrs.append(shifted_corr)
    
    max_corr_idx = np.argmax(corrs)
    best_lag = lags[max_corr_idx]
    best_corr = corrs[max_corr_idx]

    print("\n--- Lead/Lag Prediction ---")
    if best_lag > 0:
        print(f"Futures Lags Spot by approx {best_lag}ms (Correlation: {best_corr:.6f})")
    elif best_lag < 0:
        print(f"Futures Leads Spot by approx {abs(best_lag)}ms (Correlation: {best_corr:.6f})")
    else:
        print(f"Spot and Futures are perfectly synchronized (Correlation: {best_corr:.6f})")

if __name__ == "__main__":
    analyze()
