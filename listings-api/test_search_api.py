"""HTTP search regressions against the 12 supplied MLS listings."""
import json
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from urllib.parse import urlencode

from server import Handler


class SearchApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.port = httpd.server_port
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        cls.addClassCleanup(httpd.server_close)
        cls.addClassCleanup(thread.join)
        cls.addClassCleanup(httpd.shutdown)

    def search(self, **params):
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            conn.request("GET", "/api/listings?" + urlencode(params))
            response = conn.getresponse()
            self.assertEqual(response.status, 200)
            return json.load(response)
        finally:
            conn.close()

    def assert_count(self, expected, **params):
        result = self.search(**params)
        self.assertEqual(result["total"], expected)
        self.assertEqual(len(result["items"]), expected)
        return [row["id"] for row in result["items"]]

    def test_keyword_counts(self):
        cases = [
            ("", 12), ("   ", 12), ("observatory", 0),
            ("garage", 1), ("community pool", 1), ("schools", 2),
            ("BUS", 3), ("metro", 3), ("public transport", 3),
            ("garden", 2), ("apartment", 2), ("tranquil", 2),
        ]
        for term, expected in cases:
            with self.subTest(term=term):
                self.assert_count(expected, q=term)

    def test_pet_policy(self):
        # B11 mentions restrictions but has no explicit prohibition.
        positive = {"A1", "B7", "A4", "A6", "B11"}
        prohibited = {"A3", "B9", "A5", "A7"}
        for term, expected in [
            ("pets", positive), ("pet", positive), ("no pets", prohibited),
            ("No Pets Allowed", prohibited), ("Pets Not Allowed", prohibited),
            ("pets not permitted", prohibited),
        ]:
            with self.subTest(term=term):
                self.assertCountEqual(self.assert_count(len(expected), q=term), expected)

    def test_combined_filters(self):
        cases = [
            ({"q": "bus", "city": "vienna"}, {"A5", "B11"}),
            ({"q": "pets", "city": "Fairfax"}, set()),
            ({"q": "pets", "minBedrooms": 4}, {"A4"}),
            ({"q": "garden", "city": "Springfield", "minBedrooms": 3,
              "minPrice": 525000, "maxPrice": 525000}, {"A2"}),
            ({"q": "bus", "maxPrice": 449999}, set()),
        ]
        for params, expected in cases:
            with self.subTest(params=params):
                self.assertCountEqual(self.assert_count(len(expected), **params), expected)


if __name__ == "__main__":
    unittest.main()
