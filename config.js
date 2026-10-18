// One place for the dashboard's settings. None of these are secrets: the client id is the public
// Google sign-in id, and the rest are Drive folder/file ids and web addresses.
// Change an id here and all three pages (and the tests) follow it.
(function (root) {
  'use strict';
  root.DASH_CONFIG = {
    clientId: '135419966158-qqhndd85mott7p7rqbjbrji8sjhbkt88.apps.googleusercontent.com',
    scopes: {
      read: 'https://www.googleapis.com/auth/drive.readonly',
      // Full Drive scope: asked for only when the Bin actions are used (incremental consent).
      write: 'https://www.googleapis.com/auth/drive'
    },
    // Hard rule 14: never list, read, search or bin these shared drives on any page. Checked before any query.
    // 0AEf6v2sKb4FrUk9PVA = Karen - SHARED.
    excludedDrives: ['0AEf6v2sKb4FrUk9PVA'],
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
