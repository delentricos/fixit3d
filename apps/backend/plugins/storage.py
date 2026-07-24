import sqlite3
from .models import PluginMetadata


DATABASE = "plugins.db"


class PluginStorage:

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
            CREATE TABLE IF NOT EXISTS plugins (
                id TEXT PRIMARY KEY,
                name TEXT,
                version TEXT,
                category TEXT,
                status TEXT,
                description TEXT,
                author TEXT,
                capabilities TEXT
            )
            """
        )

        self.connection.commit()

    def save_plugin(self, plugin: PluginMetadata):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            INSERT OR REPLACE INTO plugins
            (
                id,
                name,
                version,
                category,
                status,
                description,
                author,
                capabilities
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                plugin.id,
                plugin.name,
                plugin.version,
                plugin.category,
                plugin.status,
                plugin.description,
                plugin.author,
                ",".join(plugin.capabilities),
            ),
        )

        self.connection.commit()

    def get_plugins(self):
        cursor = self.connection.cursor()

        cursor.execute(
            "SELECT * FROM plugins"
        )

        rows = cursor.fetchall()

        plugins = []

        for row in rows:
            plugins.append(
                PluginMetadata(
                    id=row[0],
                    name=row[1],
                    version=row[2],
                    category=row[3],
                    status=row[4],
                    description=row[5],
                    author=row[6],
                    capabilities=row[7].split(","),
                )
            )

        return plugins

    def delete_plugin(self, plugin_id: str):
        cursor = self.connection.cursor()

        cursor.execute(
            "DELETE FROM plugins WHERE id = ?",
            (plugin_id,),
        )

        self.connection.commit()