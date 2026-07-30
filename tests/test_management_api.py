import os
import unittest


# app.py creates and seeds its database at import time. Force every test run to
# use a disposable database before importing the application module.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

import app as app_module
from models import (
    ActiveTrip,
    AppSetting,
    Brand,
    Driver,
    MovementRecord,
    MovementType,
    Vehicle,
    VehicleReminder,
    VehicleModel,
    db,
)


SEEDED_MODELS = (
    Brand,
    VehicleModel,
    Vehicle,
    MovementType,
    ActiveTrip,
    MovementRecord,
    Driver,
    VehicleReminder,
    AppSetting,
)


def reset_seeded_database():
    with app_module.app.app_context():
        db.session.remove()
        db.drop_all()
        app_module.initialize_database()


def model_counts():
    return {
        model.__name__: db.session.scalar(
            db.select(db.func.count()).select_from(model)
        )
        for model in SEEDED_MODELS
    }


class ManagementApiTests(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(
            TESTING=True,
            SESSION_COOKIE_SECURE=False,
            RATELIMIT_ENABLED=False,
        )
        reset_seeded_database()
        app_module.limiter.reset()
        self.client = app_module.app.test_client()

    def tearDown(self):
        with app_module.app.app_context():
            db.session.remove()

    def authenticate(self, username="admin"):
        with self.client.session_transaction() as session:
            session["user"] = username

    def create_brand(self, name="TOYOTA"):
        response = self.client.post(
            "/api/brands",
            json={"name": name},
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()["brand"]

    def create_model(self, brand_id, name="COROLLA"):
        response = self.client.post(
            "/api/models",
            json={"brand_id": brand_id, "name": name},
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()["model"]

    def create_vehicle(
        self,
        model_id,
        plate="35ABC123",
        year=2024,
    ):
        response = self.client.post(
            "/api/vehicles",
            json={
                "plate": plate,
                "model_id": model_id,
                "year": year,
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()["vehicle"]

    def test_login_exposes_admin_role_without_granting_it_to_regular_user(self):
        admin_response = self.client.post(
            "/api/login",
            json={"username": "admin", "password": "admin123"},
        )
        self.assertEqual(admin_response.status_code, 200)
        self.assertTrue(admin_response.get_json()["is_admin"])

        regular_client = app_module.app.test_client()
        regular_response = regular_client.post(
            "/api/login",
            json={"username": "kullanici", "password": "sifre123"},
        )
        self.assertEqual(regular_response.status_code, 200)
        self.assertFalse(regular_response.get_json()["is_admin"])

    def test_operation_form_exposes_admin_vehicle_registration_shortcut(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn('id="add-new-plate-btn"', html)
        self.assertIn(
            'class="btn-outline admin-only selection-shortcut-btn"',
            html,
        )
        self.assertIn('id="vehicle-registration-return-note"', html)
        self.assertIn(
            "Yeni aracı kaydedip bu işleme otomatik dönün.",
            html,
        )
        self.assertIn('id="add-new-driver-btn"', html)
        self.assertIn('id="driver-registration-return-note"', html)
        self.assertIn(
            "Yeni sürücüyü kaydedip bu işleme otomatik dönün.",
            html,
        )
        self.assertIn('id="add-new-movement-type-btn"', html)
        self.assertIn('id="movement-type-registration-return-note"', html)
        self.assertIn(
            "Yeni kullanım amacını kaydedip bu işleme otomatik dönün.",
            html,
        )

    def test_management_permissions_distinguish_anonymous_regular_and_admin(self):
        for path in (
            "/api/brands",
            "/api/management/catalog",
            "/api/movement-types",
            "/api/active-trips",
        ):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)

        self.authenticate("kullanici")
        self.assertEqual(self.client.get("/api/movement-types").status_code, 200)
        self.assertEqual(self.client.get("/api/active-trips").status_code, 200)
        self.assertEqual(self.client.get("/api/brands").status_code, 403)
        self.assertEqual(
            self.client.get("/api/management/catalog").status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                "/api/movement-types",
                json={"name": "Yetkisiz Tür"},
            ).status_code,
            403,
        )

        self.authenticate("admin")
        self.assertEqual(self.client.get("/api/brands").status_code, 200)
        self.assertEqual(
            self.client.get("/api/management/catalog").status_code,
            200,
        )

    def test_brand_create_duplicate_update_and_deactivate_lifecycle(self):
        self.authenticate()
        brand = self.create_brand("  toyota  ")
        self.assertEqual(brand["name"], "TOYOTA")
        self.assertTrue(brand["active"])

        duplicate = self.client.post(
            "/api/brands",
            json={"name": "Toyota"},
        )
        self.assertEqual(duplicate.status_code, 409)

        update = self.client.patch(
            f"/api/brands/{brand['id']}",
            json={"name": "Toyota Motor", "active": False},
        )
        self.assertEqual(update.status_code, 200)
        updated_brand = update.get_json()["brand"]
        self.assertEqual(updated_brand["name"], "TOYOTA MOTOR")
        self.assertFalse(updated_brand["active"])

        brands = self.client.get("/api/brands").get_json()["brands"]
        persisted = next(item for item in brands if item["id"] == brand["id"])
        self.assertFalse(persisted["active"])

    def test_model_create_filter_duplicate_update_and_deactivate_lifecycle(self):
        self.authenticate()
        brand = self.create_brand()
        vehicle_model = self.create_model(brand["id"], "  corolla  ")
        self.assertEqual(vehicle_model["name"], "COROLLA")
        self.assertEqual(vehicle_model["brand_id"], brand["id"])
        self.assertTrue(vehicle_model["active"])

        duplicate = self.client.post(
            "/api/models",
            json={"brand_id": brand["id"], "name": "Corolla"},
        )
        self.assertEqual(duplicate.status_code, 409)

        filtered = self.client.get(
            f"/api/models?brand_id={brand['id']}"
        ).get_json()["models"]
        self.assertEqual(
            [item["id"] for item in filtered],
            [vehicle_model["id"]],
        )

        update = self.client.patch(
            f"/api/models/{vehicle_model['id']}",
            json={"name": "Yaris", "active": False},
        )
        self.assertEqual(update.status_code, 200)
        updated_model = update.get_json()["model"]
        self.assertEqual(updated_model["name"], "YARIS")
        self.assertFalse(updated_model["active"])

    def test_vehicle_create_duplicate_update_and_active_plate_filter(self):
        self.authenticate()
        brand = self.create_brand()
        vehicle_model = self.create_model(brand["id"])
        vehicle = self.create_vehicle(vehicle_model["id"])

        self.assertEqual(vehicle["plate"], "35ABC123")
        self.assertEqual(vehicle["display_plate"], "35 ABC 123")
        self.assertEqual(vehicle["vehicle_name"], "TOYOTA 2024 COROLLA")
        self.assertTrue(vehicle["active"])

        duplicate = self.client.post(
            "/api/vehicles",
            json={
                "plate": "35 ABC 123",
                "model_id": vehicle_model["id"],
                "year": 2025,
            },
        )
        self.assertEqual(duplicate.status_code, 409)

        deactivate = self.client.patch(
            f"/api/vehicles/{vehicle['id']}",
            json={"active": False},
        )
        self.assertEqual(deactivate.status_code, 200)
        self.assertFalse(deactivate.get_json()["vehicle"]["active"])
        self.assertNotIn(
            vehicle["plate"],
            self.client.get("/api/plates").get_json()["plates"],
        )

        reactivate = self.client.patch(
            f"/api/vehicles/{vehicle['id']}",
            json={"active": True, "year": 2025},
        )
        self.assertEqual(reactivate.status_code, 200)
        self.assertTrue(reactivate.get_json()["vehicle"]["active"])
        self.assertEqual(reactivate.get_json()["vehicle"]["year"], 2025)
        self.assertIn(
            vehicle["plate"],
            self.client.get("/api/plates").get_json()["plates"],
        )

    def test_management_catalog_returns_normalized_related_entities(self):
        self.authenticate()
        brand = self.create_brand()
        vehicle_model = self.create_model(brand["id"])
        vehicle = self.create_vehicle(vehicle_model["id"])

        response = self.client.get("/api/management/catalog")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIn(
            brand["id"],
            [item["id"] for item in payload["brands"]],
        )
        self.assertIn(
            vehicle_model["id"],
            [item["id"] for item in payload["models"]],
        )
        saved_vehicle = next(
            item
            for item in payload["vehicles"]
            if item["id"] == vehicle["id"]
        )
        self.assertEqual(saved_vehicle["brand"], "TOYOTA")
        self.assertEqual(saved_vehicle["model"], "COROLLA")

    def test_movement_type_crud_inactive_filter_and_other_lock(self):
        self.authenticate()
        create = self.client.post(
            "/api/movement-types",
            json={
                "name": "Eğitim Kullanımı",
                "description": "Sürücü eğitimi",
                "sort_order": 40,
            },
        )
        self.assertEqual(create.status_code, 201)
        movement_type = create.get_json()["movement_type"]
        self.assertTrue(movement_type["active"])

        duplicate = self.client.post(
            "/api/movement-types",
            json={"name": "Eğitim Kullanımı"},
        )
        self.assertEqual(duplicate.status_code, 409)

        update = self.client.patch(
            f"/api/movement-types/{movement_type['id']}",
            json={
                "description": "Güncel açıklama",
                "active": False,
                "sort_order": 41,
            },
        )
        self.assertEqual(update.status_code, 200)
        updated_type = update.get_json()["movement_type"]
        self.assertFalse(updated_type["active"])
        self.assertEqual(updated_type["sort_order"], 41)

        active_items = self.client.get(
            "/api/movement-types"
        ).get_json()["movement_types"]
        self.assertNotIn(
            movement_type["id"],
            [item["id"] for item in active_items],
        )
        all_items = self.client.get(
            "/api/movement-types?include_inactive=1"
        ).get_json()["movement_types"]
        self.assertIn(
            movement_type["id"],
            [item["id"] for item in all_items],
        )

        other = next(item for item in all_items if item["name"] == "Diğer")
        self.assertTrue(other["locked"])
        self.assertEqual(
            self.client.patch(
                f"/api/movement-types/{other['id']}",
                json={"active": False},
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/movement-types/{other['id']}",
                json={"name": "Başka"},
            ).status_code,
            400,
        )

    def test_active_trip_dashboard_tracks_pickup_and_dropoff(self):
        self.authenticate("kullanici")
        initial = self.client.get("/api/active-trips").get_json()
        self.assertEqual(initial["counts"], {
            "total": 2,
            "active": 0,
            "available": 2,
        })

        pickup = self.client.post(
            "/api/record",
            json={
                "plate": "34KM4969",
                "action": "pickup",
                "action_type": "Müşteri Ziyareti",
                "mileage": "193400",
                "user": "kullanici",
                "request_no": "TAL-77",
                "service_form_no": "",
                "notes": "Müşteri sahası",
            },
        )
        self.assertEqual(pickup.status_code, 201)
        self.assertEqual(
            self.client.post(
                "/api/record",
                json={
                    "plate": "34KM4969",
                    "action": "pickup",
                    "action_type": "Diğer",
                    "mileage": "193401",
                    "user": "kullanici",
                },
            ).status_code,
            409,
        )

        active = self.client.get("/api/active-trips").get_json()
        self.assertEqual(active["counts"], {
            "total": 2,
            "active": 1,
            "available": 1,
        })
        self.assertEqual(len(active["items"]), 1)
        item = active["items"][0]
        self.assertEqual(item["plate"], "34KM4969")
        self.assertEqual(item["action_type"], "Müşteri Ziyareti")
        self.assertEqual(item["request_no"], "TAL-77")

        with app_module.app.app_context():
            vehicle = db.session.scalar(
                db.select(Vehicle).where(Vehicle.plate == "34KM4969")
            )
            vehicle_id = vehicle.id
        self.authenticate("admin")
        blocked = self.client.patch(
            f"/api/vehicles/{vehicle_id}",
            json={"active": False},
        )
        self.assertEqual(blocked.status_code, 409)

        self.authenticate("kullanici")
        dropoff = self.client.post(
            "/api/record",
            json={
                "plate": "34KM4969",
                "action": "dropoff",
                "action_type": "Diğer",
                "mileage": "193425",
                "user": "kullanici",
                "notes": "Teslim",
            },
        )
        self.assertEqual(dropoff.status_code, 201)
        completed = self.client.get("/api/active-trips").get_json()
        self.assertEqual(completed["counts"]["active"], 0)
        self.assertEqual(completed["counts"]["available"], 2)
        self.assertEqual(completed["items"], [])

        with app_module.app.app_context():
            self.assertIsNone(db.session.scalar(
                db.select(ActiveTrip).where(
                    ActiveTrip.plate == "34KM4969"
                )
            ))
            record = db.session.scalar(
                db.select(MovementRecord)
                .where(MovementRecord.plate == "34KM4969")
                .order_by(MovementRecord.id.desc())
            )
            self.assertEqual(record.action_type, "Müşteri Ziyareti")
            self.assertEqual(record.distance, "25")
            self.assertEqual(record.request_no, "TAL-77")

    def test_database_seed_is_idempotent(self):
        with app_module.app.app_context():
            before = model_counts()
            purpose_names = set(
                db.session.scalars(db.select(MovementType.name)).all()
            )
            app_module.initialize_database()
            app_module.initialize_database()
            after = model_counts()

        self.assertEqual(after, before)
        self.assertEqual(purpose_names, set(app_module.VEHICLE_USAGE_PURPOSES))
        self.assertEqual(before["Brand"], 2)
        self.assertEqual(before["VehicleModel"], 2)
        self.assertEqual(before["Vehicle"], 2)
        self.assertEqual(before["MovementType"], 7)
        self.assertEqual(before["MovementRecord"], 5)
        self.assertEqual(before["ActiveTrip"], 0)
        self.assertGreaterEqual(before["Driver"], 3)
        self.assertEqual(before["VehicleReminder"], 0)
        self.assertEqual(before["AppSetting"], 2)


if __name__ == "__main__":
    unittest.main()
