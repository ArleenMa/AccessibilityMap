import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getReports, insertReport, resolveReport } from './db.mjs';

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

        response.writeHead(405, { Allow: 'GET, POST' });
        response.end();
    } catch (error) {
        console.error('Reports API error:', error);

        if (!response.headersSent) {
            sendJson(response, 500, {
                error: 'Unable to access reports right now.'
            });
        }
    }
}
