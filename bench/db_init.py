"""Apply bench/sql/schema.sql to the configured Postgres."""
from .db import init_schema

if __name__ == "__main__":
    init_schema()
    print("schema applied")
