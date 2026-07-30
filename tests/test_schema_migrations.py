import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace

from sqlalchemy import create_engine, inspect, text

from models import db
from schema_migrations import ensure_schema_extensions


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


LEGACY_SCHEMA_STATEMENTS = (
    """
    CREATE TABLE brands (
        id INTEGER NOT NULL PRIMARY KEY,
        name VARCHAR(80) NOT NULL UNIQUE,
        active BOOLEAN NOT NULL,
        created_at DATETIME NOT NULL
    )
    """,
    """
    CREATE TABLE vehicle_models (
        id INTEGER NOT NULL PRIMARY KEY,
        brand_id INTEGER NOT NULL REFERENCES brands(id),
        name VARCHAR(100) NOT NULL,
        active BOOLEAN NOT NULL,
        created_at DATETIME NOT NULL,
        CONSTRAINT uq_vehicle_model_brand_name UNIQUE (brand_id, name)
    )
    """,
    """
    CREATE TABLE vehicles (
        id INTEGER NOT NULL PRIMARY KEY,
        plate VARCHAR(16) NOT NULL UNIQUE,
        model_id INTEGER NOT NULL REFERENCES vehicle_models(id),
        year INTEGER,
        active BOOLEAN NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    )
    """,
    """
    CREATE TABLE movement_types (
        id INTEGER NOT NULL PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        active BOOLEAN NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    )
    """,
    """
    CREATE TABLE active_trips (
        id INTEGER NOT NULL PRIMARY KEY,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
        plate VARCHAR(16) NOT NULL UNIQUE,
        vehicle_name VARCHAR(255) NOT NULL,
        driver VARCHAR(120) NOT NULL,
        action_type VARCHAR(120) NOT NULL,
        start_mileage VARCHAR(32) NOT NULL,
        start_date DATETIME NOT NULL,
        request_no VARCHAR(100) NOT NULL DEFAULT '',
        service_form_no VARCHAR(100) NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT ''
    )
    """,
    """
    CREATE TABLE movement_records (
        id INTEGER NOT NULL PRIMARY KEY,
        action_type VARCHAR(120) NOT NULL,
        add_date DATETIME NOT NULL,
        vehicle_name VARCHAR(255) NOT NULL,
        plate VARCHAR(16) NOT NULL,
        driver VARCHAR(120) NOT NULL,
        request_no VARCHAR(100) NOT NULL DEFAULT '',
        service_form_no VARCHAR(100) NOT NULL DEFAULT '',
        start_mileage VARCHAR(32) NOT NULL,
        end_mileage VARCHAR(32) NOT NULL,
        start_date DATETIME NOT NULL,
        distance VARCHAR(32) NOT NULL DEFAULT '0',
        end_date DATETIME NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
    )
    """,
    """
    CREATE TABLE app_settings (
        key VARCHAR(120) NOT NULL PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
    )
    """,
)


LEGACY_DATA_STATEMENTS = (
    """
    INSERT INTO brands (id, name, active, created_at)
    VALUES (1, 'FORD', 1, '2026-01-01 09:00:00')
    """,
    """
    INSERT INTO vehicle_models (
        id, brand_id, name, active, created_at
    )
    VALUES (1, 1, 'TRANSIT', 1, '2026-01-01 09:00:00')
    """,
    """
    INSERT INTO vehicles (
        id, plate, model_id, year, active, created_at, updated_at
    )
    VALUES (
        1, '34KM4969', 1, 2016, 1,
        '2026-01-01 09:00:00', '2026-01-01 09:00:00'
    )
    """,
    """
    INSERT INTO movement_types (
        id, name, description, active, sort_order, created_at, updated_at
    )
    VALUES (
        1, 'Legacy Type', 'Preserve this description', 1, 7,
        '2026-01-01 09:00:00', '2026-01-01 09:00:00'
    )
    """,
    """
    INSERT INTO active_trips (
        id, vehicle_id, plate, vehicle_name, driver, action_type,
        start_mileage, start_date, request_no, service_form_no, notes
    )
    VALUES (
        1, NULL, '34KM4969', 'FORD 2016 TRANSIT', 'Active Driver',
        'Legacy Type', '194000', '2026-01-10 08:30:00',
        'REQ-1', '', 'Keep active-trip note'
    )
    """,
    """
    INSERT INTO movement_records (
        id, action_type, add_date, vehicle_name, plate, driver,
        request_no, service_form_no, start_mileage, end_mileage,
        start_date, distance, end_date, notes
    )
    VALUES (
        1, 'Legacy Type', '2026-01-09 18:00:00',
        'FORD 2016 TRANSIT', '34KM4969', 'Legacy Driver',
        '', 'SRV-1', '193286', '193.394',
        '2026-01-09 08:00:00', '108',
        '2026-01-09 18:00:00', 'Keep movement note'
    )
    """,
    """
    INSERT INTO app_settings (key, value)
    VALUES ('initial_seed_v1', 'complete')
    """,
)


def create_legacy_database(engine):
    with engine.begin() as connection:
        for statement in LEGACY_SCHEMA_STATEMENTS:
            connection.execute(text(statement))
        for statement in LEGACY_DATA_STATEMENTS:
            connection.execute(text(statement))


def schema_snapshot(engine):
    inspector = inspect(engine)
    table_columns = {}
    table_indexes = {}
    for table_name in inspector.get_table_names():
        table_columns[table_name] = tuple(
            sorted(column["name"] for column in inspector.get_columns(table_name))
        )
        table_indexes[table_name] = tuple(
            sorted(index["name"] for index in inspector.get_indexes(table_name))
        )
    return table_columns, table_indexes


class SchemaMigrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        database_path = Path(self.temporary_directory.name) / "legacy.db"
        self.database_path = database_path
        self.engine = create_engine(
            f"sqlite+pysqlite:///{database_path.as_posix()}"
        )
        create_legacy_database(self.engine)

    def tearDown(self):
        self.engine.dispose()
        self.temporary_directory.cleanup()

    def test_extensions_are_idempotent_and_preserve_legacy_rows(self):
        before_columns = {
            column["name"]
            for column in inspect(self.engine).get_columns("vehicles")
        }
        self.assertNotIn("current_mileage", before_columns)

        # This mirrors startup: create_all creates only wholly new tables, then
        # the additive migration extends tables that already existed.
        db.metadata.create_all(self.engine)
        migration_db = SimpleNamespace(engine=self.engine)
        ensure_schema_extensions(migration_db)

        first_snapshot = schema_snapshot(self.engine)
        ensure_schema_extensions(migration_db)
        second_snapshot = schema_snapshot(self.engine)
        self.assertEqual(first_snapshot, second_snapshot)

        expected_columns = {
            "vehicles": {"current_mileage"},
            "movement_types": {
                "requires_request_no",
                "requires_service_form_no",
            },
            "active_trips": {"driver_id", "created_by"},
            "movement_records": {
                "vehicle_id",
                "driver_id",
                "created_by",
            },
        }
        inspector = inspect(self.engine)
        for table_name, added_columns in expected_columns.items():
            with self.subTest(table=table_name):
                actual_columns = {
                    column["name"]
                    for column in inspector.get_columns(table_name)
                }
                self.assertTrue(added_columns.issubset(actual_columns))

        expected_indexes = {
            "active_trips": {"ix_active_trips_driver_id"},
            "movement_records": {
                "ix_movement_records_vehicle_id",
                "ix_movement_records_driver_id",
            },
            "drivers": {
                "ix_drivers_employee_no",
                "ix_drivers_full_name",
                "ix_drivers_license_expiry_date",
                "ix_drivers_active",
            },
            "vehicle_reminders": {
                "ix_vehicle_reminders_vehicle_id",
                "ix_vehicle_reminders_reminder_type",
                "ix_vehicle_reminders_active",
                "ix_vehicle_reminders_vehicle_active",
                "ix_vehicle_reminders_due_date_active",
                "ix_vehicle_reminders_due_mileage_active",
            },
        }
        for table_name, expected in expected_indexes.items():
            with self.subTest(indexes_for=table_name):
                actual = {
                    index["name"]
                    for index in inspector.get_indexes(table_name)
                }
                self.assertTrue(expected.issubset(actual))

        with self.engine.connect() as connection:
            vehicle = connection.execute(text(
                """
                SELECT plate, year, current_mileage
                FROM vehicles
                WHERE id = 1
                """
            )).mappings().one()
            movement_type = connection.execute(text(
                """
                SELECT name, description, requires_request_no,
                       requires_service_form_no
                FROM movement_types
                WHERE id = 1
                """
            )).mappings().one()
            active_trip = connection.execute(text(
                """
                SELECT plate, driver, notes, driver_id, created_by
                FROM active_trips
                WHERE id = 1
                """
            )).mappings().one()
            movement_record = connection.execute(text(
                """
                SELECT plate, driver, notes, vehicle_id, driver_id, created_by
                FROM movement_records
                WHERE id = 1
                """
            )).mappings().one()

        self.assertEqual(dict(vehicle), {
            "plate": "34KM4969",
            "year": 2016,
            "current_mileage": None,
        })
        self.assertEqual(movement_type["name"], "Legacy Type")
        self.assertEqual(
            movement_type["description"],
            "Preserve this description",
        )
        self.assertFalse(movement_type["requires_request_no"])
        self.assertFalse(movement_type["requires_service_form_no"])
        self.assertEqual(active_trip["plate"], "34KM4969")
        self.assertEqual(active_trip["driver"], "Active Driver")
        self.assertEqual(active_trip["notes"], "Keep active-trip note")
        self.assertIsNone(active_trip["driver_id"])
        self.assertEqual(active_trip["created_by"], "")
        self.assertEqual(movement_record["plate"], "34KM4969")
        self.assertEqual(movement_record["driver"], "Legacy Driver")
        self.assertEqual(movement_record["notes"], "Keep movement note")
        self.assertIsNone(movement_record["vehicle_id"])
        self.assertIsNone(movement_record["driver_id"])
        self.assertEqual(movement_record["created_by"], "")

    def test_initialize_database_backfills_v2_data_once(self):
        database_url = (
            f"sqlite+pysqlite:///{self.database_path.as_posix()}"
        )
        script = r"""
import json
import app
from models import ActiveTrip, AppSetting, Driver, MovementRecord, Vehicle, db

with app.app.app_context():
    app.initialize_database()
    vehicle = db.session.get(Vehicle, 1)
    record = db.session.get(MovementRecord, 1)
    active_trip = db.session.get(ActiveTrip, 1)
    payload = {
        "vehicle_count": db.session.scalar(
            db.select(db.func.count()).select_from(Vehicle)
        ),
        "record_count": db.session.scalar(
            db.select(db.func.count()).select_from(MovementRecord)
        ),
        "active_trip_count": db.session.scalar(
            db.select(db.func.count()).select_from(ActiveTrip)
        ),
        "current_mileage": vehicle.current_mileage,
        "record_vehicle_id": record.vehicle_id,
        "active_vehicle_id": active_trip.vehicle_id,
        "record_driver_id": record.driver_id,
        "active_driver_id": active_trip.driver_id,
        "legacy_driver_count": db.session.scalar(
            db.select(db.func.count()).select_from(Driver).where(
                Driver.full_name == "Legacy Driver"
            )
        ),
        "active_driver_count": db.session.scalar(
            db.select(db.func.count()).select_from(Driver).where(
                Driver.full_name == "Active Driver"
            )
        ),
        "v2_marker": db.session.get(
            AppSetting, "feature_seed_v2"
        ).value,
    }
    print(json.dumps(payload, sort_keys=True))
"""
        environment = os.environ.copy()
        environment["DATABASE_URL"] = database_url
        environment["SESSION_COOKIE_SECURE"] = "false"
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=REPOSITORY_ROOT,
            env=environment,
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
        json_lines = [
            line
            for line in result.stdout.splitlines()
            if line.startswith("{")
        ]
        self.assertTrue(
            json_lines,
            msg=f"No JSON payload in subprocess output: {result.stdout}",
        )
        payload = json.loads(json_lines[-1])

        self.assertEqual(payload["vehicle_count"], 1)
        self.assertEqual(payload["record_count"], 1)
        self.assertEqual(payload["active_trip_count"], 1)
        self.assertEqual(payload["current_mileage"], 194000)
        self.assertEqual(payload["record_vehicle_id"], 1)
        self.assertEqual(payload["active_vehicle_id"], 1)
        self.assertIsNotNone(payload["record_driver_id"])
        self.assertIsNotNone(payload["active_driver_id"])
        self.assertEqual(payload["legacy_driver_count"], 1)
        self.assertEqual(payload["active_driver_count"], 1)
        self.assertEqual(payload["v2_marker"], "complete")


if __name__ == "__main__":
    unittest.main()
