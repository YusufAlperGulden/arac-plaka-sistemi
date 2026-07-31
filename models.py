from datetime import datetime
import sqlite3

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Index, UniqueConstraint, event
from sqlalchemy.engine import Engine


db = SQLAlchemy()


@event.listens_for(Engine, "connect")
def configure_sqlite_connection(dbapi_connection, _connection_record):
    if not isinstance(dbapi_connection, sqlite3.Connection):
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()

class SystemUser(db.Model):
    __tablename__ = "system_users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    full_name = db.Column(db.String(120), nullable=True)
    profile_photo = db.Column(db.Text, nullable=True)
    employee_no = db.Column(db.String(50), nullable=True)
    department = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    license_class = db.Column(db.String(40), nullable=True)
    license_expiry_date = db.Column(db.Date, nullable=True)


class Driver(db.Model):
    __tablename__ = "drivers"

    id = db.Column(db.Integer, primary_key=True)
    employee_no = db.Column(
        db.String(50),
        nullable=True,
        unique=True,
        index=True,
    )
    full_name = db.Column(db.String(120), nullable=False, index=True)
    department = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    license_class = db.Column(db.String(40), nullable=True)
    license_expiry_date = db.Column(db.Date, nullable=True, index=True)
    active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.now,
        onupdate=datetime.now,
    )

    active_trips = db.relationship(
        "ActiveTrip",
        back_populates="driver_profile",
        foreign_keys="ActiveTrip.driver_id",
        passive_deletes=True,
    )
    movement_records = db.relationship(
        "MovementRecord",
        back_populates="driver_profile",
        foreign_keys="MovementRecord.driver_id",
        passive_deletes=True,
    )


class Brand(db.Model):
    __tablename__ = "brands"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False, unique=True, index=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    models = db.relationship(
        "VehicleModel",
        back_populates="brand",
        order_by="VehicleModel.name",
    )


class VehicleModel(db.Model):
    __tablename__ = "vehicle_models"
    __table_args__ = (
        UniqueConstraint("brand_id", "name", name="uq_vehicle_model_brand_name"),
    )

    id = db.Column(db.Integer, primary_key=True)
    brand_id = db.Column(
        db.Integer,
        db.ForeignKey("brands.id"),
        nullable=False,
        index=True,
    )
    name = db.Column(db.String(100), nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    brand = db.relationship("Brand", back_populates="models")
    vehicles = db.relationship(
        "Vehicle",
        back_populates="model",
        order_by="Vehicle.plate",
    )


class Vehicle(db.Model):
    __tablename__ = "vehicles"

    id = db.Column(db.Integer, primary_key=True)
    plate = db.Column(db.String(16), nullable=False, unique=True, index=True)
    model_id = db.Column(
        db.Integer,
        db.ForeignKey("vehicle_models.id"),
        nullable=False,
        index=True,
    )
    year = db.Column(db.Integer, nullable=True)
    current_mileage = db.Column(db.Integer, nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.now,
        onupdate=datetime.now,
    )

    model = db.relationship("VehicleModel", back_populates="vehicles")
    active_trips = db.relationship(
        "ActiveTrip",
        back_populates="vehicle",
        passive_deletes=True,
    )
    movement_records = db.relationship(
        "MovementRecord",
        back_populates="vehicle",
        passive_deletes=True,
    )
    reminders = db.relationship(
        "VehicleReminder",
        back_populates="vehicle",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class MovementType(db.Model):
    __tablename__ = "movement_types"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True, index=True)
    description = db.Column(db.Text, nullable=False, default="")
    requires_request_no = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )
    requires_service_form_no = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
    )
    active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.now,
        onupdate=datetime.now,
    )


class ActiveTrip(db.Model):
    __tablename__ = "active_trips"

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(
        db.Integer,
        db.ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    driver_id = db.Column(
        db.Integer,
        db.ForeignKey("drivers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    plate = db.Column(db.String(16), nullable=False, unique=True, index=True)
    vehicle_name = db.Column(
        db.String(255),
        nullable=False,
        default="Bilinmeyen Araç",
    )
    driver = db.Column(db.String(120), nullable=False)
    action_type = db.Column(db.String(120), nullable=False)
    start_mileage = db.Column(db.String(32), nullable=False)
    start_date = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=datetime.now,
    )
    request_no = db.Column(db.String(100), nullable=False, default="")
    service_form_no = db.Column(db.String(100), nullable=False, default="")
    notes = db.Column(db.Text, nullable=False, default="")
    created_by = db.Column(db.String(120), nullable=False, default="")

    vehicle = db.relationship("Vehicle", back_populates="active_trips")
    driver_profile = db.relationship(
        "Driver",
        back_populates="active_trips",
        foreign_keys=[driver_id],
    )


class MovementRecord(db.Model):
    __tablename__ = "movement_records"

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(
        db.Integer,
        db.ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    driver_id = db.Column(
        db.Integer,
        db.ForeignKey("drivers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action_type = db.Column(db.String(120), nullable=False)
    add_date = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=datetime.now,
    )
    vehicle_name = db.Column(db.String(255), nullable=False)
    plate = db.Column(db.String(16), nullable=False, index=True)
    driver = db.Column(db.String(120), nullable=False)
    request_no = db.Column(db.String(100), nullable=False, default="")
    service_form_no = db.Column(db.String(100), nullable=False, default="")
    start_mileage = db.Column(db.String(32), nullable=False)
    end_mileage = db.Column(db.String(32), nullable=False)
    start_date = db.Column(db.DateTime(timezone=True), nullable=False)
    distance = db.Column(db.String(32), nullable=False, default="0")
    end_date = db.Column(db.DateTime(timezone=True), nullable=False)
    notes = db.Column(db.Text, nullable=False, default="")
    created_by = db.Column(db.String(120), nullable=False, default="")

    vehicle = db.relationship("Vehicle", back_populates="movement_records")
    driver_profile = db.relationship(
        "Driver",
        back_populates="movement_records",
        foreign_keys=[driver_id],
    )


class VehicleReminder(db.Model):
    __tablename__ = "vehicle_reminders"
    __table_args__ = (
        Index(
            "ix_vehicle_reminders_vehicle_active",
            "vehicle_id",
            "active",
        ),
        Index(
            "ix_vehicle_reminders_due_date_active",
            "due_date",
            "active",
        ),
        Index(
            "ix_vehicle_reminders_due_mileage_active",
            "due_mileage",
            "active",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(
        db.Integer,
        db.ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reminder_type = db.Column(
        db.String(80),
        nullable=False,
        index=True,
    )
    title = db.Column(db.String(160), nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    due_mileage = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=False, default="")
    active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.now,
        onupdate=datetime.now,
    )

    vehicle = db.relationship("Vehicle", back_populates="reminders")


class AppSetting(db.Model):
    __tablename__ = "app_settings"

    key = db.Column(db.String(120), primary_key=True)
    value = db.Column(db.Text, nullable=False, default="")
