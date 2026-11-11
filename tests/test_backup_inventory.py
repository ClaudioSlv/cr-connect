import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("inventory", Path(__file__).resolve().parents[1] / "scripts/inspect-cr-backup.py")
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


class BackupInventoryTest(unittest.TestCase):
    def test_empty_copy_does_not_consume_next_table(self):
        dump = "COPY public.workshops (id) FROM stdin;\n1\n\\.\nCOPY public.clients (id) FROM stdin;\n\\.\nCOPY auth.users (id) FROM stdin;\n2\n\\.\n"
        self.assertEqual(inventory.inspect(dump.splitlines()), {"public.workshops": 1, "public.clients": 0, "auth.users": 1})

    def test_excludes_auth_sessions_and_rejects_truncated_backup(self):
        dump = "COPY auth.sessions (id) FROM stdin;\nprivate-session\n\\.\nCOPY public.workshops (id) FROM stdin;\n1\n\\.\nCOPY public.clients (id) FROM stdin;\n\\.\n"
        self.assertNotIn("auth.sessions", inventory.inspect(dump.splitlines()))
        with self.assertRaises(ValueError):
            inventory.inspect(["COPY public.workshops (id) FROM stdin;", "1"])


if __name__ == "__main__":
    unittest.main()
