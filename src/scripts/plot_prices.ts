import * as fs from 'fs';
import * as path from 'path';

function parseCsv(filename: string) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) return [];

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    return lines.map(line => {
        const [time, price] = line.split(',');
        return { x: time, y: parseFloat(price) };
    });
}

async function generateChart() {
    const binanceData = parseCsv('binance.csv');
    const oracleData = parseCsv('poly_oracle.csv');
    const clobNoData = parseCsv('clob_no.csv');
    const clobYesData = parseCsv('clob_yes.csv');

    if (binanceData.length === 0) {
        console.error('Missing binance data.');
        return;
    }

    const targetPrice = 87192.3;

    // Determine the time range from the Oracle data (it's less frequent)
    const lastTimeStr = binanceData[binanceData.length - 1]?.x || "00:00:00";
    const firstOracleTime = oracleData.length > 0 ? oracleData[0].x : lastTimeStr;
    const lastOracleTime = oracleData.length > 0 ? oracleData[oracleData.length - 1].x : lastTimeStr;

    // Filter all datasets to match the relevant time range
    const binanceAligned = binanceData.filter(d => d.x >= firstOracleTime && d.x <= lastOracleTime);
    const oracleAligned = oracleData.filter(d => d.x >= firstOracleTime && d.x <= lastOracleTime);
    const clobNoAligned = clobNoData.filter(d => d.x >= firstOracleTime && d.x <= lastOracleTime);
    const clobYesAligned = clobYesData.filter(d => d.x >= firstOracleTime && d.x <= lastOracleTime);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Crypto Latency Analysis</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.3.1/dist/chartjs-adapter-luxon.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        body { 
            background: #0f172a; 
            color: white; 
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container {
            width: 98%;
            max-width: 1600px;
            background: rgba(30, 41, 59, 0.7);
            padding: 20px;
            border-radius: 16px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        h1 { margin-bottom: 10px; font-weight: 300; letter-spacing: -1px; }
        .stats { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center; }
        .stat-card {
            background: rgba(255,255,255,0.05);
            padding: 8px 16px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
            font-size: 0.9rem;
        }
        .instructions {
            margin-top: 10px;
            font-size: 0.8rem;
            color: rgba(255,255,255,0.5);
        }
    </style>
</head>
<body>
    <h1>Latency Analysis: BTC $87,192.3 Target</h1>
    <div class="stats">
        <div class="stat-card" style="border-color: #f7931a">Binance: BTC/USDT</div>
        <div class="stat-card" style="border-color: #8247e5">Poly Oracle: BTC/USD</div>
        <div class="stat-card" style="border-color: #10b981">CLOB: NO</div>
        <div class="stat-card" style="border-color: #ef4444">CLOB: YES</div>
        <div class="stat-card" style="border-color: #ffffff">Target: $87,192.30</div>
    </div>
    <div class="container">
        <canvas id="priceChart"></canvas>
    </div>
    <div class="instructions">
        Scroll to zoom • Click and drag to pan • Double click to reset
    </div>

    <script>
        const binanceRaw = ${JSON.stringify(binanceAligned)};
        const oracleRaw = ${JSON.stringify(oracleAligned)};
        const clobNoRaw = ${JSON.stringify(clobNoAligned)};
        const clobYesRaw = ${JSON.stringify(clobYesAligned)};

        function parseTime(timeStr) {
            const now = luxon.DateTime.now().toISODate();
            return luxon.DateTime.fromISO(now + 'T' + timeStr);
        }

        const binanceData = binanceRaw.map(d => ({ x: parseTime(d.x).toMillis(), y: d.y }));
        const oracleData = oracleRaw.map(d => ({ x: parseTime(d.x).toMillis(), y: d.y }));
        const clobNoData = clobNoRaw.map(d => ({ x: parseTime(d.x).toMillis(), y: d.y }));
        const clobYesData = clobYesRaw.map(d => ({ x: parseTime(d.x).toMillis(), y: d.y }));

        const ctx = document.getElementById('priceChart').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Binance',
                        data: binanceData,
                        borderColor: '#f7931a',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0,
                        stepped: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Poly Oracle',
                        data: oracleData,
                        borderColor: '#8247e5',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0,
                        stepped: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'CLOB NO',
                        data: clobNoData,
                        borderColor: '#10b981',
                        borderWidth: 1.5,
                        pointRadius: 1,
                        tension: 0,
                        stepped: true,
                        yAxisID: 'y2'
                    },
                    {
                        label: 'CLOB YES',
                        data: clobYesData,
                        borderColor: '#ef4444',
                        borderWidth: 1.5,
                        pointRadius: 1,
                        tension: 0,
                        stepped: true,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                animation: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'second', displayFormats: { second: 'HH:mm:ss' } },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)', maxRotation: 0 }
                    },
                    y: {
                        position: 'left',
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { 
                            color: 'rgba(247, 147, 26, 0.9)',
                            callback: value => '$' + value.toLocaleString()
                        },
                        title: { display: true, text: 'Market Price ($)', color: 'white' }
                    },
                    y2: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#10b981' },
                        title: { display: true, text: 'CLOB Token Price', color: 'white' }
                    }
                },
                plugins: {
                    legend: { labels: { color: 'white' } },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1
                    },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
                    },
                    annotation: {
                        annotations: {
                            targetLine: {
                                type: 'line',
                                yMin: ${targetPrice},
                                yMax: ${targetPrice},
                                borderColor: 'rgba(255, 255, 255, 0.8)',
                                borderWidth: 2,
                                borderDash: [6, 6],
                                label: {
                                    display: true,
                                    content: 'Target: $87,192.30',
                                    position: 'start',
                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    font: { size: 12 }
                                }
                            }
                        }
                    }
                }
            }
        });

        window.addEventListener('dblclick', () => chart.resetZoom());
    </script>
</body>
</html>
    `;

    fs.writeFileSync('chart.html', htmlContent);
    console.log('Chart regenerated with target price line: chart.html');
}

generateChart().catch(console.error);
