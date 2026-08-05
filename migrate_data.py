import os
from sqlalchemy import create_engine, MetaData, Table

old_db_url = "postgresql://arac_plaka_db_user:6MAn7Pluaw5rrZJWRWOihr61WTc1KfSs@dpg-d9l19rijobas738g1iv0-a.oregon-postgres.render.com/arac_plaka_db"
new_db_url = "postgresql://neondb_owner:npg_8TkxnSVv0YLX@ep-rapid-star-aszbsk55-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Create engines
old_engine = create_engine(old_db_url)
new_engine = create_engine(new_db_url)

old_meta = MetaData()
old_meta.reflect(bind=old_engine)

new_meta = MetaData()
new_meta.reflect(bind=new_engine)

# Tables to copy in order of dependencies
tables = [
    'system_users',
    'app_settings',
    'movement_types',
    'brands',
    'vehicle_models',
    'drivers',
    'vehicles',
    'active_trips',
    'movement_records',
    'vehicle_reminders',
    'vehicle_maintenances'
]

print("Starting migration...")

with new_engine.begin() as new_conn:
    # 1. Clear target tables to avoid ID conflicts
    print("Clearing new database (truncating tables)...")
    for table_name in reversed(tables):
        if table_name in new_meta.tables:
            new_conn.execute(new_meta.tables[table_name].delete())

    # 2. Copy data
    with old_engine.connect() as old_conn:
        for table_name in tables:
            if table_name in old_meta.tables:
                print(f"Migrating {table_name}...")
                old_table = old_meta.tables[table_name]
                new_table = new_meta.tables[table_name]
                
                rows = old_conn.execute(old_table.select()).fetchall()
                if rows:
                    # Insert in batches or all at once
                    # Using dicts for the new insert
                    dicts = [dict(zip(old_table.columns.keys(), row)) for row in rows]
                    new_conn.execute(new_table.insert(), dicts)
                print(f"  -> Migrated {len(rows)} records.")
                
    # 3. Update PostgreSQL sequences so new inserts don't fail due to duplicate IDs
    print("Updating primary key sequences...")
    for table_name in tables:
        if table_name in new_meta.tables:
            # Assuming standard naming convention for sequences: tablename_id_seq
            seq_name = f"{table_name}_id_seq"
            try:
                # Check if sequence exists and reset it
                new_conn.execute(f"SELECT setval('{seq_name}', (SELECT COALESCE(MAX(id), 1) FROM {table_name}));")
            except Exception as e:
                pass # Not all tables have an ID column or a standard sequence name

print("Migration completed successfully!")
