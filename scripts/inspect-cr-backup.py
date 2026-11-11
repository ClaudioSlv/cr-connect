#!/usr/bin/env python3
"""Read a pg_dump text backup without executing SQL or printing personal data."""
import argparse
import gzip
import json
import re


def inspect(lines):
    tables = {}
    active = None
    for line in lines:
        line = line.rstrip("\r\n")
        if active is not None:
            if line == r"\.":
                active = None
            else:
                tables[active] += 1
            continue
        match = re.fullmatch(r"COPY (public\.[a-z_]+|auth\.users) \(.*\) FROM stdin;", line)
        if match:
            active = match[1]
            if active in tables:
                raise ValueError("Repeated COPY block")
            tables[active] = 0
        elif re.match(r"COPY .* FROM stdin;", line):
            # Skip other schemas without confusing their content with SQL.
            active = "__excluded__"
            tables[active] = 0
    if active is not None:
        raise ValueError("Incomplete COPY block")
    tables.pop("__excluded__", None)
    if "public.workshops" not in tables or "public.clients" not in tables:
        raise ValueError("CR Connect business tables were not found")
    return tables


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", help="PostgreSQL text dump, optionally gzip compressed")
    args = parser.parse_args()
    opener = gzip.open if args.backup.endswith(".gz") else open
    with opener(args.backup, "rt", encoding="utf-8") as source:
        print(json.dumps(inspect(source), indent=2, sort_keys=True))
