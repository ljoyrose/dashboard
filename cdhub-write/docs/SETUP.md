# SETUP - turning on staff saving (for Lisa)

**What this does.** Staff type room temperatures into a screen in Bloodline (CD Hub). A small Google program (an "Apps Script") adds each reading as one new line at the bottom of one file in your BLD-app-tables folder. It never changes or deletes a line that is already there.

**It ships OFF.** It stays off until you do step 12 (switch it on) and step 13 (tell the screens the address). You can switch it off again at any time (step 15).

**Files it may touch:** only two. `BLD-area_reading.csv` (the temperature log) and `BLD-_pending.csv` (the waiting list). Nothing else, ever. The cabin-placement log and the staff roster are only proposals in the code and are refused until you agree them.

**Please do not edit those two files by hand in Drive.** A hand edit can collide with a save, and it leaves no record. If a reading is wrong, send a correction from the screen.

**Time:** about 40 minutes the first time. Do the practice run (step 8) before the real folder.

Words used here:
- **Apps Script** = a free program that lives in your Google account and can read and write your Drive files.
- **Deployment** = publishing that program at a web address so the screens can talk to it.
- **Script Property** = a private setting stored inside the program. Not visible to anyone else.
- **Staff code** = a personal password-like code for each person who saves readings.

---

## A. Make the program

1. Sign in to Google with your work account (the one that owns the BLD folder). Open **script.google.com** and press **New project**. Name it `BLD save`.
2. Add the code. In the left list, next to **Files**, press **+**.
   - Choose **Script** nine times, one for each name: `Config`, `Csv`, `Specs`, `Validate`, `Auth`, `Store`, `Sink`, `Web`, `Admin`. Paste in the matching file from the `apps-script` folder (for example `Config.gs` goes in `Config`). Delete the empty `Code.gs` the editor made.
   - Choose **HTML** once, name it `ApprovePage`, and paste in `ApprovePage.html`.
   - Open **Project Settings** (cog icon) and tick **Show "appsscript.json" manifest file in editor**. Go back to Editor, open `appsscript.json`, and replace its contents with the `appsscript.json` from the folder.
3. Press **Save** (disk icon).

## B. Private settings

4. Open **Project Settings** and scroll to **Script Properties**. Press **Add script property** and add these three:
   - `BLD_FOLDER_ID` = the long text at the end of the BLD-app-tables folder's web address in Drive. **Use your practice folder for now (step 8).**
   - `TENANT_ID` = the `id` in the first data row of `BLD-tenant.csv` (it starts `ten-`).
   - `ADMIN_EMAILS` = your own Google address (the one that will approve). More than one: separate with commas.
5. In the editor, choose the function **adminSetup** from the drop-down at the top and press **Run**. Google will ask you to allow access and say the app is "not verified". That is normal for your own program: press **Advanced**, then **Go to BLD save (unsafe)**, then **Allow**.
6. Give each person a staff code. Open `Admin`, find `adminAddStaffCode`, change `NAME` to the person's name and `ROLE` to `STAFF` (or `OWNER` for you). Press **Run**. Open **Execution log** at the bottom: it shows the code **once**. Write it down and give it to that person. It cannot be shown again (it is stored scrambled). Repeat for each person. To see who has codes: run `adminListStaff`. To stop someone: change `NAME` in `adminRevokeStaff` and Run.

## C. The two new files (your decision)

The temperature log and the waiting list do not exist yet. The program will **not** create them by itself.

7. Create them one of two ways:
   - **Easy way:** add the Script Property `ALLOW_CREATE` = `true`. Run `adminCreateEmptyTables`. It makes `BLD-area_reading.csv` and `BLD-_pending.csv` with a header line only (and refuses to touch any file that already exists). **Then set `ALLOW_CREATE` back to `false`.**
   - **By hand:** make two text files with these names, each holding this single header line:
     - `BLD-area_reading.csv`: `id,tenant_id,area_id,reading_type,min_c,max_c,spot_c,precision_dp,period_start,taken_at,taken_by,device_id,reset_after_reading,applied_limit_id,in_range,compliant,mitigation_required,corrects_id,mitigation_note`
     - `BLD-_pending.csv`: `event_id,pending_id,event,at,by,role,target_file,kind,row_id,corrects_id,note,payload_json,result`

   Two columns, `corrects_id` and `mitigation_note`, are my proposal and are not in the original design (see the Q&A rows).

## D. Practice first (recommended)

8. In Drive make a new folder `BLD practice`. Copy into it `BLD-area.csv`, `BLD-subject.csv`, `BLD-person.csv` and `BLD-role.csv`. Point `BLD_FOLDER_ID` at this folder, run step 7 so the two new files land here, then do steps 9 to 14. When you are happy, change `BLD_FOLDER_ID` to the real folder and run step 7 again there.

## E. Publish and switch on

9. Run `adminCheckSetup`. Every line should say `OK` (or `--` for things fine to be missing). Fix any line saying `FIX`.
10. **Deploy > New deployment**. Type **Web app**. Description `BLD save`. **Execute as: Me. Who has access: Anyone.** Press **Deploy** and **copy the Web app URL** (ends `/exec`). "Anyone" only means anyone holding the address can knock. Every save still needs a staff code.
11. **Deploy > New deployment** again, for the approval page. **Execute as: User accessing the web app. Who has access: Only myself.** Copy that URL and add `?page=approve` to the end. Bookmark it.
12. Switch saving on. Add Script Properties `SAVE_ENABLED` = `true` and `TABLE_ON_area_reading` = `true`. Leave `MODE_area_reading` unset: everything then **waits for your approval**. To let staff readings go straight in, set it to `direct` (corrections still wait for you).
13. Tell the screens: open Bloodline, go to **Enter temperatures**, find **Turn saving on**, paste the step 10 URL, press **Use this address**. The banner changes to "Saving is on." Repeat on each device (the design note describes an optional shared settings file instead).
14. Try it: enter a reading with a staff code, open your approval page, press **Approve**, check the new line at the bottom of `BLD-area_reading.csv`.

## F. Day to day

- **Approve:** open your approval bookmark. **Approve** adds one line. **Reject** adds nothing.
- **A wrong entry:** nothing can be edited or deleted. The person presses **Send a correction**; it waits for you, and when approved becomes a **new** line pointing at the old one.
- **New staff:** step 6. **Someone leaves:** `adminRevokeStaff`.
- **If a save ever fails its safety check:** the program puts the exact old text back, tells the person, and writes a line `write_check_failed` in `BLD-_pending.csv`. Open that file and run `adminCheckSetup` before saving again.

## G. Switch off or undo (step 15)

15. **Instant off:** set `SAVE_ENABLED` to `false` (or delete it). **Full stop:** Deploy > Manage deployments > archive both. **Undo something written:** send a correction. In an emergency, right-click the file in Drive > **Manage versions** and restore the earlier version.

## H. Optional: a daily backup copy

Off unless you turn it on. Each night it copies the two files into a sub-folder called `BLD-backups`, as `BLD-area_reading.csv.pre-daily-<date>.bak`, one copy per file per day. It never deletes or overwrites anything, so the copies pile up and you decide when to tidy them. CD Hub does not load them (they are `.bak` files in a sub-folder).

- **Turn on:** add the Script Property `BACKUP_ON` = `true`, then run `adminInstallDailyBackup` once.
- **Turn off:** run `adminRemoveDailyBackup` (existing copies stay), and set `BACKUP_ON` to `false`.

## Changing the code later

Edit the file, then **Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy**. The address stays the same.

## If something looks wrong

Run `adminCheckSetup`; read the `FIX` lines. Common ones: "two files called X" (rename one), "header does not match" (someone edited the first line; put it back as in step 7).
