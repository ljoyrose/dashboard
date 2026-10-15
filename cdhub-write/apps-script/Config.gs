/**
 * BLD write sink - configuration.
 *
 * Nothing secret lives in this file. Secrets and switches live in Script
 * Properties (Project Settings > Script Properties), set by Lisa:
 *
 *   SAVE_ENABLED     'true' to switch saving on. Anything else (or missing) = OFF.
 *   TABLE_ON_<key>   'true' to let one table be written, e.g. TABLE_ON_area_reading.
 *   MODE_<key>       'direct' or 'pending'. Missing = 'pending' (safest).
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
  VERSION: '1.0.0',
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
    BACKUP_ON: 'BACKUP_ON'
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
    TEMP_MAX: 60
  },
  // The only file apart from the table files in TABLES (see Specs.gs) that the sink writes to.
  PENDING_FILE: 'BLD-_pending.csv',
  PENDING_COLUMNS: [
    'event_id', 'pending_id', 'event', 'at', 'by', 'role', 'target_file',
    'kind', 'row_id', 'corrects_id', 'note', 'payload_json', 'result'
  ]
};
