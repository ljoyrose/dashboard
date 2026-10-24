// One place for the dashboard's settings. None of these are secrets: the client id is the public
// Google sign-in id, and the rest are Drive folder/file ids and web addresses.
// Change an id here and all three pages (and the tests) follow it.
(function (root) {
  'use strict';
  // One list for shared drives the dashboard must never read, list, search or bin.
  // Match by id or by the drive's name. The name is the shared-drive title.
  var EXCLUDED = [
    { id: '0AEf6v2sKb4FrUk9PVA', name: 'Karen - SHARED' }
  ];
  root.DASH_CONFIG = {
    clientId: '135419966158-qqhndd85mott7p7rqbjbrji8sjhbkt88.apps.googleusercontent.com',
    scopes: {
      read: 'https://www.googleapis.com/auth/drive.readonly',
      // Full Drive scope: asked for only when the Bin actions are used (incremental consent).
      write: 'https://www.googleapis.com/auth/drive'
    },
    // Ids only, derived from cleanup.excludedDrives. Kept so older checks still find them.
    excludedDrives: EXCLUDED.map(function (d) { return d.id; }),
    // Allow-list and excluded drives live together. An empty allow-list means every
    // shared drive except the excluded list. My Drive bins only what the signed-in person owns.
    cleanup: {
      excludedDrives: EXCLUDED,
      sharedDriveAllowIds: []
    },
    urls: {
      files: 'https://www.googleapis.com/drive/v3/files',
      drives: 'https://www.googleapis.com/drive/v3/drives',
      driveApi: 'https://www.googleapis.com/drive/v3',
      moveSheet: 'https://docs.google.com/spreadsheets/d/1AIgIefQMATEdWLtAkdvE7SvdnX8g2sTX87VnvOX5c-I/edit'
    },
    home: {
      ledgerFileId: '1oIQz2HR86iL8ZuJQdKaUeEplNj0mG9GY', // RR_DELETE-LEDGER, file_id column
      cfFolderId: '1cTqxH8ROs0Fj2u5zDdZwaBsJmSrRxi_A',
      readFirstId: '1HnnW5du3PxNbg-42C6mT79dHOo_RZS-L',
      dbxFolderId: '0AEqV6Ky2jpmDUk9PVA', // Drive folder holding DROPBOX-TOTALS.json
      dbxTotalsName: 'DROPBOX-TOTALS.json'
    },
    cdhub: {
      folderId: '10m8HauOLAdj2QStgNJ2T3b3W599VXWro',
      folderName: '*01 SLA Inspections / BLD-app-tables'
    },
    // Bin guard (Apps Script, owned by lisa@puppyclassroom.com). Restores binned items that are not ZZ_DELETE_/ZZ_SUPERSEDED_
    // into 00 CHECK. The web app is domain-only, so its address is not needed by anyone outside puppyclassroom.com.
    binGuard: {
      checkFolderId: '1o7ag4AndYA20h7aOmPsm0x69q3f2PqaZ', // LD > *00 Current > 00 CHECK
      homeFolderId: '1HKAMkAER7ft-xMJYUQGzi_v6jV-3vQwk', // LD > *00 Current: the web app writes its address file here when first opened
      webAppFile: 'BIN-GUARD-WEBAPP.json',
      webAppUrl: '' // optional: paste the /exec address here instead. Left empty, the page reads it from webAppFile.
    },
    money: {
      owner: 'lisa@puppyclassroom.com',
      driveId: '0AE4lOsGSf-cXUk9PVA',
      folders: {
        index: '1wB3t6ScV6mnbKpXU6UBjnMvToUt_A7rj', // 0.1 - Index
        ops: '115saDuLMClWZVfzIYTn2fN-BjPWijgBm', // 4 - Ops, the one that holds CHECK-LOG
        accountant: '1yBTSQKXDue6gRkfLD3g6FVOIHfFnt7kQ',
        factory: '1GkoMTMmH7B_zQvq5-DY_7KUYJzTAJKB1',
        drop: '10-HE-oa3eY9cHMAn5_gWHK9GFnNcqdKe'
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);
