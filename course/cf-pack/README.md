# ClickFunnels Lesson Pack (v1, 23 Oct 2026)
Built from `scripts/modules/*.json` by `python build/cf_pack.py`. Do not edit lessons here; edit the module JSON and re-run.

## Files
- `lessons.csv`: one row per lesson for copy-paste (module, order, title, outcome, video slot, downloads)
- `lessons.json`: the full pack (body text, recap, quiz with answers)
- `lessons/<lesson-id>.md`: one page per lesson, ready to paste into a ClickFunnels lesson

## Setting up in ClickFunnels (nothing has been created or published)
1. Create the course and its 11 modules in the order of `lessons.csv`.
2. **Set the course Style explicitly** (Course settings, then Advanced Settings, then Style). Courses do not inherit the site Theme (ClickFunnels-Platform-Reference.md).
3. Per lesson: paste the body, add the recap card PNG and the workbook PDF as downloads, and add the 4 quiz questions.
4. Video: upload the MP4 to RoseQuest first (see `video/README.md`). Then store only provider + video id + type (v or f). Never paste a URL or embed code into the lesson record.
5. Access: buying applies a ClickFunnels tag that grants access, and cancelling removes it (BR-CF-BILLING). Single sign-in from an app needs the Dominate plan (BR-CF-SSO).
6. Resellers: one link per brand per plan, e.g. `/join/ppp?plan=plus-yearly`. A reseller brand is never on a Free plan.
