"""SQLite compatibility and identity constraints; no production records used."""
import pathlib
import sqlite3
import unittest

class IdentityMigrationTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript((pathlib.Path(__file__).parents[1] / 'd1/migrations/0001_identity.sql').read_text())
        self.db.execute("INSERT INTO app_users(id,email) VALUES ('u1','owner@example.com')")
        self.db.execute("INSERT INTO workshops(id,name) VALUES ('w1','Oficina A'),('w2','Oficina B')")
        self.db.execute("INSERT INTO workshop_users(workshop_id,user_id,role) VALUES ('w1','u1','admin')")

    def test_membership_is_scoped_to_workshop(self):
        query = 'SELECT 1 FROM workshop_users WHERE workshop_id=? AND user_id=?'
        self.assertIsNotNone(self.db.execute(query, ('w1', 'u1')).fetchone())
        self.assertIsNone(self.db.execute(query, ('w2', 'u1')).fetchone())

    def test_email_is_case_insensitive(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO app_users(id,email) VALUES ('u2','OWNER@example.com')")

    def test_invalid_role_and_missing_user_are_rejected(self):
        for user, role in [('u1', 'superadmin'), ('missing', 'admin')]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute('INSERT INTO workshop_users VALUES (?,?,?,CURRENT_TIMESTAMP)', ('w2', user, role))

    def test_deleting_user_revokes_sessions_and_membership(self):
        self.db.execute('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)', ('a'*64, 'u1', 2000000000))
        self.db.execute("DELETE FROM app_users WHERE id='u1'")
        self.assertEqual(self.db.execute('SELECT count(*) FROM auth_sessions').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT count(*) FROM workshop_users').fetchone()[0], 0)

    def test_plain_token_cannot_be_stored(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES ('secret','u1',2000000000)")

if __name__ == '__main__':
    unittest.main()
