<!-- Copy of the Drive master AA_BLD-SCHEMA_2026-11-15-0637__CLAUDE-CODE.md (version 2, 15 Nov 2026). The Drive file wins if they differ. Staff names removed for this public repo. -->

# BLD SCHEMA: the living schema for the CD Hub and the cross-industry compliance brick
Version 1, 13 Nov 2026, 21:12 UK. Written by Claude Code (schema harvest helper for OVERSEER 10), at Lisa's request ("do all 3 ... full notes in logical position ready for the build as cross agent", 13/11 21:05 UK).
Version 2, 15 Nov 2026, 06:37 UK (add only): catch-up of Lisa's 15 Nov answers, live tables and statuses in section 20; section 19 counts replaced by 20.7. Version 1 kept as ZZ_SUPERSEDED_AA_BLD-SCHEMA_2026-11-13-2112__CLAUDE-CODE.md.

## 0. Read this first

**Purpose.** One place that lists every table the CD Hub and the compliance brick use or plan to use. For each table it gives the status, the columns, the Regulatory Core (RC) equivalent, a neutral-name check and the source. It also holds the decision log, the improvements over earlier designs and the open questions. The brick must slot into any industry (dogs, food, care, electrical...). Industry things are rows, never table or column names.

**Master-file rule.** This Drive file is the master. The repo copy (planned: an ADMIN PR into ljoyrose/dashboard) and every session note are copies. If a copy disagrees with this file, this file wins. Fix the copy, never the other way round.

**How to update.**
1. Add a dated line to section 14 (Decision log) the same day a decision is made, with the source (session, file, UK time, Lisa's words where possible).
2. Change a table's entry in place only for its status or for columns that went live. Add `(changed DD/MM/YY: why)` after the change.
3. Never rewrite history. A reversed decision gets a new dated line that names the old one; the old line stays.
4. Never rename a live table or column (RC platform fact 4: a rename destroys every row and still reports success; STANDARD S4.6). Record an **alias** in the "Neutral name" column instead.
5. New files: AA_<PROJECT>_<YYYY-MM-DD-HHMM>__CLAUDE-CODE.ext, UK time. Old files are kept.

**Owner sessions** (re-point list, OVERSEER handover 10, 13 Nov 2026):

| Area | Session | Owns |
|---|---|---|
| Lisa's questions, sign-off of this file | OVERSEER 10 (successor of local_9b6fdbc5-...) | asks Lisa one at a time, records answers here |
| People & access, external access (hub) | ADMIN local_aca4430f-d2a0-4982-b0e3-edc52ea26ff8 | sections 2, 3; repo copy of this file |
| Save script (.gs), live headers | STAFF local_5d62fbae-39d8-476f-99b0-006cc37778dd | every header change, Specs.gs |
| Jobs and checks, SOP links | SOPJOBS local_0f082f40-7bbc-4ed9-a5dd-c25e75daf3e7 | sections 4, 5 |
| Compliance page, obligations, verdicts | COMPLIANCE (session id in AA_COMPLIANCE_2026-11-13-2018) | sections 6, 7 |
| Readings | TEMPS local_d956fb53-abc0-4d5a-a29f-7e47d73616da | section 9 |
| Dogs, rooms, room limits | DOGCARD local_8bc604a2-f20e-477f-b3a9-591845aad17d | section 10 |
| Breed Better, evidence files | BB local_329301b0-6f01-4b81-8b4b-bbcaa8125313 | section 8, kit rules |
| SOP index, staffing | SOPS local_cced44eb-0592-49da-ad87-87bd97a259a4 | section 5 |

**Where things live.**
- Live tables: Shared drive `2 - Red - Risks` / `*01 SLA Inspections` / `BLD-app-tables` (Google Sheets titled `BLD-<table>.csv`, plus some plain CSV files). Write only there. Never the AF-BACKUPS copies (same names).
- Save script and table specs: repo `cdhub-write/apps-script/` on origin/main (Specs.gs, Inspect.gs, Auth.gs, Codes.gs, Dogcard.gs, Config.gs).
- Regulatory Core (proposed, 83 tables, 7 Nov 2026): this folder, `Regulatory-Core__Full-Schema-Reference__2026-11-07.txt` and the REV4 completion package.
- The BLD design (bld-schema.js, 23 Sep 2026, 166 tables, design only): `Cf overskill/4 - Apps/Breed Better/4 - Build/4.1 - Spec & tables/BLOODLINE-LIVE-SCHEMA.md`.

## 1. Rules every table follows

| # | Rule | Source |
|---|---|---|
| R1 | No industry or purpose words in core table or column names. Industry things are rows (kit rows). | Lisa 13/11 15:41 UK and 21:05 UK; OV9 rules 13 Nov |
| R2 | No hard-coded rules. Limits, timings, grades, lists and defaults are dated rows with a `source`. A past record is judged by the row in force on its own date. | Lisa 8 Nov, 12 Nov ("every limit is a dated row"); memory no-hard-coded-rules |
| R3 | Things carry no dates. Links and states carry `from_date`, `to_date` (inclusive, YYYY-MM-DD, blank `to_date` = no end). Meaning is a row value, never a column name. | Lisa 11 Nov "A standard" (SPEC-need-rows-A) |
| R4 | Window date-times are allowed where hours matter: `usable_from` / `usable_to` (RC names; live V9 code calls them `starts_at` / `ends_at`). | Lisa 13/11 20:20 UK (unannounced visits); RC map 13 Nov |
| R5 | Remove means end: fill `to_date` (or `ended_at`) plus a reason. Never delete a row. A change is a new row. No `ZZ_` renames to retire. | Lisa 13/11 15:37 UK; SPEC-need-rows-A |
| R6 | Never rename a live table or column. Record an alias here. New columns go at the end and are optional. | RC platform fact 4; STANDARD S4.1, S4.6 |
| R7 | `id`, `tenant_id` are the first two columns of every tenant table. A reference is a text column holding another row's id. | BLD README 24 Sep; S4.11 |
| R8 | Records are append-only. A correction is a new row with `corrects_id`. The owner's in-place edit is a separate, switched action. | Specs.gs header; Config.gs OWNER_EDIT_ENABLED |
| R9 | Every new table has its own switch `TABLE_ON_<key>`, OFF by default. Live header changes need Lisa's yes typed in the writing session. | Config.gs; OVERSEER rules |
| R10 | No secret in any table. Codes and hashes stay in Script Properties. Tables hold public ids only (`code_id`, `sign_in_id`). | Auth.gs, Codes.gs; skill codes-are-credentials |
| R11 | A QR or card only opens the right screen. It proves nothing. | skill qr-opens-not-proves |
| R12 | Retention is user-set per section (dated rows). With no row: the legal period if one is recorded, else 6 years. | Lisa 9 Nov (W4 decision 16) |

Date words already live that break R3 stay as they are (R6) and are read alongside the new words: `effective_from` (breeding_rule, check_type, check_field, score_scheme), `started_on`/`ended_on` (person_role), `valid_from`/`is_active` (score_enrolment), `moved_in`/`moved_out` (occupancy), `active` flags (check_type, check_field, qr_tag). RC's `effective_from`/`effective_to` = our `from_date`/`to_date` (OV10 13 Nov, from Lisa's 11 Nov standard).

**Status words used below.**
- **LIVE**: the file exists in BLD-app-tables (and, where it is written, Specs.gs or another .gs on origin/main has its spec).
- **BUILT-NOT-LIVE**: code exists (open PR branch, or on main) but the live file or columns do not exist yet. `main, no file` = merged code, file not created.
- **DESIGNED**: in a session note or the BLD design, no code.
- **PROPOSED**: only in Regulatory Core or a kit/brick catalogue, no CD Hub design yet.

**Source keys.** SPECS = origin/main Specs.gs. INSPECT, AUTH, CODES, DOGCARD, CONFIG = the .gs files on origin/main. V9 = branches `claude/visit-server` and `claude/visit-delegation` (PR 546/547, held). ACCESS = AA_ACCESS_2026-11-13-1535. SCHEMA = AA_SCHEMA_2026-11-13-1610. EXT = AA_EXTACCESS_2026-11-13-2015. VAPI = AA_VISIT-API_2026-11-13-2034. STAFF45 / STAFF22 = AA_STAFF_2026-11-13-2045 / -2200. COMPL = AA_COMPLIANCE_2026-11-13-2018. GAPS = COMPLIANCE-gaps-plan / -log. MAINT = MAINTENANCE-records-research-2026-11-12. FILES = ONE-FILE-STORE-proposal. NEEDS = SPEC-need-rows-A. BLDD = BLOODLINE-LIVE-SCHEMA.md. RC = Regulatory-Core Full Schema Reference. K08 = BRICK-KITS v1.2 row K08. All session notes are in `~/Library/Application Support/Claude/side-session-notes/local_e3a9b24f-.../` unless the inventory says otherwise.

---

## 2. People & access

Shape (ACCESS): person (who) -> sign-in (how) -> role held (what, from when) -> permission rows (what a role or person may do, from when). Devices say which sign-in methods work where. Every change is an audit_log line. Every saved record carries `sign_in_id`.

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| person | LIVE | live (41 cols, STAFF45) include id, tenant_id, full_name, known_as, email, email_alt, phone, phone_alt, preferred_contact, visibility, visible_from, visible_to, visibility_set_by. SPECS writes only id, tenant_id, full_name, known_as (enquiries; header mismatch flagged, LISA-QUEUE 27) | Party | OK. `visible_from/visible_to` break R3 (dates on a thing); keep, read as legacy | SPECS; STAFF45 |
| person_role | LIVE (plain CSV) | id, tenant_id, person_id, household_id, role_code, scope_table, scope_id, audience_id, started_on, ended_on, granted_by, notes | PartyRole / PersonRole | `household_id` is a kit word (alias `group_id`); `started_on/ended_on` = from_date/to_date | ACCESS (live header read) |
| role | LIVE | id, tenant_id, code, name, can_sign_off, notes. Rows OWNER, STAFF, VET, TRAINER | AccessRole | OK. `can_sign_off` is a can_* flag: move to permission rows (action sign_off), keep column | STAFF45; JOB4 map note |
| audience | LIVE (plain CSV) | id, code, name, description, is_signed_in, rank, notes (no tenant_id) | Audience (control plane) | Descriptions contain kit words (puppy, animal): rows, so allowed | STAFF45; ACCESS |
| field_visibility | LIVE | id, tenant_id, table_name, field_name, audience_id, visible, condition, redaction, set_by, set_on, reason (approx.; ~303 rows). + `from_date, to_date` DESIGNED (Lisa 6/19 yes) | FieldVisibility | OK | CONFIG; READ; ACCESS Q6 |
| table_policy | LIVE (73 rows, not read by any script) | id, tenant_id, table_name, table_kind, default_row_visibility, rows_carry_own_visibility, row_visibility_column, who_may_read_by_default, who_may_write_by_default, overskill_access_mode, reason, set_by, set_on | TablePolicy (+ AccessModeRegister) | `overskill_access_mode` names a platform: alias `platform_access_mode` (RC word) | JOB4 proposed rows csv |
| code_register | BUILT-NOT-LIVE (main, no file) | id, tenant_id, code_id, who, role, from_date, to_date, ended_by. Never a code or hash | AppUser / AppUserRole | OK. Becomes sign_in rows (method LONG_CODE), then ends | CODES |
| sign_in | DESIGNED | id, tenant_id, person_id, method, label, device_scope, scope_table, scope_id, card_tag_id, from_date, to_date, ended_by, end_reason. Secret hashed in Script Properties keyed by sign_in.id | AppUser + CaptureSession.token_hash rule | OK | ACCESS 1-2, Lisa 2/12; visitor card |
| sign_in_method | DESIGNED | id, tenant_id, code, name, needs_pin, on, from_date, to_date, notes. Rows LONG_CODE, NAME_PIN, CARD, CARD_PIN, PASSKEY(off), LINK, VISITOR_CARD, IMPORT | (none; RC GrantRight-style reference rows) | `on` is a bare flag: prefer dated rows (R3). Suggest `is_on` only if kept | ACCESS |
| device | DESIGNED | id, tenant_id, label, mode (shared/personal), area_id, methods, last_seen_at, from_date, to_date, lost_on, ended_by | none | **Clash**: area_reading.device_id (live) already means the reading instrument. Alias proposal: `sign_in_device` for this table | ACCESS |
| permission | DESIGNED | id, tenant_id, role_code, person_id, table_name, scope_table, scope_id, action (see/add/change/sign_off/view/download/print/export/comment), allowed, from_date, to_date, set_by, reason | Permission + RolePermission (+ GrantRightLink for outsiders) | OK (BR-TENANCY floor name) | ACCESS (RC fold, SCHEMA fold 4) |
| delegation | BUILT-NOT-LIVE (V9 visit-delegation) | id, tenant_id, power, holder_person_id, holder_code_id, holder_sign_in_id, parent_id, depth_left, from_at, to_at, visit_type_ids, max_hours, rights, lists, fields, area_ids, subject_ids, end_others, extend_others, ended_at, ended_by, end_reason, end_issued, conferred_by, conferred_at, source, notes | none (RC only grantor_person_id; nearest PositionOccupancy acting) | `visit_type_ids` inherits the visit clash (alias `grant_type_ids`); pipe lists vs RC scope rows: see Q-C1 | STAFF22; ACCESS "Delegated admin" |
| staff | DESIGNED (Specs.gs PROPOSED_TABLES, refused) | id, tenant_id, person_id, role, employment, started_on, ended_on, corrects_id | PositionOccupancy | `role` text duplicates person_role: drop role (SCHEMA a) | SPECS |
| household | LIVE (enquiries kit) | id, tenant_id, name, primary_person_id, stage | (none) | kit table (a buyer group); `stage` values are rows | SPECS |
| household_member | LIVE (enquiries kit) | id, tenant_id, household_id, person_id | (none) | kit table | SPECS |

PROPOSED (RC only, no CD Hub design): PartyType, ContractorOrganisation (an organisation as a party: see section 6 party), OrgUnit, Position, PositionOccupancy, ReportingLine, Accountability.

Server rules agreed (STAFF, ACCESS): permission rows judged on the SERVER date, never taken_at; most specific wins (person+scope, role+scope, role table, then today's code perms); at one level allowed=no beats yes; per-job idle sign-out and method checked on the server; giving a visit needs a live delegation row (owner excepted), limits intersect up the chain.

## 3. External access and disclosure (inspectors, vets, auditors, guests, visitor cards)

One shape for every outsider; the kind is a role row, never a column. RC calls this a DisclosureGrant. Our live table name stays `inspect_link` (R6); not-yet-live columns take RC names now while they are free (ACCESS RC map).

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| inspect_link | LIVE (V1 header) + V9 columns BUILT-NOT-LIVE | Live V1: id, tenant_id, code_id, label, ends, made_at, made_by. Main reads V9 short form (+ starts_at, ends_at, data_from_date, data_to_date). V9 bundle (STAFF22, 30 cols): + visit_type_id, person_id, visitor_name, organisation, sign_in_id, card_tag_id, rights, lists, record_jobs, record_counts, email_code, ended_at, ended_by, end_reason, id_checked_by, accompanied_by, tz, issued_by, delegation_id | DisclosureGrant (usable_from/to, as_of_from/to, revoked_at/by, revoke_reason, purpose_text, grant_basis, identity_assurance, retention_until, supersedes_id, grantor_person_id) | "inspect" is a purpose word: alias **`grant`** (`disclosure_grant`). Not-live columns should take RC names: see Q-C1 | INSPECT; V9; STAFF22; ACCESS RC map |
| inspect_link_subject | LIVE | id, tenant_id, link_id, subject_id, from_date, to_date | DisclosureGrantScope.scope_resource_id | alias `grant_subject` | INSPECT |
| inspect_link_field | LIVE | id, tenant_id, link_id, table_name, field_name, redaction ('' or last4) | FieldVisibility per grant | alias `grant_field` | INSPECT |
| inspect_access | LIVE | id, tenant_id, link_id, code_id, table_name, rows, at. + sign_in_id DESIGNED (Q7 yes) | none (RC only a flag grant_read_log_required) | alias `grant_read_log` | INSPECT; STAFF45 |
| visit_type | BUILT-NOT-LIVE (V9) | id, tenant_id, type_key, name, role_code, default_hours, max_hours, rights, lists, fields, data_years, record_jobs, record_counts, email_code, needs_id_check, terms_id, active, effective_from, set_at, set_by, source | none (ours: grant presets) | **Clash**: live BLD-visit = vet visits (705 rows). Name before it goes live: `grant_type` (Q-N2). `active` + `effective_from` break R3 | VAPI; STAFF22 |
| qr_tag | LIVE | id, tenant_id, tag, kind (area, subject, litter, site, thermometer; + visitor_card designed), ref_id, active, made_at, made_by. + fixed_type_id BUILT-NOT-LIVE | CaptureSession token rule (opaque tag only) | kind values `litter`, `thermometer` are kit words but are row values: OK. `active` breaks R3 | SPECS; VAPI |
| inspect_link_scope | DESIGNED | id, tenant_id, link_id, scope_item_type, disclosure_state (withheld, existing_only, summary, record, record_and_evidence; default withheld), depth_limit, withhold_basis, is_active | DisclosureGrantScope | name before live: `grant_scope` | ACCESS RC map |
| grant_right | DESIGNED | code, label, is_active, sort (rows: view, raise_finding "Review", print, export, record, comment, sign_off) | GrantRight | OK | ACCESS RC map |
| inspect_link_right | DESIGNED | id, tenant_id, link_id, grant_right_code, scope_summary (e.g. type_key), counts_due, is_active | GrantRightLink | name before live: `grant_right_link` | ACCESS RC map |
| attestation_text_version | DESIGNED (G3 yes) | text_version_id, attestation_text, approved_by, approved_on, from_date, to_date, rule_id, source, status. Acceptance = an inspect_access row with text_version_id | AttestationTextVersion | OK | EXT G3; ACCESS RC map |

PROPOSED (RC only): PublicRecordView (a redacted public projection; promote only when an approved projection exists).

Rule rows used (no hard-coded lengths): `external.default_hours.<role>`, `external.max_hours.<role>` (on main, INSPECT), and designed `external.email_code`, `external.notify_owner`, `external.watermark`, `external.first_use_hours`, `external.max_opens` scoped to a grant. Law: SI 2018/486 Sch.2 para 2, records available in a visible and legible form for 3 years: a link is a convenience; the full export must also exist (EXT).

## 4. Jobs and checks

`check_type` is the one job list (any compliance item or SOP step becomes a job by a row). `check_log` is each record. Readings, placements and room access are not jobs yet; they get table-level permission rows (ACCESS fold 1).

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| check_type | LIVE (4 seed rows; 42 confirmed rows not loaded) | id, tenant_id, type_key, label, target (area, dog, either, optional, none, litter), asks_item, item_label, asks_amount, amount_unit, note_label, note_required, asks_outcome, frequency, active, effective_from, source, note, set_at, set_by, every_days, group, includes, sop, evidence (none/optional/required), site_scope (one_line/per_dog), not_in_areas, only_in_areas | Checklist + ChecklistVersion + RecurrenceRule | target values `dog`, `litter` should be `subject`, `group` in new rows (Q-N5). `frequency` text duplicates `every_days`. `group` is a reserved-ish word (S1 "category" reserved; check). Pipe lists `includes/not_in_areas/only_in_areas` duplicate requirement rows (SCHEMA b8) | SPECS; SOPJOBS-plan |
| check_field | LIVE | id, tenant_id, type_key, field_key, label, kind, choices, required, sort, active, effective_from, set_at, set_by | ChecklistItem | OK (`active` breaks R3) | SPECS |
| check_value | LIVE | id, tenant_id, check_log_id, check_field_id, field_key, value | ChecklistResponse (per item) | OK. Takes its check_log row's sign_in_id | SPECS |
| check_log | LIVE | id, tenant_id, check_type_id, area_id, subject_id, item, amount, outcome (ok/concern/not_done/recorded/...), happened_at, note, taken_at, taken_by, corrects_id, photo, how_recorded, litter_id, note_for_id. + visit_id, counts_due BUILT-NOT-LIVE (V9). + sign_in_id DESIGNED (Q7 yes) | ChecklistResponse / DoTask completion | `litter_id` is a kit word (alias `group_id`). `visit_id` should be `grant_id` before live (Q-N2). `photo` becomes a file id (section 8) | SPECS; STAFF22 |
| occupancy_check | LIVE | id, tenant_id, confirmed_at, confirmed_by, dog_ids, moved_count, note | ChecklistResponse | `dog_ids` is a kit word (alias `subject_ids`). SCHEMA: becomes a check_log row type later | SPECS |
| assignment | DESIGNED | id, tenant_id, scope_table, scope_id, assignee_table (person/role/shift), assignee_id, from_date, to_date, set_by, reason | **Clash**: RC Block 9 `Assignment` = person to shift | Rename before live: `job_assignee` or `duty_assignment` (Q-N6) | ACCESS "Links" |
| shift | DESIGNED | id, tenant_id, name. Days and times are rule rows `shift.days/start/end`; members are person_role rows (SHIFT_MEMBER) | Shift (Block 9 reserved) | OK | ACCESS |
| checklist_template, checklist_template_item, checklist_instance, checklist_item, checklist_trigger | LIVE (shape-only draft rows; load list only, no screen) | template: name, version, origin, sop_version_id, applies_to, recurrence...; item: text, evidence_required, blocking, unit, limit_min, limit_max...; instance: template_id, subject_type, subject_id, due_on, completed_at...; trigger: trigger_kind, on_event, schedule... (BLDD) | ChecklistTemplate / ChecklistVersion / ChecklistItem / ChecklistResponse | OK names. **Superseded** by check_type/check_log (8 Nov design): end, never delete (Q-C6) | MAINT; BLDD |
| daily_check | DESIGNED (BLDD only) | subject_id, performed_on, performed_by, identification_ok, card_present, cabin_matches_card... | ChecklistResponse | kit columns (`cabin`, `card`); superseded by check_type rows | BLDD |
| round_event | RETIRED (never live) | kept in Specs.gs RETIRED_TABLES | none | n/a | SPECS |

Completion rule rows (designed): `job.completion` = once_any | once_each | n_distinct, `job.completion_n`, scoped `check_type/<type_key>`. Who still owes a job is worked out, never stored. Duplicate guard must include taken_by (V9, A1).

PROPOSED (RC only): ChecklistShare, RecurrenceRule (as a table), DoTask, Schedule, Availability, ConflictRule.

## 5. SOPs and governance

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| sop | LIVE (stale; not used by code) | BLDD: code, title, category, owner, current_version_id, review_due | Resource (resource_type procedure) | "SOP" is a general business word: OK. `category` is reserved in S1 | BLDD; SCHEMA |
| sop_version | LIVE (stale) | BLDD: sop_id, version, effective_from, effective_to, document_id, body, changed_by, change_reason, status, audited_by, audited_on | Resource.resource_version / ChecklistVersion | OK | BLDD |
| sop_acknowledgement | LIVE (unused) | BLDD: sop_version_id, staff_id, acknowledged_on, method (live header not read) | Assessment / SignOffRecord (read-and-sign) | `staff_id` should be `person_id` if the live header has it (staff table never went live) | BLDD |
| governed_by | LIVE (empty) | id, tenant_id, record_type, record_id, sop_version_id, notes. + from_date, to_date, source, set_by DESIGNED (SOPJOBS agreed) | EvidenceLink / CompetencyResource | OK. Row `record_type=check_type, record_id=<type_key>` = the SOP version a job follows | ACCESS (SOPJOBS) |
| sop_cards.json | LIVE (a file, not a table) | SOP card wording for the hub | Resource body | n/a | BLD-app-tables |
| declaration | LIVE (header only) | not read (BLDD has no declaration table) | AttestationTextVersion / Obligation | check header | MAINT |
| deviation | LIVE (header only) | id, tenant_id, declaration_id, checklist_item_id, subject_id, area_id, noticed_on, noticed_by, what_happened, declared_was, actual_was, action_taken, action_by, action_on, recheck_due, recheck_done_on, closed, severity_set_by_tenant, notes | Finding (self-detected) + FindingResponse | OK names; edits-in-place shape conflicts with append-only (MAINT) | MAINT |
| verification | LIVE (header only) | id, tenant_id, declaration_id, verified_on, verified_by, method, period_from, period_to, records_expected, records_found, deviations_open, still_fit_for_purpose, changes_made, notes | Inspection (kind internal review) | OK | MAINT |
| staff_duty | DESIGNED (BLDD) | code, title, description, sop_version_id | Competency | `staff_` prefix: alias `duty` | BLDD |
| staff_competency | DESIGNED (BLDD) | staff_id, duty_code, level, assessed_on, assessed_by, evidence_document_id, cpd_hours, next_review, signature_media_id | Assessment | alias `competency_assessment`; person_id not staff_id | BLDD |
| staff_training | DESIGNED (BLDD) | staff_id, topic, provider, completed_on, expires_on, certificate_document_id | CPDActivity / CredentialVersion | alias: a credential_version row of type training | BLDD |

PROPOSED (RC only): CompetencyLibrary, Competency, CompetencyResource, RoleCompetency, PersonRequirement, Assessment, CPDPeriod, CPDActivity, Resource, CompetencyPrerequisite (Block 9).

## 6. Requirements and compliance

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| requirement | LIVE (need rows) | id, tenant_id, need_type (reading.temperature, room.in_use, ...), target_table, target_id, from_date, to_date, source, set_by, set_on. COMPL: + obligation_id, party_role DESIGNED | RuleScope / EngagementRequirement (applies-to) | OK. Note: means "needed / in use on these days", not a legal requirement. A row target_table=check_type says a job meets that need | SPECS; NEEDS |
| credential | LIVE (header only) | id, tenant_id, label, area_id, sop, crucial, issuer, source | Credential (holder_type, holder_id, credential_type, renewal_rule_id, issuing_body) | OK. Never reuse "credential" for sign-in | GAPS |
| credential_version | LIVE (header only) | id, tenant_id, credential_id, from_date, to_date, source, set_by, set_on | CredentialVersion / GovernedPeriod | OK | GAPS |
| jurisdiction | LIVE (not read) | not read | Jurisdiction | OK | folder list |
| authority | LIVE (not read) | not read | Party (issuer) / FindingIssuer | OK | folder list |
| kpi, tenant_kpi | LIVE (not read) | not read; BLDD metric_definition/metric_target are the design | (none) | OK | folder list |
| reminder | LIVE (4 rows) | not read | NotificationPreference / Obligation.lead_days | OK | MANIFEST |
| frequency | LIVE (not read) | not read | RecurrenceRule | OK | folder list |
| source | DESIGNED | id, kind (law, regulation, licence, permit, code_of_practice, standard, contract, policy, insurer_wording), title, reference, jurisdiction_id, issuer_party_id, url_or_file_id, from_date, to_date, replaced_by_id | RequirementSource | OK | COMPL 4.1 |
| obligation | DESIGNED | id, source_id, clause, plain_words, owner_role, risk, statutory, from_date, to_date | Obligation (RC: per-party due item) | OK | COMPL 4.2 |
| verdict | DESIGNED (parked, H-09) | obligation_id or rule_id, target_table, target_id, as_at, result (met / not met / not set / not checked), reason, rule_row_ids, evidence_ids, computed_on, computed_by. Never edited | ComplianceAssessment | OK | COMPL 4.8; GAPS 7 |
| party, party_link | DESIGNED | party: id, kind (person/organisation), name, jurisdiction_id. party_link: party_id, role, target_table, target_id, from_date, to_date | Party / PartyRole / ContractorOrganisation / EngagementParty | Overlaps person/person_role: Q-C9 | COMPL 4.5 |
| licence_condition | DESIGNED (BLDD) | pack_version_id, jurisdiction, condition_ref, wording, category, evidence_required, effective_from, effective_to | Obligation + RequirementSource | "licence" is generic enough; superseded by obligation | BLDD |

PROPOSED (RC only): ReassessmentRun (what a rule change does to past verdicts), Engagement, EngagementRequirement, EngagementParty, GovernedPeriod, SubjectClassification, NotificationPreference, EscalationPolicy, EscalationStep.

The worked example (COMPL 5) is the test that the brick is industry-free: fire extinguishers serviced yearly by a competent firm with insurance, written only as source, obligation, rule, party, evidence, check and verdict rows.

## 7. Findings and sign-off

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| finding | LIVE (header only) | id, tenant_id, inspection_id, declaration_id, outcome_id, authority, raised_on, wording_as_given, finding_kind, tenant_response, action_agreed, due_on, closed_on, evidence_document_id, notes. + target_table, target_id, sign_in_id, raised_at, replies_to_id, visit_id BUILT-NOT-LIVE (V9) | Finding (+ level green/amber/red, issuer_party_id, recurs_from_finding_id, supersedes_finding_id) | `visit_id` -> `grant_id`; `replies_to_id` vs RC FindingResponse (Q-C1) | STAFF45; STAFF22 |
| inspection | LIVE (header only) | id, tenant_id, kind (external/internal), authority, inspection_date, outcome_summary, visibility (private/disclosable), source | Inspection (+ is_rehearsal, as_of_from/to, scope_subjects) | OK | GAPS |
| outcome | LIVE (not read) | not read (finding.outcome_id points here) | VocabularyItem | OK | folder list |
| status_label | LIVE | code, label, match, source (no id, no tenant_id). + group, needs_action BUILT-NOT-LIVE (V9); RC map says group, level instead | VocabularyItem | Missing id/tenant_id (R7): add at end. Review words are rows | STAFF45; ACCESS |
| finding_response | DESIGNED | id, tenant_id, finding_id, correction, cause_analysis, corrective_action, due_on, closed_on, responded_by, sign_in_id | FindingResponse | OK | ACCESS RC map |
| sign_off_record | DESIGNED (Q13 open) | id, tenant_id, resource_table, resource_id, resource_version, record_digest (SHA-256), digest_field_order, attestation_text_version_id, signer_person_id, signed_at, assurance_method, sign_in_id, supersedes_id | SignOffRecord (+ Signature) | OK | ACCESS RC map; EXT G12 |
| action | DESIGNED | finding_id, owner_party_id, due, closed_on, evidence_id | FindingResponse (POA&M) | Overlaps finding.action_agreed/due_on and finding_response: one home needed | COMPL 4.9 |
| incident | DESIGNED (BLDD, 16 cols) | subject_id, incident_type, occurred_at, action_taken, reported_to, severity, status, rule_ref, root_cause, corrective_action, preventive_action, owner_id, due_on, resolved_on, verified_by, verified_at | Finding (self-detected) | OK; today incidents are check_type `incident` rows | BLDD |
| repair | DESIGNED (5 Lisa decisions open) | one new table + check_log steps "fixed" / "checked" | Finding + FindingResponse | "repair" is generic; OK | MAINT |

PROPOSED (RC only): Signature, FindingIssuer, FindingObservation, FindingEvidence.

Reviews by visitors (Lisa 13/11 20:21): one finding row, finding_kind `review`, outcome from a status_label `review` row, never edits the record. Rows with an amber/red level go to the owner's "Needs you" list.

## 8. Evidence and files

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| file | DESIGNED (one store agreed by TEMPS, STAFF, SOPJOBS, BB; Lisa's yes pending, queue 11) | id, drive_file_id, kind (photo, certificate, report, form), for_table, for_row_id, subject_id, area_id, taken_on, added_by, added_by_role, added_at, sha256, removed_on (+ tenant_id) | EvidenceDocument + EvidenceLink | `subject_id`/`area_id` shortcuts are fine (neutral). `removed_on` = end, R5 | FILES |
| document_link | DESIGNED (Lisa yes in BB, not created) | per BB: link of a document to any record, dated | EvidenceLink | Overlaps `file.for_table/for_row_id`: one link table only (Q-C8) | LISA-QUEUE 19 |
| evidence_value | DESIGNED | evidence_id, key, value, unit_id (e.g. cover limit) | (none; RC CredentialVersion.coverage_text) | OK | COMPL 4.6 |
| doc_type | LIVE (14 rows) | not read | VocabularyItem (document_type) | OK | MANIFEST |
| document_shelf | LIVE (not read) | not read | Resource | OK | folder list |

Legacy: check_log.photo (text, live), credential/ finding.evidence_document_id (live), BLDD media/media_purpose/document (design only, superseded by file). PROPOSED (RC only): CaptureSession (upload token hash, expiry, permitted types, max bytes).

## 9. Readings

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| area_reading | LIVE | id, tenant_id, area_id, reading_type, min_c, max_c, '' (unnamed 7th column = max_c - min_c, Lisa to name), spot_c, precision_dp, period_start, taken_at, taken_by, device_id, reset_after_reading, applied_limit_id, in_range, compliant, mitigation_required, corrects_id, mitigation_note, read_method, camera_value_changed, room_empty, thermometer_id | Measurement | `_c` puts the unit in the column; `room_empty`, `thermometer_id` kit words. Alias: **`reading`** (value, unit_id, source, instrument_id). Unnamed column needs a name (open) | SPECS |
| guest_reading | LIVE | id, tenant_id, area_id, min_c, max_c, spot_c, precision_dp, period_start, taken_at, taken_by, read_method, camera_value_changed, mitigation_note, note. + sign_in_id DESIGNED | Measurement (source guest) | alias `reading` with source=guest | SPECS |
| sensor_reading | LIVE | id, tenant_id, area_id, day, min_c, max_c, samples, source, device_label, taken_at, taken_by | Measurement (source import) | alias `reading` with source=import | SPECS |
| outdoor_temp | LIVE (not read) | not read | Measurement | alias `reading` (area = outside) | folder list |
| thermometer | LIVE | id, tenant_id, name, area_id, made_at, made_by | Resource (instrument) | alias **`instrument`** | SPECS |
| temperature_band | LIVE (dated V7) | id, tenant_id, band, age_from_days, age_to_days, min_temp, temp_unit_id, max_temp, basis, ruling_needed, note (+ from_date, to_date, V7) | ThresholdBand | alias `threshold_band` | contract headers; OVERSEER log |
| temperature_action | LIVE (5 rows) | not read (SOP action ladder) | RuleVersion (severity, action) | alias `threshold_action` | JOB4 map |
| area_link | LIVE | id, tenant_id, from_area_id, to_area_id, from_date, to_date, source, set_by, set_on | RuleScope (one reading covers another place) | OK. SCHEMA: add `link_type` value for the H1/H2 closed-room rule | SPECS |
| unit | LIVE (not read) | not read | (unit text on RC rows) | OK | folder list |
| reading_requirement | DESIGNED (BLDD) | rule_scope_id, readings_per_day, min_hours_apart, tolerance_hours, precision_dp, requires_min_max, effective_from, effective_to | RuleVersion | as rule rows instead (`reading.per_day`...) | BLDD; HARDCODED T2/T3 |

Kit table, not core: weight (subject_id, performed_on, weight_kg, unit, body_condition_score, bcs_scale, source). `weight_kg` puts the unit in the name.

## 10. Subjects and places

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| subject | LIVE | id, name, sex, dob, size_band, coat_type, kind, neuter_status, source, species, breed, coat_colour_id, coat_pattern_id, nose_pigment_id, birth_litter_id, rx_moxi_date, rx_moxi_expiry, rx_moxi_file_url, photo (+ tenant_id) | Subject | `subject` is neutral. Kit columns: coat_*, nose_pigment_id, birth_litter_id, rx_moxi_*, `size_band` (to drop: size from latest weight, 12 Nov) | contract headers; DOGCARD |
| subject_status | LIVE | id, tenant_id, subject_id, state, from_date | Subject.status / SubjectClassification | OK | DOGCARD |
| subject_link | LIVE (changed 13/11/26: STAFF V8, main 2786bb5, file created header-only; dog card + print read it, PR 532) | id, tenant_id, subject_id, other_subject_id, kind (rule rows link_kind.*), from_date, to_date, source, note, set_by, set_at | (none) | OK | DOGCARD |
| occupancy | LIVE | id, tenant_id, subject_id, area_id, off_site_kind, moved_in, moved_out, classification, classification_note | (placement; none) | alias `placement`. `moved_in/out` break R3 (legacy) | SPECS |
| area | LIVE | id, code, grouping, group_sort, area_value, m2_confirmed, m2_note (+ tenant_id, ...) | Resource (place) / site | `area` is neutral; `m2_` puts the unit in the name | contract headers |
| area_access | LIVE | id, tenant_id, area_id, access_type (free/limited), from_date, to_date, reason, set_by | (none) | "access" here = room access: keep sign-in names away from it | SPECS |
| area_capacity | LIVE (dated V7) | id, tenant_id, area_id, access_type, size_band, max_dogs (+ from_date, to_date) | ThresholdBand / BR-MEASURES occupant_need | `max_dogs` kit word (alias `max_subjects`); 120 typed rows duplicate space.* rules (SCHEMA b2) | COMPLIANCE-dated-limits |
| species | LIVE | species pack rows (young_word, adult_female_word, adult_male_word...) | IndustryTemplate rows | OK (kit row table) | DOGCARD |
| tenant | LIVE | not read | tenants (OverSkill live) | do not create a second tenants table (RC section 10) | MANIFEST |
| locale | LIVE (not read) | not read | locales (OverSkill live) | OK | folder list |
| litter | LIVE (kit) | id, dam_subject_id, sire_subject_id, born_on, notes | Subject (group) | kit word: BLDD renamed to `birth_group` (6 Oct); alias here | contract headers |

Kit tables (dog kit, not core; listed so nothing is lost): health_screen, fit_to_breed, microchip, microchip_registration, vaccination, coat_colour, coat_pattern, nose_pigment, mating, dna_marker, dna_result, temperament_assessment, medicinal_product, dispense, stock_level, clinical_note, visit (vet visits), season, score_scheme, score_band, score_criterion, score_point, score_enrolment, score_judgement.

## 11. Rules and settings (the one shared rule list)

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| breeding_rule | LIVE (38+ rows) | id, tenant_id, rule_key, value, effective_from, source, note, set_at, set_by, to_date. SCHEMA: + scope_table, scope_id DESIGNED (needed for job/device/role scope) | RuleVersion + RuleScope | **Core table with an industry name.** Alias **`rule`** (never rename). Keys in use: size_from_kg.*, size_colour.*, space.*, room.*, compliance.*, staffing.*, dog.adult_from_months, link_kind.*, external.*; designed shift.*, job.*, sign_in.*, reading.*, records.late_entry_days | SPECS; SCHEMA; RULE |
| capacity_setting | LIVE (dated V7) | owner rows: over_capacity_action = refuse or reason (+ from_date, to_date) | RuleVersion | fold into `rule` rows later | SPECS READABLE |
| watch_rule | DESIGNED (BLDD) | name, target_metric_key, target_table, target_field, condition, min, max, unit, window, severity, action, notify_roles, cooldown_minutes, active, pack_version_id | RuleVersion (threshold + severity) | OK | BLDD |
| pack, pack_version, tenant_pack | DESIGNED (BLDD 6 Oct) | pack: key, name, kind, publisher_tenant_id, jurisdiction, species; pack_version: pack_id, version_number, status, activated_at, retired_at; tenant_pack: tenant_id, pack_id, pack_version_id, activated_at | IndustryTemplate (Block 9) | Lisa's word is **kit**: alias `kit`, `kit_version`, `tenant_kit` | BLDD |
| jurisdiction_rule, rule_scope | DESIGNED (BLDD), superseded by `rule` | rule_key, value, source_citation, effective_from, effective_to | RuleVersion / RuleScope | superseded | BLDD |

PROPOSED (K08 kit; these tables are live on another App Factory app, not in BLD): compliance_rules, regulated_categories, industry_templates, template_contents, template_installations. K08 says "ONE rules table, not two": see Q-C3.

Settings that were separate homes and now go into `rule` rows: sign_in_setting (dropped), permission.methods / idle_minutes (moved), shift times, completion rule, external access lengths. Breed Better score_* are kit rule tables and stay separate (BB owns them).

## 12. Audit log

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| audit_log | DESIGNED | id, tenant_id, at, person_id, sign_in_id, device_id, action (sign_in, sign_out, lock, issue, rename, reset, end, lost, grant, permission, setting, delegation_give, grant_extend, grant_end...), table_name, record_id, before, after, reason. Append-only, enforced by the save script. Covers access and setting changes only; record corrections stay corrects_id rows | audit_log (OverSkill live, 10 cols) | OK (BR-FIELD-CRM name; "events" is taken) | ACCESS |
| _pending | LIVE | event_id, pending_id, event, at, by, role, target_file, kind, row_id, corrects_id, note, payload_json, result | JobRun (nearest) | `payload_json` is a JSON column (S1 discourages): legacy | CONFIG |

Also the read logs inspect_access (section 3) and code_register (section 2). PROPOSED (RC only): AccessModeRegister, JobRun, ArchiveSource, ImportBatch, ImportMapping, ImportRow (imports today use a sign_in row with method IMPORT).

## 13. Retention

| Table | Status | Columns | RC equivalent | Neutral name | Source |
|---|---|---|---|---|---|
| retention_setting | BUILT-NOT-LIVE (main reads it, file absent; V7 sitting skipped it) | section, years (or months), basis/source, from_date, to_date (+ id, tenant_id, set_by) | RetentionRule (record_type, jurisdiction, basis, anchor_event, years, months, min_years, is_unset) | OK | CONFIG; LIVE-HEADER-BUNDLE 12 Nov |
| retention_rule | DESIGNED (BLDD), superseded | jurisdiction, record_kind, retain_years, statutory_source, effective_from, effective_to | RetentionRule | superseded | BLDD |

PROPOSED (RC only): LegalHold (G4 yes: freeze records during an investigation, with dates and a legal basis). Grant retention: RC `retention_until` on the grant (designed in the RC map).

---

## 14. Decision log (Lisa's decisions; never rewrite, only add)

| Date (UK) | Decision | Source |
|---|---|---|
| 24 Sep 2026 | A foreign system's id never goes into our tables; it lives in a MAP file. Readable ids (sub-name). | BLD-_README.md |
| 6 Oct 2026 | Species-neutral names in the BLD design (animal not dog; birth group not litter; words people see come from the species pack). K08 "Own rules and checklists" kit ruled. "We add bricks for anything in or out." | BLDD change log; BRICK-KITS v1.2; BRICK-REGISTRY v0.14-0.15 |
| 16 Oct 2026 | round_event retired; daily "All the rest unmoved" = occupancy_check. Staff see no past entries (S02-4). | SPECS; JOB4 map note |
| 21 Oct 2026 | Inspector link: time-boxed, read-only, no login (BL-Q3-INSPECTOR). | BB-inspector-link-design |
| 8 Nov 2026 | Breeding limits are owner rows, never hard-coded. Guest readings in their own file. Inspector sees no scores (decision 8). | SPECS; BB design |
| 9 Nov 2026 | Retention is set by the user per section ("laws vary ... cannot hard code"). Who reads records (ICO notice). Watch list parked. Results order best to worst; verdict word "Unverified". | W4-Lisa-decisions 13-16; memory |
| 11 Nov 2026 | "A standard": things carry no dates; links and states carry from_date/to_date; meaning in row values; end = to_date; no ZZ_ retire. Room empty flag. Two thermometers in one room. Photo read method. | NEEDS |
| 12 Nov 2026 | Every limit is a dated row (breeding_rule gains to_date). "Its for the breeder to decide what the inspector sees" (dogs incl. archived, fields per link). Occupancy moves go straight in. Size is worked out from the latest weight. Room links option B (area_link). | SPECS; INSPECT; memory |
| 13 Nov 2026 08:25 | Medium/large line stays 25 kg (SOP source). | NEW-OVERSEER-log |
| 13 Nov 2026 13:4x | Owner-only Admin section with the access map ("what each sees and editability"). | ADMIN-ACCESS-brief |
| 13 Nov 2026 | A note can be added to a done job ("in addition to done rather than instead"). | SPECS check_log |
| 13 Nov 2026 15:37 | P&A 1/12: brick name "People & access", a method is a "sign-in". Remove devices, people, cards = end, never delete their rows. | ACCESS answers |
| 13 Nov 2026 15:38 | P&A 2/12: name tap + PIN default on shared devices, card optional; a sign-in may be scoped to a room or item (off by default). Card/fob is personal, one per person, a security fob under the SOP. | ACCESS answers |
| 13 Nov 2026 15:39 | Access history is owner-only by default; tickable per external view. | ACCESS answers |
| 13 Nov 2026 15:41 | P&A 3/12: PIN 4-6 digits, lock after 5, owner unlocks. No industry/purpose words anywhere. | ACCESS answers |
| 13 Nov 2026 15:42 | P&A 4/12: 10 min idle default; every setting is an owner option in Admin, dated rows. | ACCESS answers |
| 13 Nov 2026 15:44 | P&A 5/12: sign-out timing is the user's setting per device type and per job/item. | ACCESS answers |
| 13 Nov 2026 | No wording about evidence strength on any screen or report; sign-in method kept for tracing only. | ACCESS Q7 note |
| 13 Nov 2026 20:20 | External 1/4: one window shape: now for X hours / until HH:MM, or scheduled DD/MM/YY HH:MM to DD/MM/YY HH:MM; end early ("Finished") so they cannot log in once home. | EXT; answer log |
| 13 Nov 2026 20:21 | Visitors may review records (Seen, Not sufficient, feedback) as an option. | answer log |
| 13 Nov 2026 20:24 | External 2/4: C (link, email code tickable) plus pre-printed visitor cards activated on arrival; Admin shows what is active now; owner rescan ends it. | EXT |
| 13 Nov 2026 20:34 | External 3/4: visit types (presets) with safe defaults (View + Review; Print/Export off). 4/5: Record right per job, saved under the visitor, default kept separate from due. "Visibility and permissions totally customisable by the user." | EXT |
| 13 Nov 2026 20:51 | Gaps G1-G12 all yes (time zone, ID checked, terms, legal hold, copy on demand, as-at view, watermark, no offline cache, who accompanied, multi-site, long-running review, e-signature meaning). Giving access is itself a permission, conferred by the owner, layered, never more than the giver holds. | EXT; answer log |
| 13 Nov 2026 20:57 | P&A 6/19: "who sees what" changes from a chosen date (field_visibility from/to). Owner sees who has given what. | ACCESS |
| 13 Nov 2026 21:30 | check_log.counts_due (SOPJOBS proposal, ADMIN + STAFF agreed): a visitor's record is stamped true/false at save time from the visit's record_counts, so history keeps what was granted. A visitor record is taken_by 'visit:<link id>' always. due.js reads the stamp first, the link only as fallback; staff phones count a visitor record only when stamped true. Part done and Note never count as done. | SOPJOBS; PR 545, 537; STAFF PR 546 |
| 13 Nov 2026 23:40 | Paper catch-up (option B) adds no new table or column. A paper row is check_log with happened_at = the real day (time default 12:00 London) and how_recorded paper/bulk/import (enum to add, STAFF S1); check_type_id = the job version in force on that day. how_recorded is owner/admin-only (no staff read row). Duplicate guard to add the happened_at date (STAFF S2). Back limit = owner rule row job.paper_back_days, none = any past day. | SOPJOBS plan AA_SOPJOBS_2026-11-13-2330; PR 558 |
| 13 Nov 2026 23:59 | Paper catch-up is an owner setting (Lisa: "up to the owner to decide per person"). permission (DESIGNED) gains action value `paper_entry` on table_name check_log; starting rows: STAFF role allowed=yes, a person row allowed=no switches someone off. Rule keys in breeding_rule (no new columns): job.paper_default_time (starting 12:00) and job.paper_back_days (blank = any past day), each with an optional .<type_key> suffix per job. Proposed: check_log.time_given (owner-only) so the owner sees "time not given". | SOPJOBS; ADMIN; STAFF S6-S8 |
| 13 Nov 2026 20:59 | P&A 7/19: sign_in_id on every record, new saves only. Keep the BLD app schema up to date. | ACCESS; answer log |
| 13 Nov 2026 21:04 | Q-A: CD Hub keeps from_date/to_date (RC effective_from/to = ours); window columns are datetimes. Decided by OV10 from Lisa's 11 Nov standard, **not asked** (confirm if wanted). | ACCESS RC map |
| 13 Nov 2026 21:05 | Schema home: do all 3 (Drive master, repo copy, pointer); brick must slot into any cross-industry app without naming issues; full notes in a logical place; record improvements to earlier work. | answer log |
| 13 Nov 2026 | BFFs / Fren. shown on the dog card and printed card, saved as dated subject_link rows; the words are rule rows link_kind.bff = BFFs, link_kind.not_with = Fren. (live V8). No dash or hub address on any print. Dog print shows name, size, class, microchip, photo, colour, DOB. | OV8/OV9 relays of Lisa; DOGCARD PRs 530-532; STAFF V8 |
| 13 Nov 2026 | subject_create (Add dog, all 3 places) adds **no new columns** to subject: writes the live columns only; chip goes to microchip, photo via Photo.gs file id, one subject_status "active" row. Hub-only things stay in the host adapter, never in a table. | DOGCARD + BB agreed; BB-save-app-actions-for-STAFF.md |
| 13 Nov 2026 21:3x | V9 final names applied (ADMIN AA_V9-NAMES_2026-11-13-2140; settles Q-C1, Q-C2/N2/N3, N7, N12; option B). New tables: grant_type (was visit_type; active/effective_from -> from_date/to_date; a PRESET copied into rows at give time), grant_scope, grant_right_link (right_code; is_active -> from_date/to_date), grant_right, delegation (grant_type_ids; from_date/to_date whole days). inspect_link keeps its name (alias grant): grant_type_id, ended_at/ended_by/end_reason, supersedes_id rows, never edited; requests send grant_id = root id. check_log and finding: grant_id (finding replies_to_id dropped; owner reply = finding_response later). Visitor taken_by = grant:<root id>. status_label appends group, level, needs_action, id, tenant_id. Actions grant_type_save / grant_give / grant_end / grant_extend / grant_open / grant_review / grant_record. Nothing live changed. | ADMIN AA_V9-NAMES 2140; OV10 "align, then merge"; STAFF PR 546 (8c2f731), PR 547 (8938273); bundle AA_STAFF_2026-11-13-2200 |
| 13 Nov 2026 21:4x | **BLD is a brick: all App Factory rules apply, renames allowed.** Lisa: "these are bricks , we can rename BLD easier now than live with parts inconsistent with the whole for years to come - use whatever the rules of the app factory for links/BLD dictate". STANDARD S4 governs (S4.15 from_date/to_date dates + source/set_by/set_on; created_at/updated_at; datetime stored UTC). This replaces R6 for BLD: a rename is a copy (new file, counts and checksums read back, old file ended and kept, never deleted). Plan, every live table old -> new, readers and steps: AA_BLD-RENAME-PLAN_2026-11-13-2141 (this folder), phases P1-P5, Lisa's yes per sitting in the STAFF session. Open for Lisa: Q1 plural names, Q2 S4 addition from_at/to_at for sub-day periods (visitor windows, room moves), Q3 set_by for records, Q4 one reading table. | OV10 relaying Lisa 13/11; STAFF plan |
| 13 Nov 2026 21:5x | **Test mode: clean renames and deletes when Lisa says so.** Lisa: "except obviosly we are in test mode so anything inconsisten like cant rename or delete when I say so !!". The rename plan uses clean renames (no aliases kept): full backup to BLD-BACKUP_<stamp> first, one sitting, Lisa's yes in the STAFF session, old file trashed only on her word. | OV10 relaying Lisa 13/11; AA_BLD-RENAME-PLAN section D |
| 13 Nov 2026 22:09 | **Table names are plural** (S1.4: "The stored table name is PLURAL"; Links and the other App Factory apps are plural). Lisa, typed in the STAFF session: "plural". Every BLD table is renamed to its plural in the one rename sitting (e.g. subject -> subjects, check_log -> check_logs, grant -> grants); column names stay singular (subject_id). Settles N11 / Q-C11 and rename-plan Q1. | Lisa in STAFF session; STANDARD S1.4 |
| 14 Nov 2026 01:01 | **S4 addition: from_at / to_at for periods shorter than a day** (datetime, UTC, from inclusive, to exclusive, blank = no end). Lisa, typed in the STAFF session: "Yes, from_at/to_at". Added to STANDARD S4.15 for every brick. CD Hub: grant usable_from/usable_to -> from_at/to_at (not live, renamed in PR 546/547 now); occupancy moved_in/moved_out -> from_at/to_at in the rename sitting. Settles rename-plan Q2. | Lisa in STAFF session; S4.15 |
| 14 Nov 2026 01:03 | **Time zone is data, not code (international app).** Lisa: "ensre timezone is referred to somehwo as internationsl app refer to overseer for table schema". Today London is hard-coded (BLD.TZ, todayLondon_, londonIso_, inspectEndOfDay_). Plan: tenant/site time zone held as a dated setting row (IANA name, e.g. Europe/London; S4.15 from_date/to_date + source/set_by/set_on); code reads the row in force for the date; Europe/London only as the fallback when no row. Datetimes stay UTC (S4.2); screens show the tenant zone; grant rows keep tz. Table/column: OPEN, asked OV11 14 Nov 01:03. | Lisa in STAFF session; OV11 to name table |
| 14 Nov 2026 01:30 | **links (decision C, Lisa 13/11): one record-to-record link table + kinds as owner rows.** BLD-links: id, tenant_id, from_table, from_id, to_table, to_id, link_kind_key, sort, note, from_date, to_date, source, set_by, set_on, created_at, updated_at. BLD-link_kinds: id, tenant_id, kind_key, label, reverse_label, from_tables, to_tables, max_per_from, who_may, from_date, to_date, source, set_by, set_on, created_at, updated_at (who_may = owner setting per kind: roles or person:<id>; blank = owner only). Tags: BLD-tags + links of kind `tag` (no rule meaning). Table names are file stems, so they follow the plural rename. Live subject_link / area_link / governed_by map onto links in the rename sitting. Code PR 563 (switch off). | OV11 relaying Lisa 13/11; STAFF note AA_STAFF_2026-11-14-0104 |
| 14 Nov 2026 01:45 | **Time zone lives on the locale row (settles 01:03 OPEN).** No new settings table: BLD-locale (-> `locales` in the plural sitting) is already the per-tenant international row (language_tag, date_display, units, currency_code). Add `time_zone` (IANA name). Locale rows become dated (S4.15: from_date, to_date, source; set_by/set_on kept); code reads the row in force on the date in question. Later multi-site: optional `area_id` on the row (blank = whole tenant), spec only. No row in force: the Apps Script project time zone (Session.getScriptTimeZone()), never hard-coded London; Data checks shows "Time zone not set". BLD.TZ, todayLondon_, inspectEndOfDay_, londonIso_ -> one helper tzOn(tenant, date); both bld-save.js copies match. Starting row for Lisa's yes in STAFF: the tenant locale row time_zone Europe/London, from_date 2025-01-01, source "Lisa 14 Nov 2026: international app, time zone per tenant"; same yes may carry date_display "D MMM YYYY" (13 Nov decision). | OV11 14 Nov |
| 14 Nov 2026 02:1x | **links aligned to ITEMS PR 568 (supersedes 01:30 link_kinds).** One table BLD-links: id, tenant_id, from_table, from_id, role, to_table, to_id, from_date, to_date, source, set_by, set_on, sort, note, created_at, updated_at (last four asked of ITEMS). No BLD-link_kinds table: roles and their settings are rows in the one rule list BLD-breeding_rule: link_kind.<role> (words shown), link_kind.<role>.from_tables / .to_tables / .max_per_from / .who_may (who may = owner setting; no row = owner only). | OV11 14 Nov; STAFF PR 563 7deb16d |
| 14 Nov 2026 00:1x | Who may open the temperature Year report or import a Sensor CSV is an owner setting (Lisa's 13 Nov rule: who may do X is a permission row, never a one-off pick). permission (DESIGNED) gains action values `year_report` and `sensor_import` on table_name area_reading; starting rows: OWNER role allowed=yes for each, no STAFF row (= no). Code keys temps.year_report / temps.sensor_import go through one helper can(); owner codes only until permission is served (PR 559). No new table or column. | TEMPS; OV11; ADMIN seed AA_PERMISSION-SEED_2026-11-14-0005 |
| 14 Nov 2026 01:3x | Subject photos = one main + a growing gallery (Lisa 13/11). New table **`files`** (plural, BUILT-NOT-LIVE, PR 567): id, tenant_id, kind (photo/upload/link), drive_file_id, url, mime, name, size_bytes, taken_on, sha256, source, set_by, set_on (UTC); rows never edited; **no for_table/subject_id**: a file belongs through `links` rows (decision C; STAFF agreed). Link kinds `gallery` and `main` (max_per_from 1; a new main ends the old in the same save) as BLD-link_kinds rows. Owner rule rows (no new columns): file.types, file.max_bytes, file.photo_long_side. Action `file_add` (owner only, TABLE_ON_files; Script Property FILES_FOLDER_ID). Read side PR 566. Old subject.photo read as fallback until the rename sitting copies it to files + a main link. | DOGCARD AA_DOGCARD_2026-11-14-0055; STAFF AA_STAFF_2026-11-14-0104 |
| 14 Nov 2026 20:45 | **LIVE: BLD-locale time zone + date display.** Lisa typed "yes" to 4/16 (OV11 session). OV11 wrote it after backup ZZ_BACKUP_BLD-locale_2026-11-14-2045 (same folder), read back. Appended columns N-Q: time_zone, from_date, to_date, source. the tenant locale row: time_zone Europe/London, from_date 2025-01-01, to_date blank, source "Lisa 14 Nov 2026: international app, time zone per tenant"; date_display DD/MM/YYYY -> D MMM YYYY; set_by lisa, set_on 2026-11-14. Code reading it: tzOn (STAFF, next PR); until then code uses London, which matches. | Lisa yes 4/16 via OV11; STAFF spec |

## 15. Improvements over earlier designs (what changed, and why)

| # | Earlier design | Now | Why |
|---|---|---|---|
| 1 | RC: effective_from/effective_to on every table plus 5 universal columns | from_date/to_date on link and state rows only; things carry no dates; universal provenance columns not carried (row source text kept) | Lisa's 11 Nov standard is later than RC; CSV tables can add columns only at the end |
| 2 | RC DisclosureGrant: usable_from/usable_to as dates | date-times (HH:MM) with time zone (G1) | Unannounced inspections; "until HH:MM" |
| 3 | RC: read log is a flag | inspect_access is always on; a read is refused if the log fails | No unlogged visit can exist |
| 4 | RC: grantor_person_id only | delegation table: layered, intersecting limits, depth, end_issued | Lisa 20:51: giving access is itself a permission |
| 5 | Inspect.gs DEFAULT_DAYS 7 / MAX_DAYS 30; guest DAYS 1-30 hard-coded | rule rows external.default_hours/max_hours per role | R2 (done on main) |
| 6 | Guest codes not logged per visit; vets permanent | every outsider is a dated sign_in + person_role row; vets timed per dog (Q20) | One shape for every outsider; history complete |
| 7 | Specs.gs `perms` hard-coded per table | permission rows, dated, scoped to job/room/person; deny beats allow; server date | R2; Lisa "customisable by the user" |
| 8 | Settings in 6 homes (breeding_rule, temperature_band, capacity_setting, retention_setting, sign_in_setting, score rules) + permission columns | one `rule` list with scope_table/scope_id; sign_in_setting dropped | One answer per question; past judged the same way |
| 9 | role_grant table (ACCESS draft) | reuse live person_role (already dated, scoped) | Reuse before creating |
| 10 | access_event / access_setting (ACCESS draft) | audit_log (existing brick name) / rule rows | "events" and "access" were already taken |
| 11 | Visit extend edits ends_at | extend = new row with supersedes_id (RC) | Never edit; history shows each grant |
| 12 | V9: rights/lists/record_jobs pipes on the link row | grant_scope + grant_right_link rows (RC) | Pipes cannot be dated or queried; RC rows can (pending Q-C1) |
| 13 | V9: replies_to_id on finding; needs_action on status_label | finding_response table; status_label group + level (G/A/R) | The visitor's finding is never edited; RC level is cross-industry |
| 14 | Temperatures in 3-4 tables with _c columns | one `reading` alias (value, unit, source) for new work | Cross-industry readings (RCD tests, fridge temps, smoke alarms) |
| 15 | Photos 4 ways (check_log.photo, reading_photo, file, document_link) | one store (file) + one link table | One evidence home |
| 16 | Job to SOP / need as free text (check_type.sop, source) | dated governed_by rows and requirement rows; text kept as labels | Answers "which SOP version applied on that date" |
| 17 | Assignment = permission | assignment separate from permission; completion rule rows | Assigning someone never quietly grants access |
| 18 | Read-and-sign proposed as new governed_by person rows (SCHEMA 9) | use the live, unused sop_acknowledgement (person_id) first (recommendation, Q14) | It already exists for exactly this |
| 19 | Compliance worked out live each time | obligation register, source rows, stored verdicts (parked) | ISO 37301 register; OSCAL results; H-09 "a March verdict stays unchanged" |
| 20 | RC Party required for every grantee | a one-off visitor may be name + organisation on the grant | Retention and minimisation; difference kept knowingly |

## 16. Naming issues (neutral-name check, ranked)

| # | Issue | Fix (alias, never rename live) | Needs Lisa? |
|---|---|---|---|
| N1 | `breeding_rule` is the shared core rule list | alias `rule`; new kits read it as `rule`; K08/RC names mapped | Q-C3 |
| N2 | `visit` clash: live BLD-visit (705 vet-visit rows) vs V9 `visit_type`, `check_log.visit_id`, `finding.visit_id`, `visit_*` actions | not live yet: name them `grant_type`, `grant_id` before the headers go live (actions can stay as code words) | yes, before V9 headers |
| N3 | `inspect_link`, `inspect_access`, `inspect_link_subject/_field` (purpose word) | aliases `grant`, `grant_read_log`, `grant_subject`, `grant_field`; new tables `grant_scope`, `grant_right_link` | with N2 |
| N4 | Readings: `area_reading`, `guest_reading`, `sensor_reading`, `outdoor_temp`, `min_c/max_c/spot_c`, `thermometer`, `temperature_band/_action`, `room_empty` | aliases `reading` (value, unit_id, source), `instrument`, `threshold_band`, `threshold_action`; `room_empty` -> occupancy says empty | Q-C10 (one reading table) |
| N5 | Dog words in core columns/values: check_log.litter_id, check_type.target `dog`/`litter`, occupancy_check.dog_ids, area_capacity.max_dogs, person_role.household_id, subject.birth_litter_id, ROLE_ALL VET/TRAINER constants | new rows use `subject` / `group`; aliases `group_id`, `subject_ids`, `max_subjects`; roles only as BLD-role rows | no (aliases), yes to stop adding |
| N6 | `assignment` (ours: job -> assignee) vs RC Block 9 `Assignment` (person -> shift) | name ours `job_assignee` before live | yes (small) |
| N7 | `device` (sign-in devices) vs live `area_reading.device_id` (instrument) | `sign_in_device` | yes (small) |
| N8 | `access`: area_access (room access) vs access history/settings | keep sign-in names off "access" (done) | no |
| N9 | `credential` = licences and certificates | never for sign-in (done) | no |
| N10 | R3 breakers: `active` (check_type, check_field, qr_tag, visit_type), `valid_from/is_active/valid_months` (score_*), `visible_from/to` (person), `effective_from` | keep live; new tables use from_date/to_date; BB adds to_date | no |
| N11 | Plural vs singular: STANDARD S1.4 says plural; BLD files are singular; RC is PascalCase | decide once for the brick on OverSkill | yes |
| N12 | `status_label` has no id/tenant_id | add at the end | STAFF |
| N13 | Live file `BLD-sale (1).csv` (the sink expects `BLD-sale.csv`) | Lisa renames the Drive title (a file title, not a column) or the spec reads it | yes |
| N14 | Units in names: `weight_kg`, `m2_confirmed`, `_c` | value + unit_id in new tables | no |
| N15 | `table_policy.overskill_access_mode` names a platform | alias `platform_access_mode` | no |

## 17. Conflicts needing a Lisa decision

| # | Conflict | Options | Recommendation |
|---|---|---|---|
| Q-C1 | V9 header bundle (STAFF22, PR 546/547) vs ADMIN's RC map (later the same evening): pipes `rights, lists, record_jobs, record_counts` vs grant_scope/grant_right_link rows; `ended_at/ended_by/end_reason` vs `revoked_at/revoked_by/revoke_reason`; `replies_to_id` vs finding_response; `needs_action` vs `group, level`; extend edits vs supersedes_id | A: ship V9 as built; B: rename the not-live columns to RC and use rows | B, before any V9 header goes live (nothing is live yet) |
| Q-C2 | Visit naming clash (N2/N3) | A: keep visit_*; B: grant_* | B |
| Q-C3 | One rule table: live breeding_rule (alias rule) vs K08 compliance_rules (live on another App Factory app) vs RC RuleVersion+RuleScope vs BLDD jurisdiction_rule/watch_rule. Scope: scope_table/scope_id (SCHEMA) vs scope_type (COMPL) vs RC RuleScope rows | A: breeding_rule widened (scope_table, scope_id, scope_type) as the one list; B: new table | A in BLD; map to compliance_rules on OverSkill |
| Q-C4 | Stored verdicts (H-09; COMPL decision 1; RC ComplianceAssessment) parked | build / keep parked | build before any audit-trail claim |
| Q-C5 | Source rows and an obligation register (COMPL decisions 2, 3) | yes / no | yes |
| Q-C6 | Job system: live check_type/check_log vs live unused checklist_* vs RC Checklist*/DoTask vs K08 checklists/check_ins | end checklist_* (to_date note, never delete) and map names | check_type is the one job system |
| Q-C7 | Sign-off (Q13) and read-and-signed SOP (Q14): check_log sign_off job vs RC SignOffRecord+Signature; governed_by person rows vs live sop_acknowledgement vs RC Assessment | | sign_off_record (RC shape) + sop_acknowledgement |
| Q-C8 | Evidence home: file (one store) vs document_link (BB yes) vs RC EvidenceDocument/EvidenceLink vs COMPL evidence (credential_version widened) | | file + one link table; certificates stay credential_version rows that point at a file |
| Q-C9 | Party: person only (ours) vs party + party_link with organisations (COMPL, RC Party, ContractorOrganisation) | | add `party` only when the first organisation is needed (contractor, insurer); person stays for people |
| Q-C10 | One reading table (SCHEMA) vs keep three | | keep the live three; new kits use `reading`; merge later |
| Q-C11 | Plural vs singular table names for the OverSkill brick (S1.4) | | ask once, record here |
| Q-C12 | Confirm Q-A (from_date/to_date) was right to decide without asking | | yes, confirm |

## 18. Open questions still with Lisa (ask one at a time, via OVERSEER)

People & access (ACCESS): Q8 starting roles (Owner, Manager, Staff, Vet, Trainer, Visitor, Inspector; Manager new); Q10 leaver one tap; Q11 lost card one tap; Q12 history kept as long as staff-records retention; Q13 sign-off as its own record; Q14 read-and-signed SOP per person and version; Q15 who may take temperatures, move dogs, set room access per role and room; Q16 assign a job to people/role/shift with once / each / any N; Q17 staff see colleagues' names on jobs; Q18 who counts as on shift today; Q19 once-each on per-dog jobs (rec barred); Q20 vets timed per dog; Q21 reason required to extend or stop; Q22 visits live on Main (covered by "Active now", confirm). Q9 answered by the delegation rule (20:51).
Other queue items: BB score_* dated-row headers, all nullable, never renaming live ones (changed 13/11/26: widened to S4.15, adds set_by and set_on): score_criterion from_date, to_date, set_by, set_on (live `authority` = its source); score_point from_date, to_date, source, set_by, set_on; score_scheme to_date, set_by, set_on (live `effective_from` = from_date); score_enrolment to_date, set_by, set_on (live `valid_from` = from_date, `is_active` read alongside). Lisa's yes pending; tenant_admin vs OWNER in person_role (queue 25); "not done after done the same day" rule (queue 23); one file store (queue 11); Repairs, 5 decisions (MAINT; queue 8); name the unnamed area_reading column; Q-C1 to Q-C12 above.

## 19. Counts (this version)

LIVE 68, BUILT-NOT-LIVE 4 (code_register, delegation, visit_type, retention_setting; plus V9 columns on live tables), DESIGNED 38, PROPOSED (RC or kit only) 50. Dog-kit tables listed in section 10 are not counted. Counted from the tables above; recount whenever a status changes. (changed 13/11/26: subject_link went live, DOGCARD)


## Decision log additions (SOPS, 13/11)

All rule keys below are rows in the existing breeding_rule table (no new rule table). Each row has value, effective_from (to_date where used) and source; a record is judged by the row in force on its own date; no row = "not set" and nothing is invented.

- 12/11/26, PR 480 (merged 3685968, 13/11): `gestation.due_days`: days from first mating to the working due date, read on the mating date. NOT SET (no live row). Neutral alias: kit row key, the word stays inside the dog kit.
- 12/11/26, PR 480: `gestation.window_from_days`: whelping window opens, days from mating. NOT SET. Neutral alias as above.
- 12/11/26, PR 480: `gestation.window_to_days`: whelping window closes, days from mating; after it the dam drops off In whelp. NOT SET. Neutral alias as above.
- 12/11/26, PR 480: `gestation.alert_from_day`: day of pregnancy the in-whelp alert starts; no row = no alert. NOT SET. Neutral alias as above.
- 12/11/26, PR 480: `litters.recent_days`: how many days back the Litters card lists litters. NOT SET. Neutral alias: offspring-group look-back (kit word "litters").
- 12/11/26, PR 480: `dog.adult_from_months`: age in months a dog counts as adult; drives puppy/adult counts, status, Today tiles and the age filter. LIVE (value 6). Neutral alias: subject.adult_from_months (kit word "dog").
- 12/11/26, PR 457: `staffing.adults_per_full_time`, `staffing.adults_per_part_time`, `staffing.full_time_min_hours`, `staffing.part_time_min_hours`: Today staffing tile; no full-time row = no tile. LIVE (4 rows). Neutral words already.
- 12/11/26, PR 444/463: `compliance.look_back_days` (Compliance temperatures window; no row = "not set"), `compliance.due_soon_days`. Live status not checked by SOPS. Neutral words already.
- 12/11/26, PR 475 (merged 9ff7690, 12/11): Compliance reads the area_link table (TEMPS owns it: id, tenant_id, from_area_id, to_area_id, from_date, to_date, source, set_by, set_on) through BLDAreaLink.expand. A reading in the from-room also counts for the to-room on dates inside the link; the reading itself is never changed; the room's own reading wins; two linked readings keep the widest (lowest min, highest max). Never reads occupancy: a reading never follows a dog that moved rooms (Lisa's rule, 13/11). Owner-only rows. Neutral words already.
- 13/11/26, SOPS check against App Factory STANDARD S4: the rule keys above are row VALUES, not columns (S4.15: a new need adds rows). breeding_rule keeps its existing column names effective_from and set_at (S4.6 never rename); the hub also honours a to_date on it where present. area_link already follows S4.15 (from_date/to_date inclusive, blank to_date = no end, source, set_by, set_on). No new table or column added by SOPS.
- 13/11 22:10 UK (OVERSEER 11): Q-C11 / S6 DECIDED by Lisa (answered in STAFF): table names PLURAL, to match the App Factory table naming rule. Applies in the BLD rename sitting (test mode, Lisa's yes in STAFF). Lisa also chose: speed work for owner + staff now (STAFF steps 1-3 + owner snapshot; ADMIN owner page).
- 13/11 22:21 UK (OVERSEER 11): Q-C3 (one rule list) was already DECIDED by Lisa 9 Nov (memory breed-better-kits-one-rule-list: hub breeding_rule widened as the one shared rule list, plural name in the sitting). Mark closed. Item checks 2/4 DECIDED 13/11 ~22:15: option A (new item list; tests via check_type/check_field/check_log/check_value). Coherence review: AA_COHERENCE_2026-11-13-2215 (OV notes folder), 8 decisions being asked one at a time.
- 13/11 22:49 UK (OVERSEER 11): DATE DISPLAY DECIDED by Lisa: international '2 Mar 2026' (day, short month, year) on owner screens, exports, PDFs; staff screens '2 Mar '26' (year always shown). Replaces DD/MM/YY. Storage unchanged: ISO date, datetime UTC (S4). Month names from a language/locale row (cross-industry, international).
- 13/11 23:18 UK (OVERSEER 11): DATE DISPLAY FINAL: one format everywhere (owner, staff, print, export): '2 Mar 2026'. Lisa: year form is irrelevant as long as the year shows; same format preferred. Replaces the staff '2 Mar '26' line above. Paper catch-up DECIDED B (one entry from paper + bulk grid + owner file import with preview); evidence photo/upload/link on every option; how-entered metadata owner/admin-only unless the owner shares it. Subject photos: main + gallery (files rows, main as dated link row). Brief AA_INOUT_2026-11-13-2305 (OV notes).
- 13/11 23:38 UK (OVERSEER 11): LINKS DECIDED by Lisa (C): record-to-record LINK ROWS for things that matter (from table/id, to table/id, role word from owner rows, from_date, to_date, source, set_by, set_on; shown on both sides, added from either side, e.g. SOP 'enrichment' <-> subject) PLUS free TAGS for loose grouping/filters (no rule meaning). Existing subject_link, area_link, governed_by map onto the one link pattern (no renames until the rename sitting).
- 14/11 00:33 UK (OVERSEER 11): READINGS DECIDED by Lisa (B, closes coherence 1/8): ONE readings record for any measured value (temperature, humidity, fridge, CO2, noise, water pH/chlorine, weight, door, power...). Reading KIND = owner rows (label, unit, dated limits with source). One "Load readings file" (CSV/XLSX/Sheet link; preview + count + owner OK; each row judged by the rule in force on its date; set_by + how_entered owner-only). Lisa: "ensure the link to compliance and sops etc is there - it could be anything for any sop or requirement for compliance". So every reading kind and reading is linkable through the decided LINK ROWS (C) to SOP (governed_by), requirement/obligation, area, item, check_type (job), and an out-of-limit reading raises a finding -> fix. Thermometer = an item of kind instrument (no rename of live tables outside the plural sitting). Build owner: TEMPS (plan first; live tables need Lisa yes).
- 14/11 00:48 UK (OVERSEER 11): BUTTON WORDS DECIDED by Lisa (C): late entry = "Earlier" (+ plus icon), not "From paper" (late readings come from apps e.g. Govee, memory, paper). Year report = "Report" (page icon). File load = "Import" (upload icon). Same words on every screen (temps, jobs, any brick). how_entered values unchanged (paper/app/import etc stay owner-only metadata).

## Decision log additions (ITEMS, 14/11)

- 14/11 01:00 UK (ITEMS, from option A 13/11): NEW `items` (id, tenant_id, item_no, name, kind_key, make, model, serial_no, size, made_on, expires_on, photo, note, corrects_id, created_at, created_by). A change is a new row whose corrects_id = the item's first row id; tests point at the first id. made_on / expires_on are facts from the label (Lisa 14/11 "expiry date"), not periods, so S4.15 is not engaged. No area and no in-use dates on the item. PR 562 (merged).
- 14/11 01:00 UK (ITEMS): NEW `item_kinds` (id, tenant_id, kind_key, label, source, set_by, set_on): owner rows, e.g. appliance_class_1, appliance_class_2, extinguisher_water, extinguisher_powder, extinguisher_co2, thermometer (TEMPS shares). PR 562.
- 14/11 01:00 UK (ITEMS): check_type + target value `item` + column `item_kind`; check_log + column `item_id` (must be of the test's kind; dupKey includes item_id); check_field + columns `unit`, `limit_low`, `limit_high`, `source` (dated by effective_from; shown, never used to refuse). A form is judged by the questions in force on the record's own day (Earlier entries). qr_tag kind + `item`. PR 562.
- 14/11 01:30 UK (ITEMS): NEW `links` (id, tenant_id, from_table, from_id, role, to_table, to_id, from_date, to_date, source, set_by, set_on) = decision C. First roles: placed_in (items -> areas; a move is a new row from a later day, latest wins, so history keeps the old room), governed_by (-> sops), meets (-> requirements). Not a rename of subject_link / area_link / governed_by (sitting). Ownership of `links` asked of OV11. PR 568.
- 14/11 01:30 UK (ITEMS): archive = `requirement` row need_type `item.in_use`, target_table items, from_date..to_date, source = reason (Dead / Failed test / Replaced / Gone / Other + note). No rows = in use (S4.15). No new column.
- 14/11 01:30 UK (ITEMS): rule row `items.due_soon_days` in breeding_rule (no row = no amber; starting default proposed 30, owner sets). Status green/amber/red worked out on read, never stored.
- 14/11 01:45 UK (ITEMS): evidence files: Script Property EVIDENCE_FOLDER_ID (own Shared Drive folder), action evidence_file (photo jpeg/png/webp or PDF, 1.8 MB base64 cap), file id saved on check_log.photo / items.photo. Bridges to the designed `file` table when that goes live. PR 568.

### ITEMS outcome (14/11 01:58, OV11 ruling)
- Measured item-test values (earth bond, insulation, leakage) are readings rows: kind from reading_kinds, limits from reading_limits (scope item_kinds), check_log_id + item_id set. check_field loses unit/limit_low/limit_high/source (never live). check_values keeps only non-measured answers (visual, pressure choice, service code, notes).
- Room, SOP, compliance and evidence links use STAFF's links table (link_kind_key). ITEMS' own links spec is dropped. Kinds requested: placed_in (merge with TEMPS item_placed_in), governed_by, meets, evidence, certificate (one file to many check_logs).
- Proof photos and certificate PDFs are files rows (DOGCARD), joined by evidence/certificate links. ITEMS' Evidence.gs is dropped; check_log.photo is not used for items.
- 14/11 18:36 UK (OVERSEER 11): CODES VAULT DECIDED by Lisa (B): shared admin vault password (some devices lack Face ID). Codes encrypted in the browser (AES-GCM, PBKDF2 key); only ciphertext stored; sign-in still by hash. Who may open = owner setting codes.vault (start: owner + admin). Codes assignable to a person OR a thing via links (dated). Existing codes re-entered by the owner or a named admin, checked against hash. Build owner: ADMIN.
- 14/11 18:38 UK (OVERSEER 11): MENU DECIDED by Lisa (A): Main (rainbow: Today/Do/Decide) + up to 3 sections per person/role (owner setting) + More, sections in colour order: Compliance 2, Money 3, Ops 4, People 5, Sales 6, Ideas 7; Bin 8 in Settings. Owner default Main/Compliance/Ops/People/More. Build: SOPS.


---

## 20. Catch-up 15 Nov 2026 (J1, add only)

Written by Claude Code (ADMIN, for OVERSEER 11), 15 Nov 2026 06:37 UK. Sources: Lisa's 15 Nov answers Q1-Q8 relayed by the Steward (OV11 job file AA_OV11-STEWARD-JOBS_2026-11-15-0625, J1); live BLD-app-tables headers read 15 Nov 06:20-06:35 UK; origin/main 97331d7. Nothing above this line was changed except one version line at the top. Where an entry above is out of date it is listed in 20.6 as superseded, with the date.

STANDARD S4 applies to every entry here: plural table names (decided 13/11 22:09), S4.3 reserved names (id, created_at, updated_at), S4.15 from_date/to_date on link rows (from_at/to_at under a day), S4.6/R6 as amended 13/11 21:4x (test mode: a rename is a copy with counts read back).

### 20.1 Lisa's answers, 15 Nov 2026

| # | Topic | Decision | Schema effect (all DESIGNED unless marked) |
|---|---|---|---|
| Q1 | Edits | Edits are allowed and logged. Owner settings decide who may edit, whether a change is logged, whether a reason is needed, and who may change without a log. | permission rows (section 2) gain actions `edit`, `edit_unlogged`; rule rows `edit.log` (yes/no) and `edit.reason_required` (yes/no), each scoped per table by `.<table>` suffix, starting default: log yes, reason no, edit_unlogged nobody. Each logged edit = one audit_log row (section 12) with before, after, reason, sign_in_id. Supersedes R8's "append-only, correction is a new row" as the only way: corrects_id rows stay valid for records that already use them. |
| Q2 | Delete and archive | Both are owner settings. | permission actions `delete`, `archive` per table and role/person. Archive = an end row (to_date + reason), as R5. Delete = a real removal, logged in audit_log with the row's last values; starting default: nobody may delete, owner may archive. Retention (20.3) still applies. |
| Q3 | Dated hiding | Hide a row, a field or a column, by role or audience, between from and until dates. Owner setting. | field_visibility (LIVE) is the home. Add at the end: `row_id` (blank = every row), `role_code` (blank = use audience_id), `from_date`, `to_date` (already designed 13/11 P&A 6/19), `source`. Whole column = field_name set, row_id blank. Whole row = row_id set, field_name `*`. No new table. |
| Q4 | IDs | Every record has a permanent meaningless id and a separate editable name. History follows the id. Existing ids stay. | New rows: id = table prefix + random (e.g. `sub-7k2q9x`), never built from a name or date. Every table that shows a name has a `name` (or `label`) column the owner may edit (Q1 rules). Existing readable ids are kept and never rewritten. **Retired:** the BLD README rule (24 Sep 2026, section 14 first line) that readable ids are deliberate. |
| Q5 | One dose table | One table for vaccines, wormers and medicines, with a type column; linked to stock lots and courses. Due dates feed the calendar, compliance, SOPs and rounds. A course can be any dose type (e.g. a two-shot vaccine course). Ticking a dose writes one dose row with its lot and moves stock. | NEW `doses`: id, tenant_id, subject_id, dose_type (rows: vaccine, wormer, medicine...), product_id, lot_id, course_id, course_step, given_at, given_by, sign_in_id, route, amount, unit_id, next_due_on, due_source, note, corrects_id, created_at, updated_at. NEW `courses`: id, tenant_id, subject_id, product_id, dose_type, steps, from_date, to_date, source, set_by, set_on. The tick writes the dose row and one stock_movements row in the same save. next_due_on feeds calendar, compliance, SOP jobs and rounds by reading doses, never a copy. Live BLD-vaccination (kit, 978 rows) maps onto doses (dose_type vaccine) in the rename sitting; until then both are read. |
| Q5 | Stock chain | From BLOODLINE-LIVE-SCHEMA.md (6 Oct). | NEW (designed, BLDD names, plural): `products` (name, maker party, form, strength, unit_id, dose_type), `lots` (product_id, batch, expires_on, quantity, unit_id, supplier party, received_on), `stock_movements` (lot_id, quantity (+/-), reason row value: received, given, wasted, returned, counted; dose_id, at, by), `prescriptions` (subject_id, product_id, prescriber party, from_date, to_date, instructions, file link), `product_dose_bands` (product_id, weight from/to, amount, unit_id, from_date, to_date, source), `medicine_register` (a view over stock_movements + doses; only a table if a regulator needs a fixed register). Dog-kit medicinal_product, dispense, stock_level map onto these in the sitting. |
| Q6 | Reference lists | Vets, practices and manufacturers, with permanent ids, using the party pattern. | `parties` (section 6, party: DESIGNED; settles Q-C9 for organisations): id, tenant_id, kind (person/organisation), name. Role = `links` row (from parties to tenant or subject, role `vet`, `practice`, `manufacturer`, `supplier`...), dated. A vet who is a person in a practice = a links row person -> practice. vaccination.practice / manufacturer text stays readable; new rows hold party ids. |
| Q7 | Corrections from documents | A source document corrects an imported row by editing the same row, old values logged. Where details conflict, show both side by side for the owner to pick. No separate import-source tables. Animana is not in the base. | Edit in place under Q1 (audit_log before/after, reason = document, files row linked role `source`). Conflict view is code only (no table). No ImportBatch/ImportMapping/ImportRow tables (section 12 PROPOSED list: not adopted). readings.import_batch_id (live) stays as a plain label. No Animana-named table, column or row in the base. |
| Q8 | Certificates | One cross-industry certificate table. Cert types are list rows per industry. Breed Better reads OFA from it. | NEW `certificates`: id, tenant_id, subject_table, subject_id, cert_kind_key, issuer_party_id, number, issued_on, result, grades, expires_on, source, set_by, set_on, created_at, updated_at; the file = files row joined by links role `certificate` (as items do today). NEW `certificate_kinds` (as item_kinds): id, tenant_id, kind_key, label, issuer_hint, grades_shape, source, set_by, set_on. Dog kit rows: hips, elbows, eyes, OFA etc.; any industry adds its own. Breed Better reads OFA rows here (BB to switch its reader). Overlaps credential / credential_version (section 6, header only, unused): certificates is the home for issued documents about a subject; credential stays for a person's or site's licence. Q-C8 settled. |

### 20.2 Size bands (15 Nov 2026)

Lisa: small up to 10 kg, medium 10 to 25 kg, large 25 kg or more. No toy or extra-large band.

Live check, BLD-breeding_rule, 15 Nov 06:30 UK: `size_from_kg.medium` = 10 (from 2026-11-12, note "Medium from 10 kg; under 10 kg is small") and `size_from_kg.large` = 25 (from 2026-11-12, "25.0 counts as large"). No toy, extra-large or small row. Colour rows size_colour.small/medium/large exist. The hub reads only `size_from_kg.medium|large` (capacity.js); below medium = small.

Result: the live rows already say what Lisa said. **No rows to add or end.** A dog of exactly 10 kg is medium, 25 kg is large (as the 12 Nov notes). Size is worked out from the latest weight (12 Nov); subject.size_band stays legacy (section 10).

### 20.3 Retention and GDPR (design)

| Table / piece | Status | Columns / shape | Note |
|---|---|---|---|
| retention_setting | BUILT-NOT-LIVE (main reads BLD-retention_setting.csv; file absent 15 Nov) | id, tenant_id, section (row value: temperature, jobs, staff, subjects, sales, enquiries, files...), years, months, basis, source, from_date, to_date, set_by, set_on | R12 / Lisa 9 Nov: user-set per section; no row = the legal period if recorded, else 6 years (memory record-retention-user-set). Plural `retention_settings` in the sitting. |
| GDPR export (design) | DESIGNED | Code only: for one person id, read every table with a person_id / subject owner link / taken_by, write one ZIP (CSV per table + files list) to the owner. Logged as one audit_log row (action `export_person`). | Subject access request. Fields hidden from the requester by field_visibility are still included for the owner to review before sending. |
| GDPR erase (design) | DESIGNED | Code only: for one person id, rows past their retention are removed (Q2 delete, logged); rows still inside a retention period or a legal hold are kept and the person's name fields are blanked with reason `erasure`. One audit_log row per table touched. | LegalHold (section 13 PROPOSED, G4 yes) blocks erase. |

### 20.4 QR on add

From print Addendum 3 (J3, running in the PR-watch cloud session): adding a subject, area or item makes its qr_tag row at once. qr_tag is LIVE (id, tenant_id, tag, kind, ref_id, active, made_at, made_by); TABLE_ON_qr_tag is OFF. Rule rows: `qr.on_add.<kind>` (yes/no, owner setting, starting default yes) and `qr.tag_length` (starting 10). Seeds: one qr_tag row per existing subject, area and item, made once on switch-on. **No PR has done this yet (searched 15 Nov 06:35 UK);** J3's PR is to be referenced here when it lands.

### 20.5 Tables live but missing from or stale in this master (read 15 Nov 2026)

| Table | Status | Live columns (header row) | Note |
|---|---|---|---|
| files | LIVE (2 rows, created 15 Nov 02:09) | id, tenant_id, kind, drive_file_id, url, mime, name, size_bytes, taken_on, sha256, source, set_by, set_on, created_at, updated_at | Supersedes section 8 `file` (DESIGNED) and 14/11 01:3x spec. A file belongs through links. TABLE_ON_files OFF (needs FILES_FOLDER_ID, file.types) |
| links | LIVE (32 rows) | id, tenant_id, from_table, from_id, role, to_table, to_id, from_date, to_date, source, set_by, set_on, sort, note, created_at, updated_at | Decision C. Roles in use: reading_for_job, certificate. Supersedes section 8 document_link. Switch OFF (needs link_kind.enrolled_in) |
| items | LIVE (27 rows) | id, tenant_id, item_no, name, kind_key, make, model, serial_no, size, made_on, expires_on, photo, note, corrects_id, created_at, created_by | ITEMS 14/11. `created_by` is not an S4.3 reserved name; keep |
| item_kinds | LIVE (5 rows) | id, tenant_id, kind_key, label, source, set_by, set_on | |
| readings | LIVE (52 rows) | id, tenant_id, kind_id, area_id, item_id, subject_id, check_log_id, value_min, value_max, value, unit_id, precision_dp, period_start, taken_at, taken_by, source, how_entered, read_method, samples, device_label, area_empty, limit_id, in_range, corrects_id, note, mitigation_note, sign_in_id, import_batch_id, camera_value_changed, reset_after_reading, set_by, created_at, updated_at | The one readings table (14/11 00:33). area_reading, guest_reading, sensor_reading stay live and are read alongside (Q-C10 now: merge in the sitting) |
| reading_kinds | LIVE (3 rows) | id, tenant_id, kind_key, label, unit_id, value_shape, precision_dp, source, set_by, set_on | |
| reading_limits | LIVE (4 rows) | id, tenant_id, kind_id, scope_table, scope_id, low, high, label, from_date, to_date, source, set_by, set_on | Dated limits (R2) |
| sale | LIVE (kit, 4 rows; Drive title fixed to BLD-sale.csv, N13 closed) | id, tenant_id, subject_id, person_id, household_id, sold_on, age_at_sale_days, microchip_number_at_sale, seen_with_dam, vet_record_given, price, deposit, deposit_date, contract_document_id, notes, visibility, visible_from, visible_to, visibility_set_by | Sales kit. Kit words: dam, microchip |
| subject_owner | LIVE (5 rows) | id, tenant_id, subject_id, person_id, household_id, role, from_date, to_date, transfer_document_id, microchip_transferred_on, registry_transferred_on, notes, visibility, visible_from, visible_to, visibility_set_by | Owner over time; a links candidate (role `owner`) in the sitting |
| prospect | LIVE (enquiries kit, 103 rows, personal data) | id, tenant_id, kennel_name, contact_name, ... (44 columns incl. email, phone, licence_number, stage, notes, visibility) | Kit words throughout (kennel_name, cobberdog_capable). Owner-only. Retention section `enquiries` |
| question | LIVE (2 rows) | id, tenant_id, set_code, sort_order, text, help_text, answer_kind, options_text, required, asked_of, repeat_per_family_member, active, set_by, notes | Form questions. `active` breaks R3 |
| answer | LIVE (header only) | id, tenant_id, question_id, person_id, household_id, answered_at, value_text, word_1, word_2, word_3, option_key, number_value, date_value, notes, visibility, visible_from, visible_to, visibility_set_by | |
| association | LIVE (11 rows) | id, tenant_id, acronym, name, country_iso, country, scope, website, directory_url, is_registry, recognises_cobberdog, listed_breeders, transfer_rule, pedigree_depth_needed, barrier_to_entry, status, verified_on, note | A party list (organisation): maps to `parties` (20.1 Q6) |
| occupancy_out | BUILT-NOT-LIVE | Specs.gs on main (approval mode); no live file | Listed so it is not mistaken for live |
| code_vaults | BUILT-NOT-LIVE (PR 578, ADMIN) | id, tenant_id, code_id, cipher, iv, salt, kdf, kdf_iter, from_date, to_date, set_by, set_on | Codes vault (14/11 18:36). Sealed text only. Live steps wait for Lisa's yes |

### 20.6 Superseded entries above (15 Nov 2026)

| Where | Was | Now |
|---|---|---|
| Section 2, code_register | BUILT-NOT-LIVE (main, no file) | LIVE: BLD-code_register.csv created 13 Nov 2026 20:11 UK (header). TABLE_ON_code_register OFF |
| Section 10, locale | LIVE (not read) | LIVE, read: time_zone, from_date, to_date, source added 14 Nov 2026 20:45 (section 14 line 14/11 20:45). Code reader tzOn pending (STAFF) |
| Section 10, dog-kit vaccination | listed only | LIVE, 978 rows; column `manufacturer` added at the end 15 Nov 2026 (backup AA_CDHUB-BLD-vaccination-BACKUP_2026-11-15-0345 by the Steward). Maps to `doses` (Q5) and manufacturer -> parties (Q6) |
| Section 8, file / document_link | DESIGNED | Superseded by live `files` + `links` (20.5) |
| Section 1, R6 and section 0 step 4 | never rename | Amended 13/11 21:4x (renames are copies in the sitting); text above kept as history |
| Section 1, R8 | append-only only | Q1: owner-set edits, logged. corrects_id rows stay valid |
| Section 14, 24 Sep line | readable ids deliberate | Retired 15 Nov (Q4) |
| Section 16, N13 | BLD-sale (1).csv | Closed: live title is BLD-sale.csv |
| Section 17, Q-C8 / Q-C9 | open | Settled 15 Nov: Q8 certificates + files/links; Q6 parties for organisations |
| Section 19 | counts of 13 Nov | Replaced by 20.7 |

### 20.7 Counts (15 Nov 2026, replaces section 19)

LIVE 82 (68 + files, links, items, item_kinds, readings, reading_kinds, reading_limits, sale, subject_owner, prospect, question, answer, association, code_register). BUILT-NOT-LIVE 5 (delegation, grant_type, retention_setting, occupancy_out, code_vaults; plus V9 columns on live tables). DESIGNED 46 (38 - file, document_link + doses, courses, products, lots, stock_movements, prescriptions, product_dose_bands, medicine_register, certificates, certificate_kinds). PROPOSED 47 (50 - ImportBatch, ImportMapping, ImportRow, not adopted under Q7). Dog-kit tables not counted. Recount whenever a status changes.

### 20.8 Decision log additions (15 Nov 2026)

| Date (UK) | Decision | Source |
|---|---|---|
| 15 Nov 2026 05:01 | Q1-Q8 as 20.1 (edits logged per owner settings; delete/archive owner settings; dated hiding; meaningless ids + editable names; one dose table with stock chain and courses; party reference lists; document corrections edit in place, both shown on conflict, no import tables, no Animana; one certificate table). | Lisa via Steward, relayed by OV11 06:25 |
| 15 Nov 2026 | Size bands small < 10 kg, medium 10-25, large >= 25; no toy or extra-large. Live rows already match; nothing written. | Lisa via Steward; live check 06:30 |
| 15 Nov 2026 | Retention table and GDPR export/erase design (20.3). QR on add (20.4) waits for J3. | J1 brief |

## Decision log additions (ITEMS, 20/11)

| When | Decision | Source |
|---|---|---|
| 20 Nov 2026 | **New need_type `room.items`** on BLD-requirement (target_table area, from_date/to_date, source). A room covered by it today is offered for items (Move / Add) even when `room.in_use` keeps it off dog rounds, cleans and temps. Items room list = in use today OR `room.items` today, plus the item's own room; retired rooms (in use ended) drop out with no ZZ_ rename. Live rows 45–48: the four site rooms, from 2000-01-01, open. Backup AA_BACKUP_BLD-requirement_2026-11-20-2300__CLAUDE-CODE. | Lisa "yes hide" (ZZ_ cabins in Move), 20 Nov 2026; PR 738 |
