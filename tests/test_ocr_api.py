import base64
import io
import json
import unittest
from types import SimpleNamespace

from PIL import Image

import app as app_module


def make_image_data_url(declared_mime="image/jpeg", size=(320, 120)):
    buffer = io.BytesIO()
    Image.new("RGB", size, "white").save(buffer, format="JPEG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:{declared_mime};base64,{encoded}"


class FakeModels:
    def __init__(self, response_text):
        self.response_text = response_text
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(text=self.response_text)


class FakeGeminiClient:
    def __init__(self, response_text):
        self.models = FakeModels(response_text)


class OcrApiTests(unittest.TestCase):
    def setUp(self):
        self.original_client = app_module.gemini_client
        app_module.app.config.update(
            TESTING=True,
            SESSION_COOKIE_SECURE=False,
            RATELIMIT_ENABLED=False,
        )
        app_module.limiter.reset()
        self.client = app_module.app.test_client()

    def tearDown(self):
        app_module.gemini_client = self.original_client

    def authenticate(self):
        with self.client.session_transaction() as session:
            session["user"] = "admin"

    def test_plate_normalization_accepts_supported_layouts(self):
        cases = {
            "34 KM 4969": "34KM4969",
            "06-A-12345": "06A12345",
            "34 ABC 12": "34ABC12",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(app_module.normalize_turkish_plate(raw), expected)

        for invalid in ("82ABC123", "34ABC1234", "34A123", None):
            with self.subTest(invalid=invalid):
                self.assertIsNone(app_module.normalize_turkish_plate(invalid))

    def test_ocr_normalization_repairs_position_specific_confusions(self):
        cases = {
            "35 VEB OO1": "35VEB001",
            "35 VEB 00I": "35VEB001",
            "O6 A 12345": "06A12345",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(
                    app_module.normalize_turkish_ocr_plate(raw),
                    expected,
                )

        for ambiguous_or_invalid in (
            "99 ABC 1234",
            "77G5Z33",
            "36A0Q348",
            "46C1S05",
        ):
            with self.subTest(ambiguous_or_invalid=ambiguous_or_invalid):
                self.assertIsNone(
                    app_module.normalize_turkish_ocr_plate(ambiguous_or_invalid)
                )

    def test_requires_an_authenticated_session(self):
        response = self.client.post(
            "/api/gemini-ocr",
            json={"image": make_image_data_url()},
        )
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.get_json()["success"])

    def test_missing_server_ocr_configuration_returns_fallback_signal(self):
        self.authenticate()
        app_module.gemini_client = None

        response = self.client.post(
            "/api/gemini-ocr",
            json={"image": make_image_data_url()},
        )

        self.assertEqual(response.status_code, 503)
        self.assertTrue(response.get_json()["fallback_available"])

    def test_rejects_non_image_payload(self):
        self.authenticate()
        app_module.gemini_client = FakeGeminiClient('{"plate":"34KM4969"}')
        encoded = base64.b64encode(b"not-an-image").decode("ascii")

        response = self.client.post(
            "/api/gemini-ocr",
            json={"image": f"data:image/jpeg;base64,{encoded}"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("doğrulanamadı", response.get_json()["message"])

    def test_ocr_route_rate_limit_returns_json(self):
        app_module.app.config["RATELIMIT_ENABLED"] = True
        with self.client.session_transaction() as session:
            session["user"] = "rate-limit-test-user"
        app_module.gemini_client = FakeGeminiClient('{"plate":"34KM4969"}')

        statuses = [
            self.client.post(
                "/api/gemini-ocr",
                json={"image": "not-a-data-url"},
            ).status_code
            for _ in range(6)
        ]

        self.assertEqual(statuses[:5], [400] * 5)
        self.assertEqual(statuses[5], 429)

    def test_returns_normalized_plate_from_structured_response(self):
        self.authenticate()
        fake_client = FakeGeminiClient(json.dumps({"plate": "34 KM 4969"}))
        app_module.gemini_client = fake_client

        response = self.client.post(
            "/api/gemini-ocr",
            json={"image": make_image_data_url(declared_mime="image/png")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["plate"], "34KM4969")
        self.assertEqual(response.get_json()["candidate_index"], 0)
        self.assertEqual(len(fake_client.models.calls), 1)
        call = fake_client.models.calls[0]
        self.assertEqual(call["model"], app_module.GEMINI_MODEL)
        image_part = call["contents"][1]
        self.assertEqual(image_part.inline_data.mime_type, "image/jpeg")
        self.assertGreater(len(image_part.inline_data.data), 100)
        self.assertEqual(
            call["config"].response_mime_type,
            "application/json",
        )

    def test_accepts_multiple_auto_crops_and_returns_selected_index(self):
        self.authenticate()
        fake_client = FakeGeminiClient(json.dumps({
            "plate": "35 VEB 001",
            "candidate_index": 1,
        }))
        app_module.gemini_client = fake_client

        response = self.client.post(
            "/api/gemini-ocr",
            json={
                "images": [
                    make_image_data_url(),
                    make_image_data_url(),
                    make_image_data_url(),
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["plate"], "35VEB001")
        self.assertEqual(response.get_json()["candidate_index"], 1)
        call = fake_client.models.calls[0]
        self.assertEqual(len(call["contents"]), 4)

    def test_rejects_more_than_three_auto_crops(self):
        self.authenticate()
        app_module.gemini_client = FakeGeminiClient('{"plate":"34KM4969"}')

        response = self.client.post(
            "/api/gemini-ocr",
            json={"images": [make_image_data_url()] * 4},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("3", response.get_json()["message"])

    def test_rejects_excessive_total_crop_resolution(self):
        self.authenticate()
        app_module.gemini_client = FakeGeminiClient(
            '{"plate":"34KM4969","candidate_index":0}'
        )

        response = self.client.post(
            "/api/gemini-ocr",
            json={
                "images": [
                    make_image_data_url(size=(3000, 3000)),
                    make_image_data_url(size=(3000, 3000)),
                    make_image_data_url(size=(3000, 3000)),
                ],
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("çözünürlüğü", response.get_json()["message"])

    def test_rejects_invalid_candidate_index_for_multiple_crops(self):
        self.authenticate()
        app_module.gemini_client = FakeGeminiClient(
            '{"plate":"35VEB001","candidate_index":4}'
        )

        response = self.client.post(
            "/api/gemini-ocr",
            json={"images": [make_image_data_url(), make_image_data_url()]},
        )

        self.assertEqual(response.status_code, 502)
        self.assertTrue(response.get_json()["fallback_available"])

    def test_invalid_model_plate_triggers_local_fallback(self):
        self.authenticate()
        app_module.gemini_client = FakeGeminiClient('{"plate":"99ABC1234"}')

        response = self.client.post(
            "/api/gemini-ocr",
            json={"image": make_image_data_url()},
        )

        self.assertEqual(response.status_code, 422)
        self.assertTrue(response.get_json()["fallback_available"])

    def test_unregistered_ocr_plate_can_continue_to_record_flow(self):
        plate = "02ABG585"
        app_module.ACTIVE_TRIPS.pop(plate, None)

        try:
            response = self.client.post(
                "/api/record",
                json={
                    "plate": plate,
                    "action": "pickup",
                    "action_type": "Diğer",
                    "mileage": "100",
                    "user": "admin",
                    "notes": "",
                },
            )

            self.assertEqual(response.status_code, 201)
            self.assertTrue(response.get_json()["success"])
            self.assertIn(plate, app_module.ACTIVE_TRIPS)
        finally:
            app_module.ACTIVE_TRIPS.pop(plate, None)


if __name__ == "__main__":
    unittest.main()
