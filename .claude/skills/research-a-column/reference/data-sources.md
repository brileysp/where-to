# Data sources that work (tested 28 Oct 2026)

Run Python with a folder of installed packages: `pip install --target <folder> duckdb numpy shapely`, then `PYTHONPATH=<folder>`. Set `PLACES_DIR` to the output folder of `scripts/dump-places-geo.ts`. Scripts in `scripts/` are working examples, not a framework: copy and adapt.

## OpenStreetMap through QLever (use this, not Overpass)
- Endpoint `https://qlever.dev/api/osm-planet` (the old qlever.cs.uni-freiburg.de address redirects). POST `query=<sparql>`, header `Accept: text/tab-separated-values`, send a User-Agent. Without a UA you get 406.
- Whole-planet tag exports finish in about a minute: e.g. all `mtb:scale` ways (1M rows) with centroid and length (`scripts/qlever/mtb.rq`), lifts, mtb routes, camp sites, golf courses, bike shops. Then do the place-by-place filtering locally with numpy (`geo.py`). Per-place distance queries inside SPARQL take about 45 s each, so avoid them.
- Prefixes: `osmkey:` is `https://www.openstreetmap.org/wiki/Key:`. Geometry: `geo:hasGeometry/geo:asWKT`, centroid and length via `geof:centroid`, `geof:latitude`, `geof:longitude`, `geof:metricLength`.
- The Overpass servers (overpass-api.de and mirrors) were down all day on 28 Oct 2026; the patient-retry worker never got one answer. Do not plan on them.

## Overture Maps through DuckDB
- Release path `s3://overturemaps-us-west-2/release/2026-10-21.0` (check for a newer release). `INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2'; INSTALL spatial; LOAD spatial`.
- `theme=places/type=place` has `names.primary`, `taxonomy.primary` (not `categories`), `confidence`, `bbox`. `theme=base/type=land_use` has `class` (golf_course, green, camp_site, caravan_site, downhill...) and polygons.
- Query with a bbox filter first, then the haversine distance, as in `overture_*_example.py`. About 5 to 30 s per place.
- Noise to expect: duplicates (merge within about 300 m to 1 km), practice ranges and shops, bike-share docking stations named like streets, names in non-Latin scripts, area `NaN` for some Japanese polygons.

## Other
- **Wikipedia API** (`action=query`, `prop=coordinates`): event pages such as "2012 PGA Championship" carry the venue coordinates (see `scripts/wikipedia_event_venues_example.py`). Use exact titles; link lists miss pages.
- **Wikidata SPARQL** for zoos, aquariums and similar classes.
- **GeoNames** `cities1000.zip` for towns of 1,000 or more.
- **Natural Earth** 10 m coastline (coarse: not good enough for a 500 m test).
- **Open-Meteo**: elevation (`api.open-meteo.com/v1/elevation`, 100 points per call), archive daily minimums (`archive-api.open-meteo.com`). It returns 429 if two jobs run at once; run one at a time. Grid elevation can be far above a valley.
- **RCDB** and the TEA water park ranking for Theme Parks.

## Hand research
`reference/law_research_example.py` shows the shape used for wild camping law and wildlife: per place a value, a confidence, the source URL and the quoted fact. Verify that each URL loads before citing it.
