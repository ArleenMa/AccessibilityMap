# Accessibility Map

An interactive map for the Chapel Hill community to find locations, report accessibility issues, and request walking routes.

## Run locally

Requirements: Node.js 20.6 or later and an OpenRouteService API key with walking-directions access.

1. Create or rotate an API key in your OpenRouteService account.
2. Copy `.env.example` to `.env` and set `ORS_API_KEY` to the key. Keep `.env` private; it is ignored by Git.
3. Run `node --env-file=.env server.mjs`.
4. Open <http://localhost:3000>.

The Node server serves the app and forwards walking-route requests to OpenRouteService. The API key stays on the server and is never sent to the browser. The server only accepts route endpoints within the Chapel Hill search area. For deployment, configure `ORS_API_KEY` as a server-side environment secret and start the app with `npm start`; do not deploy the `.env` file.

## Features

- Search Chapel Hill locations and select a location for an issue report.
- Report construction, blocked sidewalks, broken elevators, inaccessible ramps, and other issues with severity and expected duration.
- View and delete issue reports during the current browser session.
- Find and display a walking route between two Chapel Hill locations.

Map tiles and location search use OpenStreetMap services. Issue reports are currently held in the browser and are not persisted between sessions.

## Credits

Leaflet: Copyright (c) 2010-2026, Volodymyr Agafonkin; Copyright (c) 2010-2011, CloudMade. All rights reserved.

AI usage: Claude Code was used to set up the Leaflet map.
