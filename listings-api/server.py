"""Local property listing API. Run with Python 3.9 or newer."""
import json
import math
import re
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROWS = json.loads(Path(__file__).with_name("listings.json").read_text(encoding="utf-8-sig"))
# Map related phrases into shared concepts before computing TF-IDF similarity.
CONCEPTS = {
    "pet": ["pet", "pets"],
    "transit": ["light rail", "public transit", "public transport", "train", "transit", "bus", "buses", "metro"],
    "workspace": ["home office", "work from home", "remote work", "dedicated workspace", "studio", "office"],
    "garden": ["garden", "gardening", "planting beds", "yard", "backyard"],
    "terrace": ["outdoor seating", "patio", "balcony", "deck", "porch"],
    "accessible": ["step-free", "accessible", "single-level", "wheelchair"],
    "trails": ["hiking", "walking trails", "trails", "trail"],
    "condo": ["condominium", "condo", "apartment", "loft"],
    "quiet": ["peaceful", "quiet", "tranquil"],
}
STOP = set("a an and are by for from home homes house houses i in is me near of on or property properties show the to want with".split())


def vector(value):
    words = Counter(w for w in re.findall(r"[a-z0-9]+", value.lower()) if w not in STOP)
    for concept, phrases in CONCEPTS.items():
        if any(re.search(r"\b" + re.escape(p) + r"\b", value.lower()) for p in phrases):
            words["concept_" + concept] = 2
    return words


# Match the subject immediately before or after a denial. Prefer known phrases
# so "without public transport" also applies to a search for "bus".
PHRASES = sorted({p for group in CONCEPTS.values() for p in group}, key=len, reverse=True)
SUBJECT = "(?:" + "|".join(re.escape(p) for p in PHRASES) + r"|[a-z0-9]+)"
DENIED = re.compile(
    rf"\b(?:no|without|not)\s+(?:(?:a|an|any|fenced|private|attached)\s+)*"
    rf"(?P<after>{SUBJECT})\b(?!\s+(?:fees?|restrictions?|deposits?|limits?)\b)"
    rf"|\b(?P<before>{SUBJECT})\s+(?:(?:are|is)\s+)?"
    r"(?:not\s+(?:allowed|permitted|available|included|welcome)|prohibited|forbidden)\b",
    re.IGNORECASE,
)


def denied_terms(text):
    terms = set()
    for match in DENIED.finditer(text):
        subject = vector(match.group("after") or match.group("before"))
        concepts = {key for key in subject if key.startswith("concept_")}
        terms.update(concepts or subject.keys())
    return terms


DENIALS = {r["id"]: denied_terms(r["description"]) for r in ROWS}
DOCS = {r["id"]: vector(" ".join(map(str, r.values()))) for r in ROWS}
DF = Counter(term for doc in DOCS.values() for term in doc)


def weight(term):
    return 1 + math.log((1 + len(ROWS)) / (1 + DF[term]))


def similarity(query, doc):
    dot = sum(n * doc[t] * weight(t) ** 2 for t, n in query.items())
    norm = lambda v: math.sqrt(sum((n * weight(t)) ** 2 for t, n in v.items()))
    return dot / (norm(query) * norm(doc)) if dot else 0


def search(params):
    unknown = params.keys() - {"minPrice", "maxPrice", "minBedrooms", "city", "q"}
    if unknown:
        raise ValueError("Unknown filter " + sorted(unknown)[0])

    def price(key, default):
        if key not in params:
            return default
        value = float(params[key])
        if not math.isfinite(value) or value < 0:
            raise ValueError(f"{key} must be a finite, nonnegative number.")
        return value

    minimum = price("minPrice", 0)
    maximum = price("maxPrice", math.inf)
    if minimum > maximum:
        raise ValueError("Minimum price must be at or below maximum price.")
    bedrooms = int(params.get("minBedrooms", "0"))
    if bedrooms < 0:
        raise ValueError("Minimum bedrooms must be a nonnegative integer.")
    city = params.get("city", "").casefold()
    rows = [r for r in ROWS if minimum <= r["price"] <= maximum
            and r["bedrooms"] >= bedrooms and city in r["city"].casefold()]
    if params.get("q", "").strip():
        query = vector(params["q"])
        required_denials = denied_terms(params["q"])
        positive_terms = query.keys() - required_denials
        rows = [r for r in rows if required_denials <= DENIALS[r["id"]]
                and positive_terms.isdisjoint(DENIALS[r["id"]])]
        scored = [(similarity(query, DOCS[r["id"]]), r) for r in rows]
        scored.sort(key=lambda pair: (pair[0], pair[1]["listedDate"]), reverse=True)
        return [{**r, "relevanceScore": score} for score, r in scored if score > 0]
    return sorted(rows, key=lambda r: r["listedDate"], reverse=True)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        try:
            if url.path == "/api/listings":
                items = search({k: v[-1].strip() for k, v in parse_qs(url.query, max_num_fields=50).items()})
                status, body = 200, {"items": items, "total": len(items)}
            elif url.path == "/api/health":
                status, body = 200, {"status": "ok"}
            else:
                status, body = 404, {"error": "Route not found."}
        except ValueError as error:
            status, body = 400, {"error": str(error)}
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    print("Listing API listening on http://127.0.0.1:8000", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()

