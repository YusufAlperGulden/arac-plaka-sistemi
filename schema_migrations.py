"""Small, idempotent schema extensions for existing application databases.

The application currently creates its tables with ``db.create_all()``.
``create_all`` does not add newly declared columns to tables that already
exist, so this module fills that narrow gap for both SQLite and PostgreSQL.
It intentionally contains only fixed schema metadata and never reads or logs
application rows.
"""

from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError


_COLUMN_EXTENSIONS = {
    "system_users": (
        ("full_name", "VARCHAR(120)"),
        ("profile_photo", "TEXT"),
        ("employee_no", "VARCHAR(50)"),
        ("department", "VARCHAR(120)"),
        ("phone", "VARCHAR(40)"),
        ("license_class", "VARCHAR(40)"),
        ("license_expiry_date", "DATE"),
    ),
    "vehicles": (
        ("current_mileage", "INTEGER"),
    ),
    "movement_types": (
        (
            "requires_request_no",
            "BOOLEAN NOT NULL DEFAULT FALSE",
        ),
        (
            "requires_service_form_no",
            "BOOLEAN NOT NULL DEFAULT FALSE",
        ),
    ),
    "active_trips": (
        (
            "driver_id",
            "INTEGER REFERENCES drivers(id) ON DELETE SET NULL",
        ),
        (
            "created_by",
            "VARCHAR(120) NOT NULL DEFAULT ''",
        ),
    ),
    "movement_records": (
        (
            "vehicle_id",
            "INTEGER REFERENCES vehicles(id) ON DELETE SET NULL",
        ),
        (
            "driver_id",
            "INTEGER REFERENCES drivers(id) ON DELETE SET NULL",
        ),
        (
            "created_by",
            "VARCHAR(120) NOT NULL DEFAULT ''",
        ),
    ),
    "vehicle_maintenances": (
        ("status", "VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'"),
        ("end_date", "DATE"),
        ("end_mileage", "INTEGER"),
    ),
}


_INDEX_EXTENSIONS = (
    (
        "ix_active_trips_driver_id",
        "active_trips",
        ("driver_id",),
        False,
    ),
    (
        "ix_movement_records_vehicle_id",
        "movement_records",
        ("vehicle_id",),
        False,
    ),
    (
        "ix_movement_records_driver_id",
        "movement_records",
        ("driver_id",),
        False,
    ),
    (
        "ix_drivers_employee_no",
        "drivers",
        ("employee_no",),
        True,
    ),
    (
        "ix_drivers_full_name",
        "drivers",
        ("full_name",),
        False,
    ),
    (
        "ix_drivers_license_expiry_date",
        "drivers",
        ("license_expiry_date",),
        False,
    ),
    (
        "ix_drivers_active",
        "drivers",
        ("active",),
        False,
    ),
    (
        "ix_vehicle_reminders_vehicle_id",
        "vehicle_reminders",
        ("vehicle_id",),
        False,
    ),
    (
        "ix_vehicle_reminders_reminder_type",
        "vehicle_reminders",
        ("reminder_type",),
        False,
    ),
    (
        "ix_vehicle_reminders_active",
        "vehicle_reminders",
        ("active",),
        False,
    ),
    (
        "ix_vehicle_reminders_vehicle_active",
        "vehicle_reminders",
        ("vehicle_id", "active"),
        False,
    ),
    (
        "ix_vehicle_reminders_due_date_active",
        "vehicle_reminders",
        ("due_date", "active"),
        False,
    ),
    (
        "ix_vehicle_reminders_due_mileage_active",
        "vehicle_reminders",
        ("due_mileage", "active"),
        False,
    ),
)


def _quote(connection, identifier):
    return connection.dialect.identifier_preparer.quote(identifier)


def _column_names(connection, table_name):
    return {
        column["name"]
        for column in inspect(connection).get_columns(table_name)
    }


def _add_missing_column(
    connection,
    table_name,
    column_name,
    column_definition,
):
    quoted_table = _quote(connection, table_name)
    quoted_column = _quote(connection, column_name)
    if connection.dialect.name == "postgresql":
        statement = (
            f"ALTER TABLE {quoted_table} "
            f"ADD COLUMN IF NOT EXISTS {quoted_column} {column_definition}"
        )
        connection.execute(text(statement))
        return

    statement = (
        f"ALTER TABLE {quoted_table} "
        f"ADD COLUMN {quoted_column} {column_definition}"
    )
    try:
        connection.execute(text(statement))
    except OperationalError:
        # SQLite has no ADD COLUMN IF NOT EXISTS. If another initializer added
        # the same column after our inspection, the desired end state already
        # exists; otherwise preserve the original failure.
        if column_name not in _column_names(connection, table_name):
            raise


def _ensure_index(
    connection,
    index_name,
    table_name,
    column_names,
    unique,
):
    quoted_index = _quote(connection, index_name)
    quoted_table = _quote(connection, table_name)
    quoted_columns = ", ".join(
        _quote(connection, column_name)
        for column_name in column_names
    )
    unique_sql = "UNIQUE " if unique else ""
    connection.execute(text(
        f"CREATE {unique_sql}INDEX IF NOT EXISTS {quoted_index} "
        f"ON {quoted_table} ({quoted_columns})"
    ))


def ensure_schema_extensions(db):
    """Add fields introduced after the initial schema, without touching rows.

    Call this inside a Flask application context after ``db.create_all()``.
    Repeated calls are safe. New tables such as ``drivers`` and
    ``vehicle_reminders`` remain the responsibility of ``create_all``.
    """

    engine = db.engine
    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = set(inspector.get_table_names())

        for table_name, extensions in _COLUMN_EXTENSIONS.items():
            if table_name not in existing_tables:
                continue
            existing_columns = _column_names(connection, table_name)
            for column_name, column_definition in extensions:
                if column_name in existing_columns:
                    continue
                _add_missing_column(
                    connection,
                    table_name,
                    column_name,
                    column_definition,
                )
                existing_columns.add(column_name)

        # Re-inspect after ALTER TABLE statements so indexes are only created
        # where every required table and column is now present.
        existing_tables = set(inspect(connection).get_table_names())
        for (
            index_name,
            table_name,
            column_names,
            unique,
        ) in _INDEX_EXTENSIONS:
            if table_name not in existing_tables:
                continue
            existing_columns = _column_names(connection, table_name)
            if not set(column_names).issubset(existing_columns):
                continue
            _ensure_index(
                connection,
                index_name,
                table_name,
                column_names,
                unique,
            )
