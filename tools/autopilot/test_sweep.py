import datetime as dt
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import sweep  # noqa: E402

POLICY = json.load(open(os.path.join(os.path.dirname(__file__), "..", "..", "merge-policy.json")))
TODAY = dt.date(2026, 11, 3)


def pr(**kw):
    base = dict(number=1, isDraft=False, baseRefName="main", headRefName="x", mergeable="MERGEABLE",
                mergeStateStatus="CLEAN", author={"login": "ljoyrose"}, files=[{"path": "docs/a.md"}],
                statusCheckRollup=[{"name": "tests", "status": "COMPLETED", "conclusion": "SUCCESS"}])
    base.update(kw)
    return base


def cls(p, heads=None, policy=POLICY, today=TODAY):
    return sweep.classify(p, policy, heads or {}, today)[0]


class T(unittest.TestCase):
    def test_clean_docs_merges(self):
        self.assertEqual(cls(pr()), "MERGE")

    def test_draft_skipped(self):
        self.assertEqual(cls(pr(isDraft=True)), "SKIP")

    def test_sensitive_needs_lisa(self):
        self.assertEqual(cls(pr(files=[{"path": ".github/workflows/x.yml"}])), "DO")
        self.assertEqual(cls(pr(files=[{"path": "merge-policy.json"}])), "DO")

    def test_scope_all_merges_site_files_but_docs_only_asks(self):
        self.assertEqual(POLICY["scope"], "all")
        self.assertEqual(cls(pr(files=[{"path": "index.html"}])), "MERGE")
        narrow = dict(POLICY, scope="docs-only")
        self.assertEqual(cls(pr(files=[{"path": "index.html"}]), policy=narrow), "DO")

    def test_conflict_and_red(self):
        self.assertEqual(cls(pr(mergeable="CONFLICTING")), "DO")
        red = [{"name": "tests", "status": "COMPLETED", "conclusion": "FAILURE"}]
        self.assertEqual(cls(pr(statusCheckRollup=red)), "DO")

    def test_privacy_red_is_flagged(self):
        r = [{"name": "Privacy guard", "status": "COMPLETED", "conclusion": "FAILURE"}]
        self.assertEqual(sweep.classify(pr(statusCheckRollup=r), POLICY, {}, TODAY)[1], "privacy guard failed")

    def test_pending_arms(self):
        p = [{"name": "tests", "status": "IN_PROGRESS", "conclusion": ""}]
        self.assertEqual(cls(pr(statusCheckRollup=p)), "ARM")

    def test_stack_waits_then_retargets(self):
        child = pr(baseRefName="parent-branch")
        self.assertEqual(cls(child, {"parent-branch": 5}), "WAIT")
        self.assertEqual(cls(child, {}), "RETARGET")

    def test_behind_updates(self):
        self.assertEqual(cls(pr(mergeStateStatus="BEHIND")), "UPDATE")

    def test_lapsed_approval_asks_everything(self):
        dated = dict(POLICY, expires_on="2026-12-02")
        self.assertEqual(cls(pr(), policy=dated, today=dt.date(2027, 1, 1)), "DO")

    def test_no_expiry_holds_until_stop(self):
        self.assertIsNone(POLICY["expires_on"])
        self.assertEqual(cls(pr(), today=dt.date(2040, 1, 1)), "MERGE")

    def test_private_repo_waits_instead_of_arming(self):
        p = [{"name": "tests", "status": "IN_PROGRESS", "conclusion": ""}]
        self.assertEqual(sweep.classify(pr(statusCheckRollup=p), POLICY, {}, TODAY, auto_merge=False)[0], "WAIT")

    def test_dependabot_never_automatic(self):
        self.assertEqual(cls(pr(author={"login": "dependabot[bot]"})), "DO")

    def test_parents_ordered_before_children(self):
        a = pr(number=9, headRefName="a")
        b = pr(number=3, headRefName="b", baseRefName="a")
        self.assertEqual([p["number"] for p in sweep.order([b, a])], [9, 3])


if __name__ == "__main__":
    unittest.main()
