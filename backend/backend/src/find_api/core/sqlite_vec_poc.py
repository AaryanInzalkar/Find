"""
SQLite + sqlite-vec proof of concept.

This module is intentionally isolated from the production PostgreSQL path.
It exists only to evaluate whether sqlite-vec can support desktop mode.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import sqlite_vec


def create_connection(db_path: str | Path = ":memory:") -> sqlite3.Connection:
    """
    Create SQLite connection and load sqlite-vec.
    """
    conn = sqlite3.connect(str(db_path))

    conn.enable_load_extension(True)
    sqlite_vec.load(conn)

    return conn


def create_schema(conn: sqlite3.Connection, embedding_dim: int) -> None:
    """
    Create a minimal schema that mirrors Find search requirements.
    """

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY,
            filename TEXT NOT NULL,
            status TEXT NOT NULL
        )
        """
    )

    conn.execute(
        f"""
        CREATE VIRTUAL TABLE IF NOT EXISTS media_vectors
        USING vec0(
            media_id INTEGER PRIMARY KEY,
            embedding FLOAT[{embedding_dim}]
        )
        """
    )

    conn.commit()

# """
# SQLite + sqlite-vec proof of concept for desktop runtime evaluation.

# This module intentionally remains isolated from the production
# PostgreSQL + pgvector runtime.

# Goals:
# - Validate SQLite metadata storage
# - Validate sqlite-vec vector storage
# - Validate 768-dimensional embedding search
# - Validate gallery/search query shapes
# """

# from __future__ import annotations

# import sqlite3
# from pathlib import Path
# from typing import Any

# import sqlite_vec

# EMBEDDING_DIM = 768


# class SQLiteVecPOC:
#     def __init__(self, db_path: str | Path):
#         self.db_path = str(db_path)

#     def connect(self) -> sqlite3.Connection:
#         conn = sqlite3.connect(self.db_path)

#         conn.enable_load_extension(True)
#         sqlite_vec.load(conn)

#         return conn

#     def create_schema(self) -> None:
#         with self.connect() as conn:
#             conn.execute(
#                 """
#                 CREATE TABLE IF NOT EXISTS media (
#                     id INTEGER PRIMARY KEY,
#                     filename TEXT NOT NULL,
#                     status TEXT NOT NULL
#                 )
#                 """
#             )

#             conn.execute(
#                 f"""
#                 CREATE VIRTUAL TABLE IF NOT EXISTS vec_media
#                 USING vec0(
#                     embedding float[{EMBEDDING_DIM}]
#                 )
#                 """
#             )

#             conn.commit()

#     def insert_media(
#         self,
#         media_id: int,
#         filename: str,
#         embedding: list[float],
#         status: str = "indexed",
#     ) -> None:
#         if len(embedding) != EMBEDDING_DIM:
#             raise ValueError(
#                 f"Expected embedding length {EMBEDDING_DIM}, "
#                 f"got {len(embedding)}"
#             )

#         with self.connect() as conn:
#             conn.execute(
#                 """
#                 INSERT OR REPLACE INTO media (
#                     id,
#                     filename,
#                     status
#                 )
#                 VALUES (?, ?, ?)
#                 """,
#                 (media_id, filename, status),
#             )

#             conn.execute(
#                 """
#                 INSERT OR REPLACE INTO vec_media(
#                     rowid,
#                     embedding
#                 )
#                 VALUES (?, ?)
#                 """,
#                 (
#                     media_id,
#                     sqlite_vec.serialize_float32(embedding),
#                 ),
#             )

#             conn.commit()

#     def search(
#         self,
#         query_embedding: list[float],
#         limit: int = 10,
#     ) -> list[dict[str, Any]]:
#         if len(query_embedding) != EMBEDDING_DIM:
#             raise ValueError(
#                 f"Expected embedding length {EMBEDDING_DIM}, "
#                 f"got {len(query_embedding)}"
#             )

#         query_blob = sqlite_vec.serialize_float32(query_embedding)

#         with self.connect() as conn:
#             rows = conn.execute(
#                 """
#                 SELECT
#                     m.id,
#                     m.filename,
#                     m.status,
#                     v.distance
#                 FROM vec_media v
#                 JOIN media m
#                     ON m.id = v.rowid
#                 WHERE v.embedding MATCH ?
#                 ORDER BY v.distance
#                 LIMIT ?
#                 """,
#                 (query_blob, limit),
#             ).fetchall()

#         return [
#             {
#                 "id": row[0],
#                 "filename": row[1],
#                 "status": row[2],
#                 "distance": float(row[3]),
#             }
#             for row in rows
#         ]

#     def gallery_query(self) -> list[dict[str, Any]]:
#         with self.connect() as conn:
#             rows = conn.execute(
#                 """
#                 SELECT
#                     id,
#                     filename,
#                     status
#                 FROM media
#                 ORDER BY id
#                 """
#             ).fetchall()

#         return [
#             {
#                 "id": row[0],
#                 "filename": row[1],
#                 "status": row[2],
#             }
#             for row in rows
#         ]