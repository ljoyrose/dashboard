/**
 * BLD write sink - configuration.
 *
 * Nothing secret lives in this file. Secrets and switches live in Script
 * Properties (Project Settings > Script Properties), set by Lisa:
 *
 *   SAVE_ENABLED     'true' to switch saving on. Anything else (or missing) = OFF.
 *   TABLE_ON_<key>   'true' to let one table be written, e.g. TABLE_ON_area_reading, TABLE_ON_occupancy.
 *                    Every table is OFF until its own switch is 'true'.
 *   MODE_<key>       'direct' or 'pending'. Missing = the table's own default (temperature log: direct;
 *                    occupancy moves: pending). Corrections ALWAYS go to the approvals queue.
 *   OWNER_EDIT_ENABLED  'true' to let Lisa (signed in, owner page only) overwrite a wrong entry IN PLACE.
 *                    OFF by default. No record of the old value is kept by this script.
 *   READ_ENABLED     'true' to let staff codes READ lists (default OFF). What each role may see is
 *                    decided by rows in BLD-field_visibility.csv; no row = nothing (default deny).
 *   BLD_FOLDER_ID    Drive folder id of BLD-app-tables.
 *   TENANT_ID        tenant id written on every row (e.g. the kennel's tenant id).
 *   ADMIN_EMAILS     comma list of Google accounts allowed to approve pending rows.
 *   CODE_SALT        random text, created by adminSetup(). Never share.
 *   STAFF_REGISTRY   JSON of hashed staff codes, managed by adminAddStaffCode().
 *   ALLOW_CREATE     'true' only while Lisa runs adminCreateEmptyTables().
 *   BACKUP_ON        'true' to let the optional daily backup copy run (see adminInstallDailyBackup).
 *
 * NOBODY should hand-edit the files this script writes to. Edits in Drive can collide with a save and
 * are not recorded. Corrections go through the screen.
 */
var BLD = {
  VERSION: '1.1.0',
  TZ: 'Europe/London',
  PROP: {
    SAVE_ENABLED: 'SAVE_ENABLED',
    TABLE_ON_PREFIX: 'TABLE_ON_',
    MODE_PREFIX: 'MODE_',
    FOLDER_ID: 'BLD_FOLDER_ID',
    TENANT_ID: 'TENANT_ID',
    ADMIN_EMAILS: 'ADMIN_EMAILS',
    SALT: 'CODE_SALT',
    REGISTRY: 'STAFF_REGISTRY',
    ALLOW_CREATE: 'ALLOW_CREATE',
    BACKUP_ON: 'BACKUP_ON',
    READ_ENABLED: 'READ_ENABLED',
    OWNER_EDIT_ENABLED: 'OWNER_EDIT_ENABLED'
  },
  LIMITS: {
    MAX_BODY_CHARS: 20000,
    MAX_TEXT_CHARS: 500,
    FAIL_WINDOW_SEC: 600,   // bad staff codes are counted for 10 minutes
    FAIL_MAX: 25,           // after this many, every save is refused until the window ends
    DUP_WINDOW_MIN: 30,     // a second reading for the same room inside this window is refused
    PERIOD_MAX_AGE_HOURS: 168,
    REQUEST_CACHE_SEC: 21600,
    LOCK_WAIT_MS: 20000,
    TEMP_MIN: -30,
    TEMP_MAX: 60,
    READ_MAX_ROWS: 3000     // a read never returns more rows than this
  },
  // The permissions file the read action consults. It is only ever READ by the script.
  VISIBILITY_FILE: 'BLD-field_visibility.csv',
  // The approvals queue: the only file apart from the table files in TABLES (see Specs.gs) that the sink writes to.
  PENDING_FILE: 'BLD-_pending.csv',
  PENDING_COLUMNS: [
    'event_id', 'pending_id', 'event', 'at', 'by', 'role', 'target_file',
    'kind', 'row_id', 'corrects_id', 'note', 'payload_json', 'result'
  ]
};
