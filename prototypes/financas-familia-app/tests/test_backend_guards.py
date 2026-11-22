from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / "supabase/migrations/20261121000100_financas_familia_core.sql").read_text(encoding="utf-8")
EDGE = (ROOT / "supabase/functions/audio-parse/index.ts").read_text(encoding="utf-8")


class BackendGuardrailTests(unittest.TestCase):
    def test_all_exposed_data_tables_enable_rls(self):
        tables = re.findall(r"create table public\.(\w+)", SQL, flags=re.I)
        self.assertTrue(tables)
        for table in tables:
            with self.subTest(table=table):
                self.assertRegex(SQL, rf"alter table public\.{table} enable row level security")

    def test_no_anon_table_access_and_household_fence_exists(self):
        self.assertIn("from anon", SQL.lower())
        self.assertIn("private.is_household_member", SQL)
        self.assertRegex(SQL.lower(), r"create policy entries_member_read[\s\S]*?using \(\(select private\.is_household_member\(household_id\)\)\)")
        self.assertIn("create policy entries_update_member", SQL)
        self.assertIn("entries_identity_immutable", SQL)

    def test_series_materializes_owned_rows_and_both_dates(self):
        self.assertIn("create or replace function public.create_entry_series", SQL)
        self.assertIn("if not private.is_household_member(p_household_id)", SQL)
        inserts = re.findall(r"insert into public\.entries\((.*?)\)\s*values\s*\((.*?)\);", SQL, flags=re.I | re.S)
        self.assertEqual(len(inserts), 2)
        for columns, values in inserts:
            with self.subTest(columns=columns):
                self.assertIn("created_by", columns)
                self.assertIn("occurred_on", columns)
                self.assertIn("due_on", columns)
                self.assertTrue(values.lstrip().startswith("p_household_id, auth.uid()"))

    def test_household_bootstrap_seeds_categories_and_realtime_is_conditional(self):
        for category in ("Alimentação", "Moradia", "Transporte", "Saúde", "Lazer", "Salário"):
            self.assertIn(category, SQL)
        self.assertIn("alter publication supabase_realtime add table public.entries", SQL)
        self.assertIn("security_invoker = true", SQL)
        self.assertIn("occurred_on, due_on", SQL)

    def test_audio_is_authenticated_bounded_and_draft_only(self):
        self.assertIn("/auth/v1/user", EDGE)
        self.assertIn("household_access_denied", EDGE)
        self.assertIn("MAX_AUDIO_BYTES = 10 * 1024 * 1024", EDGE)
        self.assertIn("requires_confirmation: true", EDGE)
        self.assertIn("due_on", EDGE)
        self.assertNotRegex(EDGE, r"\.from\([^)]*\)\.insert\(")
        self.assertNotIn("service_role", EDGE.lower())
        self.assertIn("OPENAI_API_KEY", EDGE)
        self.assertIn("store: false", EDGE)


if __name__ == "__main__":
    unittest.main()
