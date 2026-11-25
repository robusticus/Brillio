# Listings API

Run `python server.py` with Python 3.9+. The local server reads fictional records from listings.json on startup. Prices are in USD and listedDate is the date the listing went live.

GET /api/health checks availability. GET /api/listings returns an object with items and total. Add q for relevance-ranked text search. The offline ranker combines real-estate synonyms and TF-IDF cosine similarity. Its vocabulary is defined in server.py.

Combine q with minPrice and maxPrice (inclusive USD bounds), minBedrooms (inclusive whole-number minimum), and city (case-insensitive substring).

Example: http://127.0.0.1:8000/api/listings?city=Springfield&minBedrooms=3&q=yard

## Search tests

Run `python -m unittest discover -v` from this directory. The suite starts a temporary HTTP server on a free local port. Expected counts use the 12 supplied records in listings.json.
