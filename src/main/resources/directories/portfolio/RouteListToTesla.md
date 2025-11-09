title: RouteListToTesla
type: Fleet Automation
year: 2025
technologies: Java 21, Spring Boot 3.5.5, Tesseract 5.5.1, Google Geocoding API, Tesla Fleet API, Teslemetry API, Thymeleaf, Maven, Apache HttpClient 5, OAuth2

# RouteListToTesla

## From Paper Route Lists to Tesla Waypoints

RouteListToTesla is a Spring Boot service that transforms screenshotted route lists into Tesla-ready navigation instructions. Drivers snap their 1..N route images, the app extracts addresses with Tesseract, auto-fixes formatting issues, geocodes each stop, lets the driver edit the list in groups of eight, and finally pushes the confirmed waypoints straight to the vehicle via the Tesla Fleet / Teslemetry APIs.

## Why It Matters
- Eliminates manual typing of 8-waypoint batches inside the car UI.
- Cuts OCR → navigation turnaround from ~15 minutes to ~90 seconds.
- Preserves accuracy by letting humans review/adjust addresses before sending.
- Gives fleet operators a cache they can share across devices so repeat routes resolve instantly.

## Workflow Snapshot
1. Browser computes SHA-256 for every dropped screenshot.
2. `/route/cache/check` skips any hash already processed server-side.
3. Cache misses are uploaded to `/route/places` with an optional `defaultState=MI` (covers routes that omit the state).
4. `AddressOcrService` upscales, grayscales, sharpens, thresholds, and runs ByteDeco Tesseract 5.5.1 on sparse-text mode.
5. `AddressExtractor` merges overlapping HOCR boxes, repairs concatenated street types (e.g., `CODERD → CODE RD`), and appends the default state where needed.
6. `GeocodingClient` calls Google Geocoding with US bias and returns `lat/lon/place_id` tuples.
7. The UI groups the unique candidates into editable rows of eight; edits trigger re-geocoding for missing coordinates.
8. `/route/send/{vin}` or `/route/places/{vin}` streams those waypoints to Tesla Fleet, respecting the platform’s 8-stop limit and waiting for acknowledgement.
9. Successful responses are written to `cache/images/<hash>.json` for future reuse.

## Architecture
```
React/Thymeleaf UI → SHA-256 cache probe
        ↓ (cache miss)
Spring Boot API (RouteController)
        ↓
AddressOcrService → AddressExtractor → GeocodingClient
        ↓
ImageCacheService (JSON files under cache/)
        ↓
FleetApi (Tesla Fleet + Teslemetry)
        ↓
Tesla vehicle navigation
```

### Feature Highlights
- **Multi-stage OCR:** Upscaling, grayscale, unsharp masking, binary thresholding, and sparse-text page segmentation squeeze legible addresses out of noisy smartphone captures.
- **Default state enrichment:** Dispatch sheets often list only street + city. Passing `defaultState` keeps locations unambiguous without forcing drivers to retype.
- **Deterministic caching:** Image hash + filename act as the cache key. Cached entries include the final geocoded payload so identical screenshots skip both OCR and Google API billing.
- **Review-first UX:** Addresses render in a dynamic grid of eight cards (matching Tesla’s waypoint limit). Drivers can edit, reorder, add, or remove rows before pushing.
- **Tesla integration:** Uses the newer `commandNavigationWaypointsRequest`, automatically joins all place IDs into the expected `refId:` string, and falls back to the legacy GPS endpoint if needed.
- **OAuth + allow list:** Google OAuth2 login plus an environment-based allow list prevents unauthorized command access. Tokens never touch disk.

## Key Implementation Notes
- **Language Packs:** Ships with `eng.traineddata` but can load additional tessdata bundles via `TESSDATA_PREFIX` when deploying to other regions.
- **Rate limiting:** Google Geocoding calls are paced at ~60ms between requests. The cache dramatically reduces QPS during peak shifts.
- **Ordering guarantees:** `LinkedHashMap` preserves the first occurrence of every normalized address so the Tesla route follows the paper order.
- **Testing:** `AddressOcrServiceTest`, `AddressOcrIntegrationTest`, and `AddressExtractorTest` cover OCR heuristics, ensuring regressions are caught when tuning image filters.

## Sample API Call
```bash
curl -X POST "https://routelisttotesla.example.com/route/places" \
  -H "Authorization: Bearer <google-oauth-cookie>" \
  -F images=@/tmp/route-a.png \
  -F images=@/tmp/route-b.png \
  -F defaultState=MI
```
Response excerpt:
```json
{
  "candidates": [
    {
      "text": "25789 CODE RD, SOUTHFIELD MI",
      "normalized": "25789 code rd southfield mi",
      "lat": 42.47799,
      "lon": -83.26592,
      "pid": "ChIJvYjq2c63JIgR41fNWmWCBc8"
    }
  ]
}
```

## Security & Privacy
- Google OAuth only; no password storage.
- One-line allow list via env vars (add more `allowed.userX` entries for teams).
- Tesla/Teslemetry API keys live exclusively in environment variables and are never logged.
- `cache/` is git-ignored so production data never leaks into the repo.

## Results
- 10x faster route loading—drivers now spend time driving instead of copying addresses.
- Cache hit rates above 70% on recurring delivery routes, saving both OCR cycles and Google Geocoding quota.
- Operators can run the tool on laptops, tablets, or kiosk PCs without reconfiguration thanks to OAuth + allow list auth.

## Status
- **State:** Active, private use.
- **Role:** Full-stack design + implementation (OCR pipeline, cache, Tesla integration, UI flow).
- **Next Up:** Multi-language OCR packs, Redis cache for multi-instance deployments, and direct mobile UI.
- **Reach Goal** Monetize, per image tokenization cost. User would have to provide Tesla OAuth login (in place of teslemetry, which would be too many steps for a simple user)

[Github](https://github.com/javaDevJT/RouteListToTesla)