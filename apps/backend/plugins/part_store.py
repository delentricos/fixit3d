import json
import sqlite3
from pathlib import Path

from .part_state import PartState


DATABASE = Path(__file__).resolve().parent.parent / "parts.db"


class PartStore:

    def __init__(self):
        self.connection = sqlite3.connect(
            DATABASE,
            check_same_thread=False,
        )

        self.create_table()

    def create_table(self):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS parts (
                id TEXT PRIMARY KEY,
                plugin TEXT NOT NULL,
                parameters TEXT NOT NULL,
                geometry TEXT NOT NULL,
                features TEXT NOT NULL,
                position TEXT NOT NULL DEFAULT '{}',
                rotation TEXT NOT NULL DEFAULT '{}',
                scale TEXT NOT NULL DEFAULT '{}'
            )
            """
        )

        columns = {
            row[1]
            for row in cursor.execute("PRAGMA table_info(parts)").fetchall()
        }
        if "position" not in columns:
            cursor.execute(
                "ALTER TABLE parts ADD COLUMN position TEXT NOT NULL DEFAULT '{}'"
            )
        if "rotation" not in columns:
            cursor.execute(
                "ALTER TABLE parts ADD COLUMN rotation TEXT NOT NULL DEFAULT '{}'"
            )
        if "scale" not in columns:
            cursor.execute(
                "ALTER TABLE parts ADD COLUMN scale TEXT NOT NULL DEFAULT '{}'"
            )

        self.connection.commit()

    def generate_id(self) -> str:
        cursor = self.connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM parts
            WHERE id LIKE 'part_%'
            """
        )

        existing_ids = []

        for row in cursor.fetchall():
            part_id = row[0]

            try:
                number = int(part_id.split("_")[1])
                existing_ids.append(number)
            except (IndexError, ValueError):
                continue

        next_number = max(existing_ids, default=0) + 1

        return f"part_{next_number:03d}"

    def save(self, part: PartState):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            INSERT OR REPLACE INTO parts
            (
                id,
                plugin,
                parameters,
                geometry,
                features,
                position,
                rotation,
                scale
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                part.id,
                part.plugin,
                json.dumps(part.parameters),
                json.dumps(part.geometry),
                json.dumps(part.features),
                json.dumps(part.position),
                json.dumps(part.rotation),
                json.dumps(part.scale),
            ),
        )

        self.connection.commit()

    def get(self, part_id: str):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                plugin,
                parameters,
                geometry,
                features,
                position,
                rotation,
                scale
            FROM parts
            WHERE id = ?
            """,
            (part_id,),
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return PartState(
            id=row[0],
            plugin=row[1],
            parameters=json.loads(row[2]),
            geometry=json.loads(row[3]),
            features=json.loads(row[4]),
            position=json.loads(row[5]),
            rotation=json.loads(row[6]),
            scale=json.loads(row[7]),
        )

    def list_all(self):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                plugin,
                parameters,
                geometry,
                features,
                position,
                rotation,
                scale
            FROM parts
            ORDER BY id
            """
        )

        rows = cursor.fetchall()

        parts = []

        for row in rows:
            parts.append(
                PartState(
                    id=row[0],
                    plugin=row[1],
                    parameters=json.loads(row[2]),
                    geometry=json.loads(row[3]),
                    features=json.loads(row[4]),
                    position=json.loads(row[5]),
                    rotation=json.loads(row[6]),
                    scale=json.loads(row[7]),
                )
            )

        return parts

    def list_parts(self):
        return self.list_all()

    def delete(self, part_id: str):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            DELETE FROM parts
            WHERE id = ?
            """,
            (part_id,),
        )

        self.connection.commit()


part_store = PartStore()
