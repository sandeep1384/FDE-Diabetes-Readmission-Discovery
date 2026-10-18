"""PostgreSQL connection configuration."""

import os
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv(Path(__file__).resolve().parent / ".env")


def connect() -> psycopg.Connection[dict[str, Any]]:
    """Open a database connection using DATABASE_URL."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg.Connection[dict[str, Any]].connect(
        database_url, row_factory=dict_row
    )
