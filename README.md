# Accessibility Map

An interactive map of the UNC campus to find locations, report accessibility issues, and request walking routes.

## Features

- Search Chapel Hill locations and select a location for an issue report.
- Switch between route finding and issue reporting using the sidebar tabs.
- Report construction, blocked sidewalks, broken elevators, inaccessible ramps, and other issues with severity and expected duration. Mark each issue area's start and end on the map to define its circular coverage.
- View and mark issue reports as resolved.
- Find and display a walking route between two Chapel Hill locations, choosing to avoid all reported issues, moderate and severe issues, or severe issues.

Map tiles and location search use OpenStreetMap services. Issue reports are stored in a Supabase database so they persist on restarts and can be viewed by anyone. Route avoidance uses every unresolved report on file.

## Credits

Leaflet: Copyright (c) 2010-2026, Volodymyr Agafonkin; Copyright (c) 2010-2011, CloudMade. All rights reserved.

OpenRouteService: © openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors. OpenRouteService website.

AI usage: Claude Code was used to set up the Leaflet map and the database. ChatGPT (OpenAI) was used to assist with integrating the OpenRouteService Directions API with the Leaflet map and integrating the Supabase database.
