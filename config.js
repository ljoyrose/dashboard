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
      write: 'https://www.googleapis.com/auth/drive',
      // Personal Drive page only: a second, look-only sign-in. Its token stays in memory and is never used for work calls.
      personal: 'https://www.googleapis.com/auth/drive.metadata.readonly'
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
      dbxTotalsName: 'DROPBOX-TOTALS.json',
      // Stage 9: iCloud and Mac dry-run reports, written by the private engines into the same folder (look only).
      coverageReports: { icloud: 'ICLOUD-REPORT.json', mac: 'MAC-REPORT.json' }
    },
    cdhub: {
      folderId: '10m8HauOLAdj2QStgNJ2T3b3W599VXWro',
      folderName: '*01 SLA Inspections / BLD-app-tables'
    },
    // Marketplace page: the "Marketplace" tab of RR_OPEN-WORK (filled by the RR_MKT-ENGINE Apps Script). Taps write only the
    // answer cells. wakeFolderId/wakeFile: optional Drive file holding the engine's web-app address (empty = the engine's
    // 15-minute timer picks taps up). live: false shows the TEST stamp until Lisa switches the engine to LIVE.
    // GA Hub (food/): Designer Dog Foods orders, GA invoices and the product list. Read with Lisa's sign-in from RR_FOOD
    // (RR_DDF folder), which the RR_FOOD-ENGINE Apps Script fills. The page writes only the 4 answer cells of a Cards row.
    food: {
      bookId: '1Lags6XfdNhvxwxGNgEKwfoosHr6ci9rzG-QXulgCfxU', // RR_FOOD (RR_DDF folder)
      live: false
    },
    // Studio page (studio/): asset hub. Reads studio-state.json from logsFolderId (written by the STUDIO-ENGINE Apps Script);
    // until it exists the page shows built-in example data and sends nothing. Clicks drop one request file into requestsFolderId.
    studio: {
      rootFolderId: '1zY7WMtfw_w5GioaoQlyEKkew-0dYZLvQ', // RR_Studio (shared drive "7 - Purple - Assets Ideas")
      logsFolderId: '1Yq9ELzfAE27sxD1k3_KYEDCSz5BzmcdI', // holds studio-state.json
      requestsFolderId: '13KclIUhOej1bmoQznfbrUiHtoab-FnDV', // the page writes request JSON files here
      inboxFolderId: '1poaewHMRwrOcXwXa0PrMZhnmhyn66BzL', // Ideas > Inbox - drop files here
      stateFile: 'studio-state.json',
      live: false
    },
    marketplace: {
      openWorkId: '1ShYbYmY8W-MEWqm9kHFsIcS5uR4b2SG00uXle_yL76U', // RR_OPEN-WORK (00 AI Commons)
      tab: 'Marketplace',
      listingsFileId: '1JkewFinU42nKX7JDEwRHZY0I-FKdBhdW', // RR_LISTINGS.csv: read only, for the second photo on "Same item?" cards
      wakeFolderId: '',
      wakeFile: 'MKT-WAKE-WEBAPP.json',
      live: false
    },
    // App Factory page (factory/): reads af-state.json from logsFolderId (written by AF-ENGINE); writes request files into
    // requestsFolderId. The Idea Form is the front door (AF-ENGINE writes the card and the ClickUp task).
    factory: {
      logsFolderId: '1e04LM9qA2lXpy63Qfcd7x9HEEjhsMj9k',
      requestsFolderId: '1Z1Iuc_rRFq7cy12ELM0seZ-onpCSfDQ2',
      ideaFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfzzTnlyNWeXzFEz9NfYxNXsCFN6KwV8RxFyIRTJZ-WrH15nw/viewform'
    },
    // Bin guard (Apps Script, owned by the business account). Restores binned items that are not ZZ_DELETE_/ZZ_SUPERSEDED_
    // into 00 CHECK. The web app is domain-only, so its address is not needed by anyone outside the business domain.
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
