# SETUP - turning on staff saving (for Lisa)

**What this does.** Staff type room temperatures into a screen. A small Google program (an "Apps Script") adds each reading as one new line at the bottom of a file in your BLD-app-tables folder. It never changes or deletes a line that is already there.

**It ships OFF.** Nothing happens until you do steps 9 to 11. You can switch it off again at any time (step 15).

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
   - Choose **Script** nine times, one for each name: `Config`, `Csv`, `Specs`, `Validate`, `Auth`, `Store`, `Sink`, `Web`, `Admin`. Paste in the matching file from the `code/apps-script` folder (for example `Config.gs` goes in `Config`). Delete the empty `Code.gs` the editor made.
   - Choose **HTML** once, name it `ApprovePage`, and paste in `ApprovePage.html`.
   - Open **Project Settings** (cog icon) and tick **Show "appsscript.json" manifest file in editor**. Go back to Editor, open `appsscript.json`, and replace its contents with the `appsscript.json` from the folder.
3. Press **Save** (disk icon).

## B. Private settings

4. Open **Project Settings** and scroll to **Script Properties**. Press **Add script property** and add these three (the first two are in your own files, nothing to invent):
   | Name | Value |
   |---|---|
   | `BLD_FOLDER_ID` | The long text at the end of the BLD-app-tables folder's web address in Drive. **Use your practice folder for now (step 8).** |
   | `TENANT_ID` | The `id` in the first data row of `BLD-tenant.csv` (it starts `ten-`). |
   | `ADMIN_EMAILS` | Your own Google address (the one that will approve). More than one: separate with commas. |
5. In the editor, choose the function **adminSetup** from the drop-down at the top and press **Run**. Google will ask you to allow access. It will say the app is "not verified". That is normal for your own program: press **Advanced**, then **Go to BLD save (unsafe)**, then **Allow**. (It is "unverified" only because you wrote it for yourself and did not send it to Google for review.)
6. Give each person a staff code. Open `Admin`, find `adminAddStaffCode`, change `NAME` to the person's name and `ROLE` to `STAFF` (or `OWNER` for you). Press **Run**. Open **Execution log** at the bottom: it shows the code **once**. Write it down and give it to that person. It cannot be shown again (it is stored scrambled). Repeat for each person. To see who has codes: run `adminListStaff`. To stop someone: change `NAME` in `adminRevokeStaff` and Run.

## C. The two new files (your decision)

The temperature log and the waiting list do not exist yet. The program will **not** create them by itself.

7. Create them one of two ways:
   - **Easy way:** in Project Settings add the Script Property `ALLOW_CREATE` = `true`. Run `adminCreateEmptyTables`. It makes `BLD-area_reading.csv` and `BLD-_pending.csv` with a header line only (and refuses to touch any file that already exists). **Then set `ALLOW_CREATE` back to `false`.**
   - **By hand:** make two empty text files with these names and paste in this single header line each:
     - `BLD-area_reading.csv`: `id,tenant_id,area_id,reading_type,min_c,max_c,spot_c,precision_dp,period_start,taken_at,taken_by,device_id,reset_after_reading,applied_limit_id,in_range,compliant,mitigation_required,corrects_id,mitigation_note`
     - `BLD-_pending.csv`: `event_id,pending_id,event,at,by,role,target_file,kind,row_id,corrects_id,note,payload_json,result`

   Two columns, `corrects_id` and `mitigation_note`, are my proposal and are not in the original design. See the Q&A slip.

## D. Practice first (recommended)

8. In Drive make a new folder `BLD practice`. Copy into it `BLD-area.csv`, `BLD-subject.csv`, `BLD-person.csv` and `BLD-role.csv`. Point `BLD_FOLDER_ID` at this folder, run step 7 so the two new files land here, then do steps 9 to 14. When you are happy, change `BLD_FOLDER_ID` to the real folder and run step 7 again there. Copies are your files, so practice entries never touch the real ones.

## E. Publish and switch on

9. Run `adminCheckSetup`. Every line should say `OK` (or `--` for things that are fine to be missing). Fix any line that says `FIX`.
10. Press **Deploy > New deployment**. Type: **Web app**. Description `BLD save`. **Execute as: Me. Who has access: Anyone.** Press **Deploy** and **copy the Web app URL** (it ends `/exec`). "Anyone" only means anyone holding the address can knock. Every save still needs a staff code.
11. Press **Deploy > New deployment** again for the approval page. **Execute as: User accessing the web app. Who has access: Only myself.** Copy that URL and add `?page=approve` to the end. Bookmark it. This is where you approve entries.
12. Switch saving on. In Script Properties add:
    - `SAVE_ENABLED` = `true`
    - `TABLE_ON_area_reading` = `true`
    - Leave `MODE_area_reading` unset. Everything then **waits for your approval**. To let staff readings go straight in, set it to `direct` (corrections will still wait for you).
13. Tell the screens. Open the test page (`client/index.html` on the web) or the Bloodline / Board screen, find **Turn saving on**, paste the **step 10** URL, press **Use this address**. The banner changes to "Saving is on."
14. Try it: enter a reading with a staff code. Open your approval page, press **Approve**. Check the new line at the bottom of `BLD-area_reading.csv`.

## F. Day to day

- **Approve:** open your approval bookmark. Each item shows who sent it and the numbers. **Approve** adds one line. **Reject** adds nothing.
- **A wrong entry:** nothing can be edited or deleted. The person presses **Send a correction**. It waits for you, and when approved it becomes a **new** line pointing at the old one.
- **New member of staff:** step 6. **Someone leaves:** `adminRevokeStaff`.

## G. Switch it off, or undo (step 15)

15. **Instant off:** set `SAVE_ENABLED` to `false` (or delete it). Every screen shows "Saving is off" within moments.
   **Full stop:** Deploy > Manage deployments > archive both deployments. The address stops working.
   **Undo something already written:** nothing is overwritten, so just send a correction. In a real emergency, right-click the file in Drive > **Manage versions** and restore the earlier version (Drive keeps the previous copy).

## Changing the code later

Edit the file in the project, then **Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy**. The address stays the same.

## If something looks wrong

Run `adminCheckSetup` and read the lines starting `FIX`. Common ones: "two files called X" (two files in the folder share a name; rename one), "header does not match" (someone edited the first line of the file; put it back as in step 7).
