import csv
import json
from datetime import datetime

def load_csv(filename):
    data = []
    try:
        with open(filename, 'r') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 2: continue
                ts = row[0]
                try:
                    val = float(row[1])
                    data.append({"x": ts, "y": val})
                except ValueError:
                    continue
    except FileNotFoundError:
        print(f"Warning: {filename} not found.")
    return data

def main():
    print("Loading data...")
    binance_spot = load_csv('binance.csv')
    binance_futures = load_csv('binance_futures.csv')
    clob_yes = load_csv('clob_yes.csv')
    clob_no = load_csv('clob_no.csv')

    html_template = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Crypto Analysis: Spot vs Futures vs Polymarket</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.3.1/dist/chartjs-adapter-luxon.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        body {{ background: #0f172a; color: white; font-family: 'Inter', sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }}
        .container {{ width: 98%; max-width: 1600px; background: rgba(30, 41, 59, 0.7); padding: 20px; border-radius: 16px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }}
        h1 {{ font-weight: 300; margin-bottom: 20px; }}
        #priceChart {{ width: 100% !important; height: 750px !important; }}
    </style>
</head>
<body>
    <h1>BTC Analysis: Spot vs Futures vs Polymarket</h1>
    <div class="container">
        <canvas id="priceChart"></canvas>
    </div>
    <script>
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        const binanceSpot = {json.dumps(binance_spot)};
        const binanceFutures = {json.dumps(binance_futures)};
        const clobYes = {json.dumps(clob_yes)};
        const clobNo = {json.dumps(clob_no)};

        new Chart(ctx, {{
            type: 'line',
            data: {{
                datasets: [
                    {{
                        label: 'Binance Spot',
                        data: binanceSpot,
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        yAxisID: 'yPrice'
                    }},
                    {{
                        label: 'Binance Futures',
                        data: binanceFutures,
                        borderColor: '#f87171',
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        yAxisID: 'yPrice'
                    }},
                    {{
                        label: 'Poly YES',
                        data: clobYes,
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74, 222, 128, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        yAxisID: 'yPoly'
                    }},
                    {{
                        label: 'Poly NO',
                        data: clobNo,
                        borderColor: '#fbbf24',
                        backgroundColor: 'rgba(251, 191, 36, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        yAxisID: 'yPoly'
                    }}
                ]
            }},
            options: {{
                responsive: true,
                interaction: {{
                    mode: 'index',
                    intersect: false,
                }},
                scales: {{
                    x: {{
                        type: 'time',
                        time: {{
                            parser: 'HH:mm:ss.SSS',
                            unit: 'second',
                            displayFormats: {{
                                second: 'HH:mm:ss'
                            }}
                        }},
                        grid: {{ color: 'rgba(255, 255, 255, 0.05)' }},
                        ticks: {{ color: '#94a3b8', maxTicksLimit: 20 }}
                    }},
                    yPrice: {{
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {{ display: true, text: 'BTC Price ($)', color: '#94a3b8' }},
                        grid: {{ color: 'rgba(255, 255, 255, 0.1)' }},
                        ticks: {{ color: '#94a3b8' }}
                    }},
                    yPoly: {{
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        max: 1,
                        title: {{ display: true, text: 'Poly Probability', color: '#94a3b8' }},
                        grid: {{ drawOnChartArea: false }},
                        ticks: {{ color: '#94a3b8' }}
                    }}
                }},
                plugins: {{
                    zoom: {{
                        zoom: {{
                            wheel: {{ enabled: true }},
                            pinch: {{ enabled: true }},
                            mode: 'x',
                        }},
                        pan: {{
                            enabled: true,
                            mode: 'x',
                        }}
                    }},
                    legend: {{
                        labels: {{ color: 'white' }}
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>
"""
    with open('chart.html', 'w') as f:
        f.write(html_template)
    print("✓ chart.html generated successfully.")

if __name__ == "__main__":
    main()
