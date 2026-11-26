#!/usr/bin/env python3
import unittest
import prose_guard as G

NAME = "".join(chr(c) for c in (108, 105, 115, 97))


class T(unittest.TestCase):
    def test_name(self):
        self.assertTrue(G.has_name("xx" + NAME + "yy"))
        self.assertTrue(G.has_name("pre-" + NAME + "-post"))
        self.assertFalse(G.has_name("socialization"))
        self.assertFalse(G.has_name("user"))

    def test_blocks(self):
        bad = []
        G.scan_text("notes.md", "hello", bad)
        self.assertTrue(any("prose file" in x for x in bad))
        bad = []
        G.scan_text("a.js", "// " + ("word " * 30), bad)
        self.assertTrue(any("long comment" in x for x in bad))
        bad = []
        G.scan_text("tests/a.spec.js", "test('mail person@mail.test', () => {});", bad)
        self.assertTrue(any(x.endswith("email") for x in bad))
        bad = []
        G.scan_text("tests/a.spec.js", "test('mail a@example.com', () => {});", bad)
        self.assertFalse(any(x.endswith("email") for x in bad))
        bad = []
        G.scan_text("tests/a.spec.js", "test('a " + NAME + " case', () => {});", bad)
        self.assertTrue(any(x.endswith("name") for x in bad))
        bad = []
        G.scan_body("one line\n\nsecond", bad)
        self.assertTrue(any("more than one line" in x for x in bad))
        bad = []
        G.scan_body("<!-- hidden -->\nonly", bad)
        self.assertEqual(bad, [])
        bad = []
        G.scan_body("only\n<div><img alt=\"x\">&nbsp;</div>", bad)
        self.assertEqual(bad, [])
        bad = []
        G.scan_text("tools/prose-guard/patterns.txt", "owner", bad)
        self.assertEqual(bad, [])


if __name__ == "__main__":
    unittest.main()
