
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getReports,
    insertReport,
    resolveReport
} from './db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3000;

function sendJson(response, status, data) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
    let body = '';

    for await (const chunk of request) {
        body += chunk;

        if (body.length > 1_000_000) {
            throw new Error('Request body too large');
        }
    }

    return JSON.parse(body);
}

function validReport(report) {
    if (!report || typeof report !== 'object') return false;

    const validCoordinate = (value, min, max) =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= min &&
        value <= max;

    // Approximate Chapel Hill-area bounds.
    const validLat = (lat) => validCoordinate(lat, 35.7, 36.1);
    const validLng = (lng) => validCoordinate(lng, -79.3, -78.8);

    if (
        !validLat(report.lat) ||
        !validLng(report.lng) ||
        typeof report.category !== 'string' ||
        typeof report.severity !== 'string'
    ) {
        return false;
    }

    if (report.shape === 'line') {
        return (
            validLat(report.startLat) &&
            validLng(report.startLng) &&
            validLat(report.endLat) &&
            validLng(report.endLng)
        );
    }

    return (
        report.shape === 'circle' &&
        (report.radius == null ||
            (typeof report.radius === 'number' &&
                Number.isFinite(report.radius) &&
                report.radius >= 0))
    );
}

async function handleReports(request, response, pathname) {
    try {
        if (pathname === '/api/reports' && request.method === 'GET') {
            const reports = await getReports();
            sendJson(response, 200, { reports });
            return;
        }

        if (pathname === '/api/reports' && request.method === 'POST') {
            const body = await readJsonBody(request);

            if (!validReport(body)) {
                sendJson(response, 400, {
                    error: 'Provide a valid report within the Chapel Hill area.'
                });
                return;
            }

            const report = await insertReport(body);
            sendJson(response, 201, { report });
            return;
        }

        const resolveMatch = pathname.match(
            /^\/api\/reports\/(\d+)\/resolve$/
        );

        if (resolveMatch && request.method === 'POST') {
            const report = await resolveReport(Number(resolveMatch[1]));

            if (!report) {
                sendJson(response, 404, {
                    error: 'Report not found.'
                });
                return;
            }

            sendJson(response, 200, { report });
            return;
        }

        sendJson(response, 404, { error: 'API endpoint not found.' });
    } catch (error) {
        console.error('Reports API error:', error);

        if (!response.headersSent) {
            sendJson(response, 500, {
                error: 'Unable to access reports right now.'
            });
        }
    }
}

const server = createServer(async (request, response) => {
    const pathname = new URL(
        request.url,
        'http://localhost'
    ).pathname;

    if (pathname.startsWith('/api/')) {
        await handleReports(request, response, pathname);
        return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405);
        response.end();
        return;
    }

    const requestedPath =
        pathname === '/' ? '/index.html' : pathname;

    // Only serve files from the project directory.
    const allowedFiles = new Set([
        '/index.html',
        '/App.css',
        '/app.css',
        '/script.js',
        '/main.js'
    ]);

    if (!allowedFiles.has(requestedPath)) {
        response.writeHead(404);
        response.end('Not found');
        return;
    }

    try {
        const filePath = join(__dirname, requestedPath.slice(1));
        const content = await readFile(filePath);

        const extension = extname(filePath).toLowerCase();
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8'
        };

        response.writeHead(200, {
            'Content-Type':
                contentTypes[extension] || 'application/octet-stream'
        });

        if (request.method === 'HEAD') {
            response.end();
        } else {
            response.end(content);
        }
    } catch (error) {
        console.error('Static file error:', error);
        response.writeHead(404);
        response.end('File not found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Accessibility Map running on port ${PORT}`);
});
