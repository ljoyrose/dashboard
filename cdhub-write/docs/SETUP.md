# SETUP - turning on staff saving, the daily location check and staff reading (for Lisa)

**What this does.** Staff use screens in Bloodline (CD Hub): **Where is everyone?** (the daily check of which room each dog is in) and **Enter temperatures**. A small Google program (an "Apps Script") adds each entry as one new line at the bottom of a file in your BLD-app-tables folder. Staff can never change or delete a line that is already there. Only you can, from your own approvals page (section G).

**It ships OFF.** Nothing happens until you do steps 12 to 15. You can switch it all off again at any time (step 19).

**Files it may touch:** only three.
- `BLD-area_reading.csv` - the temperature log (new file).
- `BLD-occupancy.csv` - where each dog is (your existing file). A move **adds a new line** (dog, room, today's date). It never changes an old line and never fills in `moved_out`. A dog's current room is its line with the latest `moved_in`. Has its own switch, **off by default**.
- `BLD-_pending.csv` - the **approvals queue** (new file).

Nothing else, ever. The daily check log (`BLD-occupancy_check.csv`) and the staff roster are only proposals in the code and are refused until you agree them.

**Please do not edit those files by hand in Drive.** A hand edit can collide with a save, and it leaves no record. If an entry is wrong: staff send a correction from the screen (it goes into the approvals queue for you); you can fix it yourself from your approvals page (section G).

**Time:** about 50 minutes the first time. Do the practice run (step 8) before the real folder.

Words used here:
- **Apps Script** = a free program that lives in your Google account and can read and write your Drive files.
- **Deployment** = publishing that program at a web address so the screens can talk to it.
- **Script Property** = a private setting stored inside the program. Not visible to anyone else.
- **Staff code** = a personal password-like code for each person. No Google sign-in is needed for staff.
- **Approvals queue** = the list of entries waiting for you (`BLD-_pending.csv`). Approve adds one line; Reject adds nothing.

---

## A. Make the program

1. Sign in to Google with your work account (the one that owns the BLD folder). Open **script.google.com** and press **New project**. Name it `BLD save`.
2. Add the code. In the left list, next to **Files**, press **+**.
   - Choose **Script** ten times, one for each name: `Config`, `Csv`, `Specs`, `Validate`, `Auth`, `Store`, `Sink`, `Read`, `Web`, `Admin`. Paste in the matching file from the `apps-script` folder (for example `Config.gs` goes in `Config`). Delete the empty `Code.gs` the editor made.
   - Choose **HTML** once, name it `ApprovePage`, and paste in `ApprovePage.html`.
   - Open **Project Settings** (cog icon) and tick **Show "appsscript.json" manifest file in editor**. Go back to Editor, open `appsscript.json`, and replace its contents with the `appsscript.json` from the folder.
3. Press **Save** (disk icon).

## B. Private settings

4. Open **Project Settings** and scroll to **Script Properties**. Press **Add script property** and add these three:
   - `BLD_FOLDER_ID` = the long text at the end of the BLD-app-tables folder's web address in Drive. **Use your practice folder for now (step 8).**
   - `TENANT_ID` = the `id` in the first data row of `BLD-tenant.csv` (it starts `ten-`).
   - `ADMIN_EMAILS` = your own Google address (the one that will approve and edit). More than one: separate with commas.
5. In the editor, choose the function **adminSetup** from the drop-down at the top and press **Run**. Google will ask you to allow access and say the app is "not verified". That is normal for your own program: press **Advanced**, then **Go to BLD save (unsafe)**, then **Allow**.
6. Give each person a staff code. Open `Admin`, find `adminAddStaffCode`, change `NAME` to the person's name and `ROLE` to `STAFF` (or `OWNER` for you). Press **Run**. Open **Execution log** at the bottom: it shows the code **once**. Write it down and give it to that person. It cannot be shown again (it is stored scrambled). Repeat for each person. To see who has codes: run `adminListStaff`. To stop someone: change `NAME` in `adminRevokeStaff` and Run.

## C. The two new files (your decision)

The temperature log and the approvals queue do not exist yet. The program will **not** create them by itself. (`BLD-occupancy.csv` already exists.)

7. Create them one of two ways:
   - **Easy way:** add the Script Property `ALLOW_CREATE` = `true`. Run `adminCreateEmptyTables`. It makes `BLD-area_reading.csv` and `BLD-_pending.csv` with a header line only (and refuses to touch any file that already exists). **Then set `ALLOW_CREATE` back to `false`.**
   - **By hand:** make two text files with these names, each holding this single header line:
     - `BLD-area_reading.csv`: `id,tenant_id,area_id,reading_type,min_c,max_c,spot_c,precision_dp,period_start,taken_at,taken_by,device_id,reset_after_reading,applied_limit_id,in_range,compliant,mitigation_required,corrects_id,mitigation_note`
     - `BLD-_pending.csv`: `event_id,pending_id,event,at,by,role,target_file,kind,row_id,corrects_id,note,payload_json,result`

   Two columns, `corrects_id` and `mitigation_note`, are my proposal and are not in the original design (see the Q&A slip).

## D. Practice first (recommended)

8. In Drive make a new folder `BLD practice`. Copy into it `BLD-area.csv`, `BLD-subject.csv`, `BLD-subject_status.csv`, `BLD-occupancy.csv`, `BLD-person.csv`, `BLD-role.csv` and `BLD-field_visibility.csv`. Point `BLD_FOLDER_ID` at this folder, run step 7 so the two new files land here, then do steps 9 to 17. Practice moves land in the **copy** of `BLD-occupancy.csv`, so the real one is never touched. When you are happy, change `BLD_FOLDER_ID` to the real folder and run step 7 again there.

## E. Publish and switch on

9. Run `adminCheckSetup`. Every line should say `OK` (or `--` for things fine to be missing). Fix any line saying `FIX`.
10. **Deploy > New deployment**. Type **Web app**. Description `BLD save`. **Execute as: Me. Who has access: Anyone.** Press **Deploy** and **copy the Web app URL** (ends `/exec`). "Anyone" only means anyone holding the address can knock. Every save and every read still needs a staff code.
11. **Deploy > New deployment** again, for your approvals page. **Execute as: User accessing the web app. Who has access: Only myself.** Copy that URL and add `?page=approve` to the end. Bookmark it.
12. Switch **saving** on. Add Script Properties `SAVE_ENABLED` = `true` and `TABLE_ON_area_reading` = `true`. Temperature readings then go **straight in** (they are added at once and cannot be edited by staff). To hold them in the approvals queue instead, add `MODE_area_reading` = `pending`. Corrections always go to the approvals queue.
13. Switch the **daily location check** on (separately): add `TABLE_ON_occupancy` = `true`. Moves then go **into the approvals queue** for you. If you would rather they go straight in, add `MODE_occupancy` = `direct`. Remember a wrong move is fixed by moving the dog again (or by you, section G).
14. Let staff **read** (so staff can load the dogs with their own code, no Google sign-in): add `READ_ENABLED` = `true`, then add the rows you agree from `AA_2026-10-16_JOB4-PROPOSED-visibility-rows__claude-job4.csv` to your `BLD-field_visibility.csv` (replace `ten-REPLACE-ME` with your tenant id). **No row, no reading: nothing is shown to anyone by default.** What each row means is in the MAP note. The script only ever reads that file; it never changes it.
15. Tell the screens: open Bloodline, go to **Where is everyone?** (or **Enter temperatures**), find **Turn saving on**, paste the step 10 URL, press **Use this address**. The banner changes to "Saving is on." Repeat on each device. Staff then type their code and press **Load the dogs**.
16. Try it: load the dogs, tap **Moved** on one, pick a room, **Save move**, open your approvals page, press **Approve**, check the new line at the bottom of `BLD-occupancy.csv`.
17. Tap **Same** on a dog. Until you agree the daily check log (a proposal), the tap is kept on the screen only and the screen says so. Nothing is written.

## F. Day to day

- **Approve:** open your approvals bookmark. **Approve** adds one line. **Reject** adds nothing.
- **A wrong entry (staff):** staff cannot edit or delete. For a temperature they press **Send a correction**; it goes into the approvals queue and, when you approve, becomes a **new** line pointing at the old one. For a dog in the wrong room they move it again.
- **New staff:** step 6. **Someone leaves:** `adminRevokeStaff`.
- **If a save ever fails its safety check:** the program puts the exact old text back, tells the person, and writes a line `write_check_failed` in `BLD-_pending.csv`. Open that file and run `adminCheckSetup` before saving again.

## G. Fixing a wrong entry yourself (owner only, off by default)

Only you can do this, from your approvals page, signed in with your own Google account. Staff codes cannot reach it, not even an `OWNER` code.

18. Add the Script Property `OWNER_EDIT_ENABLED` = `true`. On your approvals page, under **Edit an entry**, choose the list, press **Show newest entries**, then **Edit** on the entry, change the values, tick the box and press **Overwrite this entry**.

**What to know before you use it:**
- It **overwrites the entry in place**. **No record of the old value is kept** by this system: no extra line, no log.
- Drive's own **file history** still holds the earlier version of the whole file for a while (right-click the file, Manage versions), and so do the nightly backup copies if you switch them on (section H). You cannot make those disappear from here.
- Anyone looking at the log later, an inspector for example, will see only the corrected value. For anything an inspector might ask about, a **correction** (a new line pointing at the old one) is the version that shows its working.
- You can change the fields staff could enter (for a temperature: room, min, max, spot, period start, note; for a dog's location: dog, room, and the dates `moved_in` and `moved_out`). You cannot change the id, who entered it or when.
- It uses the same lock and file check as a staff save, so it cannot clash with one: if someone is saving at that moment it says "Someone else is saving right now", and you press again.
- To switch it off: set `OWNER_EDIT_ENABLED` to `false` (or delete it).

## H. Optional: a daily backup copy

Off unless you turn it on. Each night it copies the three files into a sub-folder called `BLD-backups`, as `BLD-area_reading.csv.pre-daily-<date>.bak`, one copy per file per day. It never deletes or overwrites anything, so the copies pile up and you decide when to tidy them. CD Hub does not load them (they are `.bak` files in a sub-folder).

- **Turn on:** add the Script Property `BACKUP_ON` = `true`, then run `adminInstallDailyBackup` once.
- **Turn off:** run `adminRemoveDailyBackup` (existing copies stay), and set `BACKUP_ON` to `false`.

## I. Switch off or undo

19. **Instant off:** set `SAVE_ENABLED` to `false` (or delete it). Reading has its own switch, `READ_ENABLED`, and owner edit has `OWNER_EDIT_ENABLED`. **Full stop:** Deploy > Manage deployments > archive both. **Undo something written:** send a correction (or section G). In an emergency, right-click the file in Drive > **Manage versions** and restore the earlier version.

## Changing the code later

Edit the file, then **Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy**. The address stays the same.

## If something looks wrong

Run `adminCheckSetup`; read the `FIX` lines. Common ones: "two files called X" (rename one), "header does not match" (someone edited the first line; put it back as in step 7).
