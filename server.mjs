import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getReports, insertReport, resolveReport } from './db.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.ORS_API_KEY?.trim();
const maxRequestBytes = 4096;
const allowedFiles = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/App.css', ['App.css', 'text/css; charset=utf-8']],
    ['/images/walkingram.png', ['images/walkingram.png', 'image/png']],
    ['/images/standingram.png', ['images/standingram.png', 'image/png']]
]);

function sendJson(response, status, body) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
    if (!request.headers['content-type']?.startsWith('application/json')) {
        const error = new Error('Content-Type must be application/json.');
        error.status = 415;
        throw error;
    }
    if (Number(request.headers['content-length'] || 0) > maxRequestBytes) {
        request.resume();
        const error = new Error('Request body is too large.');
        error.status = 413;
        throw error;
    }

    let size = 0;
    const chunks = [];
    let tooLarge = false;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > maxRequestBytes) {
            tooLarge = true;
            chunks.length = 0;
            continue;
        }
        if (!tooLarge) chunks.push(chunk);
    }
    if (tooLarge) {
        const error = new Error('Request body is too large.');
        error.status = 413;
        throw error;
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        const error = new Error('Request body must be valid JSON.');
        error.status = 400;
        throw error;
    }
}

function validCoordinates(coordinates) {
    return Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        coordinates.every((point) =>
            Array.isArray(point) &&
            point.length === 2 &&
            Number.isFinite(point[0]) &&
            Number.isFinite(point[1]) &&
            point[0] >= -79.18 &&
            point[0] <= -78.93 &&
            point[1] >= 35.82 &&
            point[1] <= 36.02
        );
}

function inBounds(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) &&
        lng >= -79.18 && lng <= -78.93 &&
        lat >= 35.82 && lat <= 36.02;
}

function validReport(body) {
    return body &&
        (body.shape === 'line' || body.shape === 'circle') &&
        Number.isFinite(body.radius) &&
        inBounds(body.lat, body.lng) &&
        inBounds(body.startLat, body.startLng) &&
        inBounds(body.endLat, body.endLng) &&
        typeof body.category === 'string' && body.category.trim().length > 0 &&
        typeof body.severity === 'string' && body.severity.trim().length > 0 &&
        (body.description === undefined || typeof body.description === 'string') &&
        (body.expectedDuration === undefined || typeof body.expectedDuration === 'string') &&
        (body.locationLabel === undefined || typeof body.locationLabel === 'string');
}

async function handleReports(request, response, pathname) {
    if (pathname === '/api/reports' && request.method === 'GET') {
        sendJson(response, 200, { reports: getReports() });
        return;
    }

    if (pathname === '/api/reports' && request.method === 'POST') {
        const body = await readJsonBody(request);
        if (!validReport(body)) {
            sendJson(response, 400, { error: 'Provide a valid report within the Chapel Hill area.' });
            return;
        }
        const report = insertReport(body);
        sendJson(response, 201, { report });
        return;
    }

    const resolveMatch = pathname.match(/^\/api\/reports\/(\d+)\/resolve$/);
    if (resolveMatch && request.method === 'POST') {
        const report = resolveReport(Number(resolveMatch[1]));
        if (!report) {
            sendJson(response, 404, { error: 'Report not found.' });
            return;
        }
        sendJson(response, 200, { report });
        return;
    }

    response.writeHead(405, { Allow: 'GET, POST' });
    response.end();
}

async function handleRoute(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { Allow: 'POST' });
        response.end();
        return;
    }

    if (!apiKey) {
        sendJson(response, 503, {
            error: 'Walking routes are not configured on this server.'
        });
        return;
    }

    const body = await readJsonBody(request);
    if (!validCoordinates(body?.coordinates)) {
        sendJson(response, 400, {
            error: 'Provide a start and destination within the Chapel Hill area.'
        });
        return;
    }

    const upstream = await fetch(
        'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
        {
            method: 'POST',
            headers: {
                Authorization: apiKey,
                'Content-Type': 'application/json',
                Accept: 'application/geo+json'
            },
            body: JSON.stringify({ coordinates: body.coordinates }),
            signal: AbortSignal.timeout(15000)
        }
    );

    if (!upstream.ok) {
        console.error(`OpenRouteService returned HTTP ${upstream.status}.`);
        sendJson(response, 502, {
            error: 'The routing service could not calculate this route. Please try again.'
        });
        return;
    }

    const data = await upstream.json();
    const feature = data.features?.[0];
    if (!feature?.geometry || !feature.properties?.summary) {
        sendJson(response, 502, {
            error: 'The routing service returned an invalid route.'
        });
        return;
    }

    sendJson(response, 200, { feature });
}

const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/route') {
        try {
            await handleRoute(request, response);
        } catch (error) {
            if (response.headersSent) {
                response.destroy(error);
                return;
            }
            console.error('Routing request failed:', error);
            sendJson(response, error.status || 502, {
                error: error.status
                    ? error.message
                    : 'Unable to contact the routing service. Please try again.'
            });
        }
        return;
    }

    if (pathname === '/api/reports' || pathname.startsWith('/api/reports/')) {
        try {
            await handleReports(request, response, pathname);
        } catch (error) {
            if (response.headersSent) {
                response.destroy(error);
                return;
            }
            console.error('Reports request failed:', error);
            sendJson(response, error.status || 500, {
                error: error.status ? error.message : 'Unable to process this report request.'
            });
        }
        return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
    }

    const file = allowedFiles.get(pathname);
    if (!file) {
        response.writeHead(404);
        response.end('Not found');
        return;
    }

    try {
        const content = await readFile(join(directory, file[0]));
        response.writeHead(200, {
            'Content-Type': file[1],
            'Cache-Control': 'no-cache'
        });
        response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
        console.error(`Unable to serve ${file[0]}:`, error);
        response.writeHead(500);
        response.end('Unable to serve the application.');
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Accessibility Map is available on port ${port}.`);
});
