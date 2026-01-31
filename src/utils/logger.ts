import * as fs from 'fs';

export const formatTime = (ms: number): string => {
    return new Date(ms).toISOString().split('T')[1].replace('Z', '');
};

export const logToCsv = (filename: string, timestamp: number, price: number) => {
    const line = `${formatTime(timestamp)},${price}\n`;
    fs.appendFile(filename, line, (err) => {
        if (err) console.error(`Failed to write to ${filename}:`, err);
    });
};
