import base64
import copy
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
            "01 A 0001": "01A0001",
            "34 A 1234": "34A1234",
            "34 KM 4969": "34KM4969",
            "06-A-12345": "06A12345",
            "34 AB 123": "34AB123",
            "34 AB 1234": "34AB1234",
            "34 ABC 12": "34ABC12",
            "34 ABC 123": "34ABC123",
            "81 Z 9999": "81Z9999",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(app_module.normalize_turkish_plate(raw), expected)

        for invalid in (
            "00A1234",
            "82ABC123",
            "34ABC1234",
            "34A123",
            "34Q1234",
            "34AW123",
            "34ABX123",
            "34Ş1234",
            "34Aİ123",
            "34ABÇ123",
            "124ABC123",
            None,
        ):
            with self.subTest(invalid=invalid):
                self.assertIsNone(app_module.normalize_turkish_plate(invalid))

    def test_ocr_normalization_repairs_position_specific_confusions(self):
        cases = {
            "35 VEB OO1": "35VEB001",
            "35 VEB 00I": "35VEB001",
            "O6 A 12345": "06A12345",
            "O6 A Q23S5": "06A02355",
            "11 GJ 3238": "11GJ3238",
            "36A0Q348": "36A00348",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(
                    app_module.normalize_turkish_ocr_plate(raw),
                    expected,
                )

        for ambiguous_or_invalid in (
            "99 ABC 1234",
            "LL GJ 3238",
            "3 GJ 3235",
            "77G5Z33",
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
            for _ in range(21)
        ]

        self.assertEqual(statuses[:20], [400] * 20)
        self.assertEqual(statuses[20], 429)

    def test_returns_normalized_plate_from_structured_response(self):
        self.authenticate()
        fake_client = FakeGeminiClient(json.dumps({
            "plate": "34 KM 4969",
            "candidate_index": 0,
            "estimated": False,
        }))
        app_module.gemini_client = fake_client

        response = self.client.post(
            "/api/gemini-ocr",
            json={"image": make_image_data_url(declared_mime="image/png")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["plate"], "34KM4969")
        self.assertEqual(response.get_json()["candidate_index"], 0)
        self.assertFalse(response.get_json()["estimated"])
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
            "candidate_index": 3,
            "estimated": False,
        }))
        app_module.gemini_client = fake_client

        response = self.client.post(
            "/api/gemini-ocr",
            json={
                "images": [
                    make_image_data_url(),
                    make_image_data_url(),
                    make_image_data_url(),
                    make_image_data_url(),
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["plate"], "35VEB001")
        self.assertEqual(response.get_json()["candidate_index"], 3)
        call = fake_client.models.calls[0]
        self.assertEqual(len(call["contents"]), 5)

    def test_rejects_more_than_four_auto_crops(self):
        self.authenticate()
        app_module.gemini_client = FakeGeminiClient('{"plate":"34KM4969"}')

        response = self.client.post(
            "/api/gemini-ocr",
            json={"images": [make_image_data_url()] * 5},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("4", response.get_json()["message"])

    def test_returns_uncertain_visible_plate_as_estimated(self):
        self.authenticate()
        fake_client = FakeGeminiClient(json.dumps({
            "plate": "34 FEZ 963",
            "candidate_index": 0,
            "estimated": True,
        }))
        app_module.gemini_client = fake_client

        response = self.client.post(
            "/api/gemini-ocr",
            json={"image": make_image_data_url()},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["plate"], "34FEZ963")
        self.assertTrue(response.get_json()["estimated"])
        call = fake_client.models.calls[0]
        prompt = call["contents"][0]
        self.assertIn("best plausible valid reading", prompt)
        self.assertIn("do not return null solely because confidence is low", prompt)
        self.assertIn("estimated", call["config"].response_schema["properties"])

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


class RecordApiTests(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()
        self.active_trips_snapshot = {
            plate: dict(trip)
            for plate, trip in app_module.ACTIVE_TRIPS.items()
        }
        self.records_snapshot = [
            dict(record)
            for record in app_module.RECORDS_DB
        ]
        self.vehicles_snapshot = copy.deepcopy(app_module.VEHICLES_DB)

    def tearDown(self):
        app_module.ACTIVE_TRIPS.clear()
        app_module.ACTIVE_TRIPS.update(self.active_trips_snapshot)
        app_module.RECORDS_DB[:] = self.records_snapshot
        app_module.VEHICLES_DB.clear()
        app_module.VEHICLES_DB.update(self.vehicles_snapshot)

    def test_usage_purpose_catalog_is_rendered_in_form_and_filter(self):
        expected_purposes = (
            "Periyodik Bakım",
            "Kurum İçi Operasyonlar",
            "Diğer",
            "Müşteri Ziyareti",
            "Servis Amaçlı Kullanım",
            "Şahsi Kullanım",
            "Proje - Arıza - Bakım",
        )
        self.assertEqual(app_module.VEHICLE_USAGE_PURPOSES, expected_purposes)

        html = self.client.get("/").get_data(as_text=True)
        for purpose in expected_purposes:
            with self.subTest(purpose=purpose):
                self.assertEqual(html.count(f'value="{purpose}"'), 2)

    def test_vehicle_catalog_keeps_legacy_plates_and_adds_details(self):
        response = self.client.get("/api/plates")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(
            payload["plates"],
            ["34KM4969", "34EZS794"],
        )

        vehicles_by_plate = {
            vehicle["plate"]: vehicle
            for vehicle in payload["vehicles"]
        }
        renault = vehicles_by_plate["34EZS794"]
        self.assertEqual(renault["brand"], "RENAULT")
        self.assertEqual(renault["model"], "CLIO")
        self.assertEqual(renault["year"], 2016)
        self.assertEqual(renault["vehicle_name"], "RENAULT 2016 CLIO")
        self.assertEqual(renault["display_plate"], "34 EZS 794")
        self.assertEqual(
            renault["display_label"],
            "RENAULT 2016 CLIO - 34 EZS 794",
        )

    def test_vehicle_helpers_support_structured_and_legacy_entries(self):
        details = {
            "brand": "TOYOTA",
            "model": "COROLLA",
            "year": 2022,
        }
        original = dict(details)

        self.assertEqual(
            app_module.get_vehicle_name(details),
            "TOYOTA 2022 COROLLA",
        )
        self.assertEqual(
            app_module.get_vehicle_name("  Eski Araç Tanımı  "),
            "Eski Araç Tanımı",
        )
        self.assertEqual(
            app_module.get_vehicle_name(None),
            "Bilinmeyen Araç",
        )
        self.assertEqual(
            app_module.format_plate_for_display("34EZS794"),
            "34 EZS 794",
        )
        self.assertEqual(details, original)

        legacy = app_module.serialize_vehicle(
            "06A12345",
            "Legacy Vehicle",
        )
        self.assertEqual(legacy["vehicle_name"], "Legacy Vehicle")
        self.assertEqual(legacy["display_label"], "Legacy Vehicle - 06 A 12345")
        self.assertEqual(legacy["brand"], "")
        self.assertEqual(legacy["model"], "")
        self.assertIsNone(legacy["year"])

    def test_vehicle_details_are_rendered_in_mobile_flow(self):
        html = self.client.get("/").get_data(as_text=True)

        self.assertIn('id="selected-vehicle-info"', html)
        self.assertIn('id="ocr-vehicle-info"', html)
        self.assertIn(">Araç Bilgisi<", html)
        self.assertIn("/static/js/main.js?v=17", html)

    def test_registered_vehicle_name_is_saved_on_dropoff(self):
        plate = "34EZS794"
        app_module.ACTIVE_TRIPS.pop(plate, None)

        response = self.client.post(
            "/api/record",
            json={
                "plate": plate,
                "action": "dropoff",
                "action_type": "Diğer",
                "mileage": "151900",
                "user": "admin",
                "notes": "",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            app_module.RECORDS_DB[-1]["vehicle_name"],
            "RENAULT 2016 CLIO",
        )

    def test_legacy_vehicle_entry_still_works_in_api_and_recording(self):
        plate = "06A12345"
        app_module.VEHICLES_DB[plate] = "Legacy Vehicle"

        catalog = self.client.get("/api/plates").get_json()
        legacy_vehicle = next(
            vehicle
            for vehicle in catalog["vehicles"]
            if vehicle["plate"] == plate
        )
        self.assertEqual(legacy_vehicle["vehicle_name"], "Legacy Vehicle")

        response = self.client.post(
            "/api/record",
            json={
                "plate": plate,
                "action": "dropoff",
                "action_type": "Diğer",
                "mileage": "10",
                "user": "admin",
                "notes": "",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            app_module.RECORDS_DB[-1]["vehicle_name"],
            "Legacy Vehicle",
        )

    def test_optional_company_fields_survive_pickup_and_dropoff(self):
        plate = "34KM4969"
        pickup_response = self.client.post(
            "/api/record",
            json={
                "plate": plate,
                "action": "pickup",
                "action_type": "Servis Amaçlı Kullanım",
                "mileage": "100",
                "user": "admin",
                "request_no": "  TAL-2026-15  ",
                "service_form_no": "  SRV-88  ",
                "notes": "Servise gidiş",
            },
        )

        self.assertEqual(pickup_response.status_code, 201)
        self.assertEqual(
            app_module.ACTIVE_TRIPS[plate]["request_no"],
            "TAL-2026-15",
        )
        self.assertEqual(
            app_module.ACTIVE_TRIPS[plate]["service_form_no"],
            "SRV-88",
        )

        dropoff_response = self.client.post(
            "/api/record",
            json={
                "plate": plate,
                "action": "dropoff",
                "action_type": "Diğer",
                "mileage": "125",
                "user": "admin",
                "request_no": "DEĞİŞTİRİLMEMELİ",
                "service_form_no": "",
                "notes": "Teslim edildi",
            },
        )

        self.assertEqual(dropoff_response.status_code, 201)
        record = app_module.RECORDS_DB[-1]
        self.assertEqual(record["action_type"], "Servis Amaçlı Kullanım")
        self.assertEqual(record["request_no"], "TAL-2026-15")
        self.assertEqual(record["service_form_no"], "SRV-88")
        self.assertEqual(record["distance"], "25.0")

        recent_record = self.client.get(
            "/api/reports/recent"
        ).get_json()["records"][0]
        plate_record = self.client.get(
            f"/api/reports/plate/{plate}"
        ).get_json()["records"][0]
        self.assertEqual(recent_record["request_no"], "TAL-2026-15")
        self.assertEqual(plate_record["service_form_no"], "SRV-88")

    def test_company_fields_remain_optional_for_legacy_requests(self):
        plate = "02ABG585"
        response = self.client.post(
            "/api/record",
            json={
                "plate": plate,
                "action": "dropoff",
                "action_type": "Müşteri Teslimatı",
                "mileage": "240",
                "user": "admin",
                "notes": "",
            },
        )

        self.assertEqual(response.status_code, 201)
        record = app_module.RECORDS_DB[-1]
        self.assertEqual(record["action_type"], "Müşteri Teslimatı")
        self.assertEqual(record["request_no"], "")
        self.assertEqual(record["service_form_no"], "")

    def test_legacy_active_trip_can_receive_fields_at_dropoff(self):
        plate = "34EZS794"
        app_module.ACTIVE_TRIPS[plate] = {
            "start_mileage": "300",
            "start_date": "01.01.2026 08:00:00",
            "driver": "admin",
            "action_type": "Diğer",
            "notes": "",
        }

        response = self.client.post(
            "/api/record",
            json={
                "plate": plate,
                "action": "dropoff",
                "action_type": "Proje - Arıza - Bakım",
                "mileage": "315",
                "user": "admin",
                "request_no": "TAL-LEGACY",
                "service_form_no": None,
                "notes": "",
            },
        )

        self.assertEqual(response.status_code, 201)
        record = app_module.RECORDS_DB[-1]
        self.assertEqual(record["action_type"], "Proje - Arıza - Bakım")
        self.assertEqual(record["request_no"], "TAL-LEGACY")
        self.assertEqual(record["service_form_no"], "")


if __name__ == "__main__":
    unittest.main()
