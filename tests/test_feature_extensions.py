import codecs
from datetime import datetime, timedelta
import os
import unittest


# app.py initializes its database while it is imported. Keep the feature tests
# isolated from a developer database and from the database used by Render.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

import app as app_module
from models import ActiveTrip, Driver, MovementRecord, Vehicle, db


def reset_database():
    with app_module.app.app_context():
        db.session.remove()
        db.drop_all()
        app_module.initialize_database()


class FeatureExtensionApiTests(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(
            TESTING=True,
            SESSION_COOKIE_SECURE=False,
            RATELIMIT_ENABLED=False,
        )
        reset_database()
        app_module.limiter.reset()
        self.client = app_module.app.test_client()

    def tearDown(self):
        with app_module.app.app_context():
            db.session.remove()

    def authenticate(self, username="admin"):
        with self.client.session_transaction() as session:
            session["user"] = username

    def create_vehicle(
        self,
        *,
        plate="06TST123",
        current_mileage=None,
        brand_name="TEST MARKA",
        model_name="TEST MODEL",
    ):
        brand_response = self.client.post(
            "/api/brands",
            json={"name": brand_name},
        )
        self.assertEqual(brand_response.status_code, 201)
        brand = brand_response.get_json()["brand"]

        model_response = self.client.post(
            "/api/models",
            json={"brand_id": brand["id"], "name": model_name},
        )
        self.assertEqual(model_response.status_code, 201)
        vehicle_model = model_response.get_json()["model"]

        payload = {
            "plate": plate,
            "model_id": vehicle_model["id"],
            "year": 2026,
        }
        if current_mileage is not None:
            payload["current_mileage"] = current_mileage
        vehicle_response = self.client.post("/api/vehicles", json=payload)
        self.assertEqual(vehicle_response.status_code, 201)
        vehicle = vehicle_response.get_json()["vehicle"]
        return brand, vehicle_model, vehicle

    def create_driver(
        self,
        *,
        employee_no="DRV-001",
        full_name="Ayşe Yılmaz",
    ):
        response = self.client.post(
            "/api/drivers",
            json={
                "employee_no": employee_no,
                "full_name": full_name,
                "department": "Saha Operasyon",
                "phone": "0555 000 00 00",
                "license_class": "B",
                "license_expiry_date": "2030-12-31",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()["driver"]

    def record(
        self,
        *,
        plate,
        action,
        mileage,
        action_type="Diğer",
        driver_id=None,
        request_no="",
        service_form_no="",
    ):
        payload = {
            "plate": plate,
            "action": action,
            "action_type": action_type,
            "mileage": mileage,
            "user": "Test Kullanıcısı",
            "request_no": request_no,
            "service_form_no": service_form_no,
        }
        if driver_id is not None:
            payload["driver_id"] = driver_id
        return self.client.post("/api/record", json=payload)

    def test_driver_auth_crud_duplicate_and_active_trip_inactivation_guard(self):
        self.assertEqual(self.client.get("/api/drivers").status_code, 401)

        self.authenticate("kullanici")
        self.assertEqual(self.client.get("/api/drivers").status_code, 200)
        self.assertEqual(
            self.client.post(
                "/api/drivers",
                json={"full_name": "Yetkisiz Sürücü"},
            ).status_code,
            403,
        )

        self.authenticate()
        driver = self.create_driver(
            employee_no="  drv-001  ",
            full_name="  Ayşe   Yılmaz  ",
        )
        self.assertEqual(driver["employee_no"], "DRV-001")
        self.assertEqual(driver["full_name"], "Ayşe Yılmaz")
        self.assertEqual(driver["department"], "Saha Operasyon")
        self.assertEqual(driver["license_class"], "B")
        self.assertEqual(driver["license_expiry_date"], "2030-12-31")
        self.assertEqual(driver["display_label"], "Ayşe Yılmaz (DRV-001)")

        duplicate = self.client.post(
            "/api/drivers",
            json={
                "employee_no": "drv-001",
                "full_name": "Başka Sürücü",
            },
        )
        self.assertEqual(duplicate.status_code, 409)

        updated = self.client.patch(
            f"/api/drivers/{driver['id']}",
            json={
                "full_name": "Ayşe Demir",
                "department": "Teknik Operasyon",
                "phone": "0555 111 22 33",
            },
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(
            updated.get_json()["driver"]["department"],
            "Teknik Operasyon",
        )

        _, _, vehicle = self.create_vehicle(current_mileage="10.000")
        pickup = self.record(
            plate=vehicle["plate"],
            action="pickup",
            mileage="10.100",
            driver_id=driver["id"],
        )
        self.assertEqual(pickup.status_code, 201)

        active_trip = self.client.get("/api/active-trips").get_json()["items"][0]
        self.assertEqual(active_trip["driver_id"], driver["id"])
        self.assertEqual(active_trip["driver"], "Ayşe Demir")
        self.assertEqual(active_trip["created_by"], "admin")

        guarded = self.client.patch(
            f"/api/drivers/{driver['id']}",
            json={"active": False},
        )
        self.assertEqual(guarded.status_code, 409)

        dropoff = self.record(
            plate=vehicle["plate"],
            action="dropoff",
            mileage="10.125",
        )
        self.assertEqual(dropoff.status_code, 201)

        deactivated = self.client.patch(
            f"/api/drivers/{driver['id']}",
            json={"active": False},
        )
        self.assertEqual(deactivated.status_code, 200)
        self.assertFalse(deactivated.get_json()["driver"]["active"])

        active_ids = {
            item["id"]
            for item in self.client.get("/api/drivers").get_json()["drivers"]
        }
        self.assertNotIn(driver["id"], active_ids)
        all_drivers = self.client.get(
            "/api/drivers?include_inactive=true"
        ).get_json()["drivers"]
        self.assertIn(driver["id"], {item["id"] for item in all_drivers})

    def test_movement_type_required_flags_are_exposed_and_enforced(self):
        self.authenticate()
        _, _, vehicle = self.create_vehicle(current_mileage=5000)
        create_response = self.client.post(
            "/api/movement-types",
            json={
                "name": "Saha Görevi",
                "description": "Talep ve servis formu zorunlu test türü",
                "requires_request_no": True,
                "requires_service_form_no": True,
                "sort_order": 99,
            },
        )
        self.assertEqual(create_response.status_code, 201)
        movement_type = create_response.get_json()["movement_type"]
        self.assertTrue(movement_type["requires_request_no"])
        self.assertTrue(movement_type["requires_service_form_no"])

        listed_types = self.client.get(
            "/api/movement-types"
        ).get_json()["movement_types"]
        listed = next(
            item for item in listed_types if item["id"] == movement_type["id"]
        )
        self.assertTrue(listed["requires_request_no"])
        self.assertTrue(listed["requires_service_form_no"])

        missing_both = self.record(
            plate=vehicle["plate"],
            action="pickup",
            action_type=movement_type["name"],
            mileage=5100,
        )
        self.assertEqual(missing_both.status_code, 400)
        self.assertIn("Talep No", missing_both.get_json()["message"])

        missing_service = self.record(
            plate=vehicle["plate"],
            action="pickup",
            action_type=movement_type["name"],
            mileage=5100,
            request_no="TAL-100",
        )
        self.assertEqual(missing_service.status_code, 400)
        self.assertIn("Servis Formu", missing_service.get_json()["message"])

        valid = self.record(
            plate=vehicle["plate"],
            action="pickup",
            action_type=movement_type["name"],
            mileage=5100,
            request_no="TAL-100",
            service_form_no="SRV-200",
        )
        self.assertEqual(valid.status_code, 201)

        changed = self.client.patch(
            f"/api/movement-types/{movement_type['id']}",
            json={
                "requires_request_no": False,
                "requires_service_form_no": True,
            },
        )
        self.assertEqual(changed.status_code, 200)
        changed_type = changed.get_json()["movement_type"]
        self.assertFalse(changed_type["requires_request_no"])
        self.assertTrue(changed_type["requires_service_form_no"])

        renamed = self.client.patch(
            f"/api/movement-types/{movement_type['id']}",
            json={"name": "Saha Görevi Güncel"},
        )
        self.assertEqual(renamed.status_code, 200)
        completed_after_rename = self.record(
            plate=vehicle["plate"],
            action="dropoff",
            mileage=5150,
        )
        self.assertEqual(completed_after_rename.status_code, 201)
        renamed_record = self.client.get(
            f"/api/reports/plate/{vehicle['plate']}"
        ).get_json()["records"][0]
        self.assertEqual(renamed_record["action_type"], "Saha Görevi")

    def test_vehicle_current_mileage_and_trip_km_are_monotonic(self):
        self.authenticate()
        _, _, vehicle = self.create_vehicle(current_mileage="12.345")
        self.assertEqual(vehicle["current_mileage"], 12345)

        lower_update = self.client.patch(
            f"/api/vehicles/{vehicle['id']}",
            json={"current_mileage": "12.300"},
        )
        self.assertEqual(lower_update.status_code, 400)

        higher_update = self.client.patch(
            f"/api/vehicles/{vehicle['id']}",
            json={"current_mileage": "12 500"},
        )
        self.assertEqual(higher_update.status_code, 200)
        self.assertEqual(
            higher_update.get_json()["vehicle"]["current_mileage"],
            12500,
        )
        cleared_update = self.client.patch(
            f"/api/vehicles/{vehicle['id']}",
            json={"current_mileage": ""},
        )
        self.assertEqual(cleared_update.status_code, 400)
        self.assertIn("silinemez", cleared_update.get_json()["message"])

        below_known = self.record(
            plate=vehicle["plate"],
            action="pickup",
            mileage="12.499",
        )
        self.assertEqual(below_known.status_code, 400)

        pickup = self.record(
            plate=vehicle["plate"],
            action="pickup",
            mileage="12.600",
        )
        self.assertEqual(pickup.status_code, 201)
        active_items = self.client.get("/api/active-trips").get_json()["items"]
        self.assertEqual(active_items[0]["start_mileage"], "12600")

        below_start = self.record(
            plate=vehicle["plate"],
            action="dropoff",
            mileage="12.599",
        )
        self.assertEqual(below_start.status_code, 400)
        self.assertEqual(
            self.client.get("/api/active-trips").get_json()["counts"]["active"],
            1,
        )

        dropoff = self.record(
            plate=vehicle["plate"],
            action="dropoff",
            mileage="12,650",
        )
        self.assertEqual(dropoff.status_code, 201)
        self.assertEqual(
            self.client.get("/api/active-trips").get_json()["counts"]["active"],
            0,
        )

        vehicles = self.client.get("/api/vehicles").get_json()["vehicles"]
        persisted_vehicle = next(
            item for item in vehicles if item["id"] == vehicle["id"]
        )
        self.assertEqual(persisted_vehicle["current_mileage"], 12650)

        records = self.client.get(
            f"/api/reports/plate/{vehicle['plate']}"
        ).get_json()["records"]
        self.assertEqual(records[0]["start_mileage"], "12600")
        self.assertEqual(records[0]["end_mileage"], "12650")
        self.assertEqual(records[0]["distance"], "50")

        duplicate_dropoff = self.record(
            plate=vehicle["plate"],
            action="dropoff",
            mileage="12.650",
        )
        self.assertEqual(duplicate_dropoff.status_code, 409)

        invalid_decimal = self.record(
            plate=vehicle["plate"],
            action="dropoff",
            mileage="12.65",
        )
        self.assertEqual(invalid_decimal.status_code, 400)

    def test_new_vehicle_links_existing_plate_history_and_mileage(self):
        self.authenticate()
        plate = "07HST123"
        completed = self.record(
            plate=plate,
            action="dropoff",
            mileage="54.321",
        )
        self.assertEqual(completed.status_code, 201)
        pickup = self.record(
            plate=plate,
            action="pickup",
            mileage="54.400",
        )
        self.assertEqual(pickup.status_code, 201)

        _, _, vehicle = self.create_vehicle(
            plate=plate,
            current_mileage=100,
            brand_name="GEÇMİŞ TEST",
            model_name="BAĞLANTI",
        )
        self.assertEqual(vehicle["current_mileage"], 54400)

        with app_module.app.app_context():
            record = db.session.scalar(
                db.select(MovementRecord).where(MovementRecord.plate == plate)
            )
            active_trip = db.session.scalar(
                db.select(ActiveTrip).where(ActiveTrip.plate == plate)
            )
            self.assertEqual(record.vehicle_id, vehicle["id"])
            self.assertEqual(active_trip.vehicle_id, vehicle["id"])
            self.assertEqual(record.vehicle_name, "GEÇMİŞ TEST 2026 BAĞLANTI")
            self.assertEqual(
                active_trip.vehicle_name,
                "GEÇMİŞ TEST 2026 BAĞLANTI",
            )

    def test_reminder_crud_status_thresholds_completion_and_visibility(self):
        self.assertEqual(
            self.client.get("/api/maintenance-reminders").status_code,
            401,
        )
        self.authenticate("kullanici")
        self.assertEqual(
            self.client.post(
                "/api/maintenance-reminders",
                json={"title": "Yetkisiz"},
            ).status_code,
            403,
        )

        self.authenticate()
        _, _, vehicle = self.create_vehicle(current_mileage="10.000")
        missing_target = self.client.post(
            "/api/maintenance-reminders",
            json={
                "vehicle_id": vehicle["id"],
                "reminder_type": "Bakım",
                "title": "Hedefsiz kayıt",
            },
        )
        self.assertEqual(missing_target.status_code, 400)

        today = datetime.now(app_module.APP_TIMEZONE).date()
        reminder_payloads = (
            {
                "reminder_type": "Muayene",
                "title": "Gecikmiş muayene",
                "due_date": (today - timedelta(days=1)).isoformat(),
            },
            {
                "reminder_type": "Bakım",
                "title": "Yaklaşan KM bakımı",
                "due_mileage": "11.000",
            },
            {
                "reminder_type": "Sigorta",
                "title": "Planlanan sigorta",
                "due_date": (today + timedelta(days=31)).isoformat(),
            },
        )
        created = []
        for payload in reminder_payloads:
            response = self.client.post(
                "/api/maintenance-reminders",
                json={"vehicle_id": vehicle["id"], **payload},
            )
            self.assertEqual(response.status_code, 201)
            created.append(response.get_json()["reminder"])

        self.assertEqual(
            [item["status_key"] for item in created],
            ["overdue", "due_soon", "upcoming"],
        )
        response_payload = self.client.get(
            "/api/maintenance-reminders"
        ).get_json()
        self.assertEqual(response_payload["counts"]["total"], 3)
        self.assertEqual(response_payload["counts"]["overdue"], 1)
        self.assertEqual(response_payload["counts"]["due_soon"], 1)
        self.assertEqual(response_payload["counts"]["upcoming"], 1)
        self.assertEqual(
            response_payload["thresholds"],
            {"upcoming_days": 30, "upcoming_mileage": 1000},
        )

        upcoming_only = self.client.get(
            "/api/maintenance-reminders?status=due_soon"
        ).get_json()["items"]
        self.assertEqual([item["id"] for item in upcoming_only], [created[1]["id"]])

        completed = self.client.patch(
            f"/api/maintenance-reminders/{created[1]['id']}",
            json={"completed": True},
        )
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(
            completed.get_json()["reminder"]["status_key"],
            "completed",
        )
        self.assertTrue(completed.get_json()["reminder"]["completed_at"])

        deactivated = self.client.patch(
            f"/api/maintenance-reminders/{created[0]['id']}",
            json={"active": False},
        )
        self.assertEqual(deactivated.status_code, 200)
        self.assertEqual(
            deactivated.get_json()["reminder"]["status_key"],
            "inactive",
        )

        default_items = self.client.get(
            "/api/maintenance-reminders"
        ).get_json()["items"]
        self.assertNotIn(
            created[0]["id"],
            {item["id"] for item in default_items},
        )
        all_payload = self.client.get(
            "/api/maintenance-reminders?include_inactive=true"
        ).get_json()
        self.assertEqual(all_payload["counts"]["total"], 3)
        self.assertEqual(all_payload["counts"]["inactive"], 1)
        self.assertEqual(all_payload["counts"]["completed"], 1)

    def test_advanced_report_auth_and_multifield_filters(self):
        self.assertEqual(
            self.client.get("/api/reports/advanced").status_code,
            401,
        )
        self.assertEqual(
            self.client.get("/api/reports/export?format=csv").status_code,
            401,
        )

        self.authenticate()
        brand, vehicle_model, vehicle = self.create_vehicle(
            current_mileage=2000,
        )
        driver = self.create_driver(
            employee_no="RPR-001",
            full_name="Rapor Sürücüsü",
        )
        action_type = "Rapor Testi"
        movement_type_response = self.client.post(
            "/api/movement-types",
            json={
                "name": action_type,
                "description": "Rapor filtre testi",
            },
        )
        self.assertEqual(movement_type_response.status_code, 201)
        pickup = self.record(
            plate=vehicle["plate"],
            action="pickup",
            action_type=action_type,
            mileage=2100,
            driver_id=driver["id"],
        )
        self.assertEqual(pickup.status_code, 201)

        filter_query = (
            f"vehicle_id={vehicle['id']}"
            f"&driver_id={driver['id']}"
            f"&brand_id={brand['id']}"
            f"&model_id={vehicle_model['id']}"
            f"&action_type={action_type.replace(' ', '+')}"
        )
        active_response = self.client.get(
            f"/api/reports/advanced?status=active&{filter_query}"
        )
        self.assertEqual(active_response.status_code, 200)
        active_payload = active_response.get_json()
        self.assertEqual(active_payload["counts"], {
            "total": 1,
            "completed": 0,
            "active": 1,
        })
        self.assertEqual(active_payload["total_distance"], 0)
        self.assertEqual(active_payload["records"][0]["status_key"], "active")
        self.assertEqual(active_payload["records"][0]["driver_id"], driver["id"])

        dropoff = self.record(
            plate=vehicle["plate"],
            action="dropoff",
            action_type=action_type,
            mileage=2150,
        )
        self.assertEqual(dropoff.status_code, 201)

        completed_response = self.client.get(
            f"/api/reports/advanced?status=completed&{filter_query}"
        )
        self.assertEqual(completed_response.status_code, 200)
        completed_payload = completed_response.get_json()
        self.assertEqual(completed_payload["counts"], {
            "total": 1,
            "completed": 1,
            "active": 0,
        })
        self.assertEqual(completed_payload["total_distance"], 50)
        record = completed_payload["records"][0]
        self.assertEqual(record["vehicle_id"], vehicle["id"])
        self.assertEqual(record["driver_id"], driver["id"])
        self.assertEqual(record["created_by"], "admin")

        search_match = self.client.get(
            f"/api/reports/advanced?status=completed"
            f"&vehicle_id={vehicle['id']}&search=Rapor+Sürücüsü"
        )
        self.assertEqual(search_match.status_code, 200)
        self.assertEqual(search_match.get_json()["counts"]["total"], 1)
        search_miss = self.client.get(
            f"/api/reports/advanced?status=completed"
            f"&vehicle_id={vehicle['id']}&search=bulunmayan"
        )
        self.assertEqual(search_miss.status_code, 200)
        self.assertEqual(search_miss.get_json()["counts"]["total"], 0)

        today = datetime.now(app_module.APP_TIMEZONE).date().isoformat()
        dated = self.client.get(
            f"/api/reports/advanced?status=completed"
            f"&date_from={today}&date_to={today}"
            f"&vehicle_id={vehicle['id']}"
        )
        self.assertEqual(dated.status_code, 200)
        self.assertEqual(dated.get_json()["counts"]["total"], 1)

        mismatched = self.client.get(
            f"/api/reports/advanced?status=completed"
            f"&vehicle_id={vehicle['id']}&brand_id=999999"
        )
        self.assertEqual(mismatched.status_code, 200)
        self.assertEqual(mismatched.get_json()["counts"]["total"], 0)

        self.assertEqual(
            self.client.get(
                "/api/reports/advanced?date_from=30-07-2026"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                "/api/reports/advanced?status=unknown"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                "/api/reports/advanced?sort=unknown"
            ).status_code,
            400,
        )
        sorted_payload = self.client.get(
            "/api/reports/advanced?status=completed&sort=distance-asc"
        ).get_json()
        sorted_distances = [
            int(item["distance"] or 0)
            for item in sorted_payload["records"]
        ]
        self.assertEqual(sorted_distances, sorted(sorted_distances))

        deactivated_driver = self.client.patch(
            f"/api/drivers/{driver['id']}",
            json={"active": False},
        )
        self.assertEqual(deactivated_driver.status_code, 200)
        filter_options = self.client.get(
            "/api/reports/filter-options"
        ).get_json()
        self.assertIn(
            driver["id"],
            {item["id"] for item in filter_options["drivers"]},
        )
        self.assertIn(
            vehicle_model["id"],
            {item["id"] for item in filter_options["models"]},
        )

        for sort_mode in (
            "date-asc",
            "distance-desc",
            "plate-asc",
            "driver-desc",
        ):
            with self.subTest(sort_mode=sort_mode):
                full_payload = self.client.get(
                    "/api/reports/advanced"
                    f"?status=completed&sort={sort_mode}"
                ).get_json()
                expected_first_id = full_payload["records"][0]["id"]
                previous_limit = app_module.REPORT_API_MAX_RECORDS
                try:
                    app_module.REPORT_API_MAX_RECORDS = 1
                    limited_response = self.client.get(
                        "/api/reports/advanced"
                        f"?status=completed&sort={sort_mode}"
                    )
                finally:
                    app_module.REPORT_API_MAX_RECORDS = previous_limit
                self.assertEqual(limited_response.status_code, 200)
                limited_payload = limited_response.get_json()
                self.assertTrue(limited_payload["truncated"])
                self.assertEqual(limited_payload["record_limit"], 1)
                self.assertEqual(len(limited_payload["records"]), 1)
                self.assertEqual(
                    limited_payload["records"][0]["id"],
                    expected_first_id,
                )

    def test_report_export_headers_and_file_signatures(self):
        self.authenticate()
        _, _, vehicle = self.create_vehicle(current_mileage=3000)
        self.assertEqual(
            self.record(
                plate=vehicle["plate"],
                action="pickup",
                mileage=3050,
            ).status_code,
            201,
        )
        self.assertEqual(
            self.record(
                plate=vehicle["plate"],
                action="dropoff",
                mileage=3075,
            ).status_code,
            201,
        )

        cases = (
            (
                "csv",
                "text/csv",
                codecs.BOM_UTF8,
                ".csv",
            ),
            (
                "xlsx",
                (
                    "application/vnd.openxmlformats-officedocument."
                    "spreadsheetml.sheet"
                ),
                b"PK\x03\x04",
                ".xlsx",
            ),
            (
                "pdf",
                "application/pdf",
                b"%PDF-",
                ".pdf",
            ),
        )
        for export_format, mimetype, magic, extension in cases:
            with self.subTest(export_format=export_format):
                response = self.client.get(
                    f"/api/reports/export?format={export_format}"
                    f"&status=completed&vehicle_id={vehicle['id']}"
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.mimetype, mimetype)
                self.assertTrue(response.data.startswith(magic))
                content_disposition = response.headers["Content-Disposition"]
                self.assertIn("attachment", content_disposition)
                self.assertIn(extension, content_disposition)
                if export_format == "pdf":
                    self.assertTrue(response.data.rstrip().endswith(b"%%EOF"))

        self.assertEqual(
            self.client.get(
                "/api/reports/export?format=unsupported"
            ).status_code,
            400,
        )

    def test_feature_records_store_relational_ids_and_creator(self):
        self.authenticate()
        _, _, vehicle = self.create_vehicle(current_mileage=100)
        driver = self.create_driver(
            employee_no="REL-001",
            full_name="İlişkili Sürücü",
        )
        self.assertEqual(
            self.record(
                plate=vehicle["plate"],
                action="pickup",
                mileage=110,
                driver_id=driver["id"],
            ).status_code,
            201,
        )
        self.assertEqual(
            self.record(
                plate=vehicle["plate"],
                action="dropoff",
                mileage=125,
            ).status_code,
            201,
        )

        with app_module.app.app_context():
            self.assertEqual(
                db.session.scalar(
                    db.select(db.func.count()).select_from(ActiveTrip)
                ),
                0,
            )
            record = db.session.scalar(
                db.select(MovementRecord).where(
                    MovementRecord.vehicle_id == vehicle["id"]
                )
            )
            persisted_vehicle = db.session.get(Vehicle, vehicle["id"])
            persisted_driver = db.session.get(Driver, driver["id"])
            self.assertIsNotNone(record)
            self.assertEqual(record.driver_id, persisted_driver.id)
            self.assertEqual(record.vehicle_id, persisted_vehicle.id)
            self.assertEqual(record.created_by, "admin")
            self.assertEqual(persisted_vehicle.current_mileage, 125)


if __name__ == "__main__":
    unittest.main()
