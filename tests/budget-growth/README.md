# Page-size growth files

One small JSON file per PR that makes a page heavier. Do not edit the base numbers in the two `job35*-a11y-budget` specs.

    {"home": 3000, "why": "what grew, and the PR number"}

Keys are page names used in those specs (home, cdhub, factory, food, marketplace, money, studio, privacy). Bytes, not percent.
The test adds every file to the base and allows +10% as before. Two PRs add two files, so they do not conflict.
Better still: load new code only when its page opens (see estate/donq.js) and you may need no file at all.
