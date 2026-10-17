/* BLD schema — every field, with provenance.
   LAW      named in legislation now in force
   SOON     Act passed, commencement / secondary legislation pending
   PROPOSED live consultation, NOT law
   OPS      your own operation, from export.ops + the vet file
   JUDGE    Claude's judgement — required by nothing, argued for
*/
var SCHEMA_FULL=[

['tenant','The business holding the licence','ops',[
 ['jurisdiction','enum wales | england | scotland','LAW','<b>Decides which rule set applies.</b> The whole point — one app, three regimes'],
 ['licence_number','text','LAW',''],
 ['licensing_authority','text','LAW','the local authority'],
 ['licence_start · licence_expiry','date','LAW',''],
 ['max_breeding_bitches','int','LAW','Scotland sets this <b>on the licence</b>; litters in 12m must not exceed it'],
 ['star_rating','int 1-5','LAW','England risk/star system; drives licence duration'],
 ['trading_name · address · phone · email','text','OPS',''],
 ['default_vet_practice','ref','OPS','']]],

['area','Rooms and cabins','ops',[
 ['code','text','OPS','<code>3A.1F</code>, <code>H2</code>, <code>3S.2/3L ISO</code> — <b>grammar still undecoded</b>'],
 ['name','text','OPS','what you call it out loud'],
 ['kind','enum room | cabin | run | whelping | isolation | exercise','OPS','you said rooms or cabins; <code>ISO</code> in your codes implies isolation'],
 ['access_type','enum single_with_limited | single_with_free | other','LAW','<b>from your Cabin sizes sheet, and it CHANGES THE CAPACITY.</b> H3 is “Single with Free” and takes 3 small-with-pups; H1 and H2 are “Single with Limited” and take 2. I had capacity as a function of m² alone — it is not'],
 ['parent_area_id','ref','JUDGE','a block containing rooms. Your codes look hierarchical'],
 ['floor_area_m2','decimal','LAW','your <code>M2</code> column'],
 ['whelping_permitted','bool','LAW','your <code>Whelp?</code> column'],
 ['isolation_capable','bool','LAW',''],
 ['heating · ventilation · lighting','text','LAW','named in licence conditions; not currently recorded'],
 ['cctv_installed','bool','PROPOSED','recurring proposal; cheap to carry, impossible to backfill'],
 ['in_service_from · in_service_to','date','JUDGE','<b>an area that closed must not vanish</b> — past occupancy still refers to it']]],

['area_capacity','Capacity per size band — your Rules.csv','ops',[
 ['area_id','ref','LAW',''],
 ['size_band','enum -10kg | 10-25kg | 25kg+','LAW','your three columns'],
  ['access_type','enum free | limited','LAW','<b>statutory in Wales</b> — free = unrestricted daily access to an exercise area, limited = restricted. <b>The same m² permits different numbers.</b> This is your “Single with Free” / “Single with Limited” column, and it is not a local convention'],
  ['dogs_permitted','int','LAW','the N in the statutory table — Wales gives a required area <i>per number of dogs</i>, and it is <b>not linear</b>: two small dogs need the same 2.5 m² as one'],
  ['required_m2','decimal(6,2)','LAW','<b>store the statutory figure and derive the capacity, never the other way round.</b> The guidance says “N dogs need X m²”; the app asks “how many fit in X m²” — same row, read backwards'],
 ['max_dogs','int','LAW',''],
 ['max_with_pups','int','LAW','your <code>SML+P</code> / <code>Med+P</code> / <code>Lge+P</code>'],
 ['max_litters_no_dam','int','LAW','your <code>Litter/No Mum</code>'],
 ['effective_from · effective_to','date','JUDGE','<b>so a capacity change does not rewrite history</b>']]],

['environment_limit','CORRECTION — the range belongs to the OCCUPANTS, not the room','risk',[
 ['category','enum Pups with mum | Pups without mum | Whelping | Breeding Female | Retired Female | Stud Male | In Training | Isolation','LAW','<b>Lisa 23 Sep — her own short names, replacing my neonate / pre_weaning / bitch_with_pups.</b> “Pups without mum” is already her <code>Litter/No Mum</code> column in Rules.csv, so the vocabulary was hers first. <b>The range is determined by who is in the room</b>'],
 ['min_c · max_c','decimal(5,2)','LAW','<b>Wales, verified: 10.00–26.00 general · 26.00–28.00 for pups under four weeks.</b> The two overlap at one degree, which is why the category and not the room decides'],
 ['stepdown_rule','text','LAW','“then start reducing ready for garden” — the puppy band walks down with age'],
 ['escalation_action · escalate_within','text · interval','LAW','<b>fading puppy syndrome is the named risk, so the clock matters</b>'],
 ['rule_scope_id','ref','LAW','some of these come from the council, not the regulations'],
 ['area_override_id','ref area','OPS','an area can be stricter than its occupants require — never laxer'],
  ['effective_from · effective_to','date','LAW','<b>a changed requirement is a NEW ROW, never an edited column.</b> <b>Lisa 23 Sep: “when they increase size then it’s a row not a column”.</b> Bands move — Wales is 10–26°C today and 26–28°C for under-4-weeks; if that is edited in place, every past reading is re-judged against a rule that did not exist when it was taken']]],

['occupancy_board','YOUR SPREADSHEET — computed, never typed','est',[
 ['area_id','ref','OPS','<b>this is the screen you will use every day</b>, and it is your Rules.csv made live'],
 ['occupants_now','computed from occupancy','OPS','each with name, size band, life stage, age'],
 ['count_by_size_band','computed','LAW','against <code>area_capacity</code> — your <code>-10kg</code> / <code>10-25kg</code> / <code>25kg+</code> columns'],
 ['mums_in_area · studs_in_area · litters_in_area','computed','LAW','<b>you type these three today.</b> Typed counts drift the moment a dog moves and nobody updates the sheet — computed, they cannot'],
 ['headroom','computed','OPS','<b>how many more, of what size, may go in</b> — the number you actually want'],
 ['governing_temp_band','computed','LAW','from the most demanding occupant'],
 ['m2 · m2_per_dog','decimal · computed','LAW','<b>the cabin’s floor area is what sets the whole thing</b>'],
 ['STORED?','—','JUDGE','<b>nothing.</b> Every figure derives from <code>occupancy</code> and <code>area_capacity</code>. A stored occupancy count is a second source of truth and it is always the one that is wrong']]],

['placement_check','May THIS dog go in THERE, right now','risk',[
 ['subject_id · area_id · proposed_at','ref · ref · datetime','OPS','<b>asked BEFORE the move, not discovered after</b>'],
 ['capacity_ok','computed','LAW','is the band full? — <i>“3B.5F is at 3 of 3 for 10–25kg”</i>'],
 ['with_pups_ok','computed','LAW','your <code>SML+P</code> / <code>Med+P</code> / <code>Lge+P</code> allowance is a different, smaller number'],
 ['temperature_ok','computed','LAW','<b>would adding this dog change the governing band?</b> Moving one Pups-with-mum group in pulls the whole room to 26–28°C and may put it instantly out of range'],
 ['whelping_ok','computed','LAW','your <code>Whelp?</code> flag'],
 ['isolation_ok','computed','LAW','biosecurity — in or out, and who else is in there'],
 ['licence_ok','computed','LAW','is this dog on the licence, and does the area’s classification match'],
 ['verdict · reasons','computed','OPS','<b>yes or no, with the reason in plain words.</b> A refusal that does not say why gets overridden'],
 ['THE POINT','—','JUDGE','<b>this is the one function that makes the app worth opening instead of the spreadsheet.</b> The sheet shows you the state and leaves you to do the arithmetic. This answers the question you were doing the arithmetic for — and it is the same check an inspector runs backwards over your records']]],

['applicable_limit','Resolved from who was actually in there','risk',[
 ['area_id · at_time','ref · datetime ISO','LAW',''],
 ['occupants','computed from occupancy','LAW','<b>this is what makes <code>occupancy</code> load-bearing twice</b> — it already proved capacity; now it decides the temperature band too'],
 ['governing_category','computed','LAW','<b>the MOST DEMANDING occupant wins.</b> One Pups-with-mum group in a room of Breeding Females pulls the whole room to 26–28°C'],
 ['resolved_min_c · resolved_max_c','computed','LAW',''],
 ['THE RETROFIT TRAP, DOUBLED','—','JUDGE','<b>a past temperature reading cannot be judged without knowing who was in the room at that moment.</b> If occupancy is a current field rather than a history, <b>every historical reading becomes unassessable</b> — and an inspector asking about a date in March gets no answer. <code>occupancy</code> was already not-retrofittable for capacity. This makes it twice as not-retrofittable']]],

['device','Thermometers and anything that must be calibrated','risk',[
 ['area_id · kind · identifier','ref · enum thermometer | scale | fridge | other · text','LAW','your Temperature Monitoring SOP names <b>device calibration</b>'],
 ['last_calibrated_on · calibration_due','date','LAW','<b>an uncalibrated thermometer makes every reading it took unevidenced</b>'],
 ['certificate_document_id','ref','LAW','']]],

['area_reading','Temperature — min and max, not a number','risk',[
 ['area_id','ref','LAW',''],
 ['reading_type','enum temperature | humidity | clean | check','LAW',''],
 ['min_c · max_c','decimal(5,2)','LAW','<b>Lisa 23 Sep: min AND max per area, to TWO DECIMAL PLACES.</b> A min/max thermometer reports a range over a period, not a spot value. Two columns, never one'],
 ['spot_c','decimal(5,2)','OPS','the reading at the moment of checking, where one is also taken'],
 ['precision_dp','int','LAW','<b>what the council requires — not how the app chooses to display it</b>'],
 ['period_start · taken_at','datetime ISO','LAW','<b>the window the min and max cover</b>, and when it was read'],
 ['taken_by · device_id','ref','LAW','unattributed, or from an uncalibrated device, proves nothing'],
 ['reset_after_reading','bool','OPS','a min/max thermometer must be reset or the next reading repeats this one'],
 ['applied_limit_id · in_range','ref · computed','LAW','<b>stamp WHICH band was applied, not just pass or fail.</b> Occupancy gets corrected later, and a judgement you cannot reproduce is not evidence'],
 ['compliant','computed','LAW','<b>NOT THE SAME AS in_range, and this is the important one.</b> Lisa 23 Sep, from her inspectors: if the outside temperature is high and the limit cannot be avoided, it is acceptable <i>provided there is a note saying what was done about it</i>. So: <b>in_range = false AND mitigation recorded → compliant. in_range = false AND nothing recorded → the finding.</b> An app that reported every exceedance as a failure would show red on the hottest week of the year for a breeder who did everything right'],
 ['mitigation_required','computed','LAW','<b>true the moment a reading falls outside the band</b> — so the app asks for the note then, while someone still remembers, not at audit time in November'],
 ['PRECISION CANNOT BE RECOVERED','—','JUDGE','<b>round 21.47 to 21.5 on input and no later change can get it back.</b> If the app captures 1dp and the council wants 2, every historical record fails and there is no fix. Same class as <code>valid_to</code> and <code>BR-ENTITLE-SCOPED</code> — <b>decide before the first row, or never</b>'],
 ['STORE WHAT WAS READ','—','JUDGE','store the raw value at full precision and <b>format on display</b>. A stored rounded number is a lost measurement; a rounded display is a preference']]],

['reading_requirement','How often, how far apart, how precise','risk',[
 ['rule_scope_id','ref','LAW','<b>set by the authority, not the regime</b>'],
 ['area_kind or area_id','ref','LAW','some areas need it and some do not'],
 ['readings_per_day','int','LAW','<b>two</b>'],
 ['min_hours_apart · tolerance_hours','decimal','LAW','<b>“12 hours ish apart”.</b> That “ish” is the whole design: the rule is a <b>tolerance window</b>, not a schedule. Two readings at 09:00 and 10:00 fail; 08:00 and 19:30 pass'],
 ['precision_dp','int','LAW','<b>2 for the councils that ask</b>'],
 ['requires_min_max','bool','LAW',''],
 ['COMPLIANCE IS COMPUTED','—','JUDGE','<b>“did this area get two readings today, far enough apart, at the right precision?”</b> — answered from the rows, per area, per day. That is the inspector’s actual question, and it is never a stored flag'],
 ['THE GAP IS THE ALERT','—','JUDGE','<b>a missed second reading is only visible near the end of the window.</b> At 18:00 with one reading logged, the app should be saying so — not reporting a failure the next morning when nothing can be done'],
  ['effective_from · effective_to','date','LAW','<b>a changed requirement is a NEW ROW, never an edited column.</b> A council that moves from one reading a day to two, or from 1dp to 2dp, must not make yesterday’s compliant records retrospectively non-compliant']]],

['subject_status','ACTIVE OR NOT — the tickbox, with a date on it','risk',[
 ['tenant_id · subject_id','ref','LAW',''],
 ['state','text closed set Active | In Training | Resting | Retired | Rehomed | Sold | Deceased','OPS','<b>Lisa’s tickbox, made dateable.</b> In her Infinity system a female is filtered by an Active tick; untick it and she drops out of the working list but stays a breeding female. <code>Resting</code> is between seasons — not retired, not available'],
 ['from_date · to_date','date','LAW','<b>THE ARCHIVE RULE, thirteenth application, and the one with the sharpest consequence.</b> A tickbox answers “is she active now”. An inspector asks <b>“how many breeding bitches did you have on 18 August”</b> — and a tickbox cannot answer it, because unticking destroyed the only evidence she ever was'],
 ['reason','text','OPS','age · litters completed · health · temperament · owner decision — the first thing asked about an early retirement'],
 ['decided_by · decided_on','ref staff · date','OPS',''],
 ['ONE ROW OPEN AT A TIME','—','JUDGE','<b>the current state is the row with no to_date.</b> Same shape as occupancy, same shape as feeding_plan — built once, understood everywhere']]],

['occupancy','Which dog was where, and when','risk',[
 ['subject_id','ref','LAW','<b>the single most important new table</b>'],
 ['area_id','ref area','LAW','<b>NULL MEANS NOT ON THE PREMISES</b>, deliberately. A dog away at stud, at the vet overnight, boarding, or gone to a new home still needs a row saying so — otherwise “not in any room” and “has left” look identical, and neither licence count can tell them apart'],
 ['off_site_kind','text closed set rehomed | sold | at_stud | boarding | vet | show | other','LAW','<b>only where area_id is null.</b> Lisa: “retired and rehomed, then collected removes her from my count” — collection ends the on-site row and opens an off-site one, which is what makes the count fall without anyone maintaining it'],
 ['moved_in · moved_out','datetime ISO','LAW','your <code>WHERE?</code> is a field. An inspector asks about a <b>date</b>'],
 ['reason','text','JUDGE','whelping, isolation, sale, routine']]],

['subject','The dog — one table, never three','ops',[
 ['name · call_name','text','LAW',''],
 ['sex','text closed set female | male','LAW','<b>needed by the statutory count, not just for display</b> — “breeding bitch” is sex plus age plus entire, so all three have to be readable'],
 ['dob','date ISO','LAW','drives every age rule in all three regimes'],
 ['dod · cause_of_death','date · text','LAW','<b>you have <code>Dead?</code> as a flag.</b> England 6(9) wants date AND cause'],
 ['breed · type · description','text','LAW',''],
 ['coat_colour_id · coat_pattern_id · nose_pigment_id','ref','LAW','<b>COLOUR IS A TABLE, NOT A LIST — Lisa 24 Sep: “colours can be complicated”.</b> It was a free-text column and briefly a closed set; both are wrong. A closed set cannot take <i>phantom</i>, <i>sable</i>, <i>brindle</i>, <i>abstract</i> or a two-tone nobody has met yet without a schema change, and on this platform a <code>select</code> option list does not even persist (PR147). <b>Rows can be added by the breeder on a Tuesday afternoon. That is the whole difference</b>'],
 ['coat_type · height_cm','text · decimal','OPS',''],
 ['normally_resides_address','text','LAW','<b>England 6(9), and you do not hold it</b> — matters for guardian homes'],
 ['current_microchip','computed','LAW','<b>MOVED OUT 24 Sep — five columns became two tables.</b> subject held <code>microchip_number</code>, <code>microchip_implant_date</code>, <code>microchip_location</code>, <code>microchip_database</code> and <code>microchip_transfer_date</code>, which works only while a dog has exactly one chip on exactly one database for its whole life. <b>Neither holds.</b> The readable current chip is derived from the <code>microchip</code> row with no <code>failed_on</code>; the registry it sits on is derived from its current <code>microchip_registration</code> row'],
 ['sire_id · dam_id','ref subject','LAW','<b>on this table. Never a separate sires or dams table</b>'],
 ['kind','text closed set Breeding Female | Stud Male | Pup | Guardian | Companion','OPS','<b>WHAT SHE IS — AND IT DOES NOT CHANGE WHEN SHE RETIRES.</b> Lisa 23 Sep: “she still shows as a breeding female (as likely mum to the offspring)”. Retirement is not a different kind of dog; the pedigree still needs her to be the dam. <b>Active Female was removed — it was the same thing as Breeding Female</b>, and the activeness it tried to express is a dated row, not a second kind'],
 ['breeding_status','text closed set Breeding | In Training','LAW','<b>Lisa 23 Sep: “change not on licence to In Training — this means not breeding”.</b> Replaced the old <code>on_licence</code> bool and her <code>Not_on_Licence_26</code> column. <b>In Training is a positive state, not an absence</b> — a dog being brought on. A standing designation rather than an event, so it stays a column'],
 ['CORRECTED 23 SEP — ONE COLUMN WAS DOING THREE JOBS','—','JUDGE','<b>subject carried <code>status</code>, <code>in_my_care</code> and <code>counts_toward_licence_max</code> — three undated fields overlapping, each half-answering a different question.</b> Lisa’s own Infinity system already separates them and this now matches it: <b>WHAT she is</b> — <code>kind</code>, above, permanent · <b>WHETHER she is active</b> — <code>subject_status</code>, a dated row, her tickbox with a date on it · <b>WHETHER she is here</b> — <code>occupancy</code>, which already existed. Three facts, three homes, and both licence counts fall out of them. <b><code>retained_for_breeding</code> was checked and KEPT</b> — it looked like a fourth duplicate and is not: it turns the screening schedule on for a pup long before she is a Breeding Female'],
 ['counts_toward_licence_max','computed','LAW','<b>DERIVED, NEVER STORED — and it is THREE counts, not one. Two are statutory and one is yours, and they legitimately disagree.</b> Verbatim from the Animal Welfare (Breeding of Dogs) (Wales) Regulations 2014, interpretation section, read from legislation.gov.uk 23 Sep 2026: <b>“adult dog” means “a dog which is not less than 6 months old”</b>; <b>“breeding bitch” means “an un-neutered female dog that is not less than 6 months old”</b>. <b>(1) ADULT DOGS</b> — any dog ≥ 6 months kept here. This is the number reg 8(2)(b) caps and the number the 1 FT per 20 / 1 PT per 10 staffing ratio in reg 8(2)(c) divides. <b>(2) BREEDING BITCHES, STATUTORY</b> — sex female, age ≥ 6 months, <code>neuter_status</code> entire, kept here. <b>THE DEFINITION CONTAINS NO TEST OF INTENTION, ACTIVITY OR WHETHER SHE HAS EVER BEEN BRED.</b> <b>(3) ACTIVE BREEDING FEMALES</b> — yours: <code>kind</code> Breeding Female and <code>subject_status</code> Active. Operational, not legal'],
 ['THE GAP BETWEEN COUNT 2 AND COUNT 3, WHICH IS THE ONE THAT BITES','—','LAW','<b>Lisa 23 Sep: “it depends if spayed — a breeding bitch is aged over 6 months and entire”. She is right, and the law is blunter than the working practice.</b> You retire a bitch and untick Active. In law she is <b>still a breeding bitch</b> — entire, over six months, kept here — until she is spayed or she leaves. So your list says one number and an inspector counts another, and the inspector’s is the one on the licence. <b>THE APP MUST SHOW BOTH AND NAME THE DIFFERENCE</b>, never reconcile them into a single figure. It is also the argument for spaying a retired bitch you intend to keep: that, or rehoming her, is the only thing that changes the statutory count'],
 ['licence_size_classification','enum','LAW','your existing column'],
 ['neuter_status','text closed set entire | neutered','LAW','<b>DEFAULT: entire (Lisa 23 Sep). PROMOTED FROM OPS TO LAW the same day</b> — it was filed as an ops nicety and it is not: <code>entire</code> is half the statutory definition of a breeding bitch, so this one field is load-bearing on the licence. <b>ENTIRE IS ALSO THE SAFE DEFAULT, and the direction matters:</b> a wrong default of entire OVER-counts and you notice it on the licence return; a wrong default of neutered UNDER-counts and nobody notices until an inspection. <code>unknown</code> was considered and dropped — a dog arriving without papers defaults to entire like every other, which is the cautious reading rather than a gap'],
 ['neuter_date','date','LAW','<b>THE FIELD THAT MAKES THE COUNT ANSWERABLE.</b> <code>neuter_status</code> alone cannot answer “how many breeding bitches did you have in August” — only the date can, because she counted right up to the day of the operation. Same failure as a tickbox, one level down'],
 ['WHERE THE DEFAULT ACTUALLY LIVES','—','LAW','<b>NOT on the column — the platform does not store defaults at all (settled).</b> So “default entire” is set by the create form and by any import, and an empty value is read as entire everywhere it is used. Worth writing down, because a default that exists only in one screen is a default that a bulk import will quietly ignore'],
 ['acquired_from · acquired_on','text · date','JUDGE','traceability — where a dog came in from'],
 ['import_country · import_date','text · date','SOON','Import Act 2025'],
 ['mutilation_status','enum none | ears_cropped | tail_docked','SOON','<b>Import Act bans importing mutilated animals</b> — becomes a declarable fact'],
 ['conformation_risk','enum','PROPOSED','extreme-conformation policy is live. A flag now costs nothing'],
 ['retained_for_breeding','bool','OPS','<b>the switch that turns the screening schedule on</b>'],
 ['warning','text','OPS','Animana carries a <b>persistent alert</b> on the patient, shown on every screen — “muzzle”, “no NSAIDs”. Not a note; a flag'],
 ['insurance_number','text','OPS','on the Animana patient record'],
 ['cph','text','OPS','County Parish Holding number — on the Animana patient'],
 ['age','computed','OPS','<b>shown on the card</b>, derived from DOB — and it is what surfaces the next screening rung']]],

['microchip','THE CHIP ITSELF — and a dog can have more than one','risk',[
 ['tenant_id · subject_id','ref','LAW',''],
 ['chip_number','text','LAW','<b>TEXT, ALWAYS, AND THIS IS NOT PEDANTRY.</b> Your own export carries chips as <code>9.7720001008243E+14</code> — a spreadsheet decided a 15-digit identifier was a number and rounded it. You never add two chip numbers together. <b>Stored as a number it is silently destroyed, and the rounded copy cannot be un-rounded</b>'],
 ['implanted_on','date','LAW','<b>Lisa 24 Sep: “as well as recording the chip you need implanted on DATE”.</b> Separate from the date it was registered and from the date keepership transferred — three different dates that a single column collapses'],
 ['implant_date_source','text closed set stated | inferred_first_visit | unknown','LAW','<b>THE INGESTION RULE, AND IT HAS TO BE RECORDED AS A RULE.</b> Lisa 24 Sep: “the microchip will be specified separately if done on a different date, otherwise it is at the first vet appointment.” That is a sound default and it is still an inference. MEASURED, NOT ASSUMED: of 36 dogs matched to the vet system, <b>only 2 carried an implant date</b> — so 34 of 36 would be filled by inference. <b>A date that arrived by rule must not read as a date that was observed</b>, because an inspector asking when a dog was chipped is entitled to know which it was. One extra column turns a silent guess into a stated method'],
 ['implanted_by · implanter_practice','ref person · text','LAW','who did it. An implanter must be qualified, and the record is the only evidence of that'],
 ['implant_site','text','OPS','your vet file records “front of right shoulder” — and it matters when a chip will not read and someone has to know where to scan'],
 ['is_import_chip','bool','LAW','a dog arriving from abroad carries a chip implanted under another country’s scheme — valid, but not on a UK database'],
 ['failed_on · failure_reason','date · text closed set migrated | not_reading | removed | duplicate | other','LAW','<b>WHY THIS IS A TABLE AND NOT A COLUMN.</b> Chips migrate and chips stop reading, and a vet implants a second one. The dog then has two numbers, both real, one current — and every past record that quoted the old number must still make sense. A column would have to be overwritten, which breaks the paperwork behind it'],
 ['scanned_confirmed_on','date','OPS','<b>from your own 12-point check: “CHECK CHIP IF UNSURE”.</b> A chip nobody has scanned since implantation is a chip you are assuming works']]],

['microchip_registration','WHICH DATABASE — and there is more than one','risk',[
 ['microchip_id','ref microchip','LAW',''],
 ['database','text closed set Petlog | AVID PETtrac | MicroChipCentral | Identibase | Animal Tracker | MicroDogID | Pet Identity UK | UK PETtrac | other','LAW','<b>Lisa 24 Sep: “which registry it is registered with, so there are more than one — AVID or Petlog etc”.</b> Reg 6(9) requires the microchip <i>and database</i> details, and it does not assume one. TEXT with an <code>other</code> value, never <code>select</code> (PR147) — databases merge, rebrand and close, and a closed list that cannot take a new name is a list people work around'],
 ['registered_on','date','LAW','<b>not the implant date.</b> A chip implanted on the Tuesday and registered on the Friday is unregistered for three days, and that gap is exactly when a puppy goes missing'],
 ['reference','text','OPS','the database’s own reference, where it issues one'],
 ['keeper_person_id','ref person','LAW','<b>the recorded keeper, which is the thing the law actually cares about.</b> The chip is only useful if the name against it is right'],
 ['is_current','bool','LAW','<b>one current row per chip.</b> The same chip can sit on two databases at once — yours from birth, the new owner’s after transfer — and both rows are true'],
 ['transferred_on · transferred_to_person_id','date · ref person','LAW','<b>keepership transfer, the post-collection item most often missed.</b> It is a dated row here and a blocking line on the post-adoption checklist, and those are the same fact seen from two ends'],
 ['evidence_document_id','ref document','LAW','the confirmation from the database — what you show when someone says it was never done'],
 ['WHY NOT ONE DATABASE COLUMN','—','LAW','<b>because a chip legitimately lives on more than one register over its life, and sometimes at the same time.</b> You register the litter on yours; the buyer registers on theirs; an importer’s chip is already on a foreign one. One column holds the last person to type in it, and loses the trail that proves you did your part'],
 ['AND IT IS THE SAME SHAPE AS registration','—','JUDGE','<b><code>registration</code> already does this for MDBA and the Kennel Club — registry numbers as rows, not columns.</b> A microchip database is a registry. Same pattern, built twice deliberately because the fields differ, but if either ever needs changing, check the other']]],

['coat_colour','THE COLOURS — rows, added as they are met','ops',[
 ['id · tenant_id','text · ref','LAW',''],
 ['name','text','LAW','<b>your words.</b> Chocolate · Apricot/Gold · Crm/Gold · Black. One row each'],
 ['base_family','text','JUDGE','<b>the grouping you filter by</b> when the exact name is too fine — Apricot/Gold and Apricot/Red both sit under Apricot'],
 ['swatch_hex','text','JUDGE','so the app can draw it. A dog record with no picture still shows the colour'],
 ['registry_term','text','OPS','<b>what the MDBA or KC calls it</b>, where that differs from what you call it. Two names, one row — not two rows'],
 ['nose_pigment_applies','bool','LAW','<b>Lisa 24 Sep: nose colour “is only applicable for shades of yellow”.</b> Apricot, cream, gold and red carry (b) or (r); chocolate and black do not — their nose follows the coat. <b>So the pigment field is not optional-everywhere, it is required-on-some and meaningless-on-others</b>, and the table has to say which. Otherwise a form asks for a rose nose on a chocolate dog and someone answers'],
 ['aliases','text','OPS','<b>the spellings already in your data</b>: Crm, Choc, Choc Merle. This is where a normaliser looks, so an old spelling keeps resolving instead of becoming a new colour'],
 ['active · sort_order','bool · int','OPS','<b>retire a colour, never delete it</b> — dogs recorded under it must still read'],
 ['WHY A TABLE AND NOT AN ENUM','—','LAW','<b>because a new colour is a Tuesday, not a release.</b> An enum needs a developer; a row needs a breeder. And your own data already carries four spellings of two colours, which a fixed list would have made permanent']]],

['coat_pattern','Solid, merle, parti — and the ones not met yet','ops',[
 ['id · tenant_id','text · ref','LAW',''],
 ['name','text','LAW','solid · merle · parti · phantom · sable · brindle · abstract'],
 ['is_double_merle_risk','bool','LAW','<b>the one field here that is not cosmetic.</b> Merle to merle is a mating the app should refuse to plan, so the pattern has to be readable by <code>mating_exclusion</code>, not buried in a colour string'],
 ['description · active · sort_order','text · bool · int','OPS','']]],

['nose_pigment','Black nose, rose nose','ops',[
 ['id · tenant_id','text · ref','LAW',''],
 ['name · code · active','text · text · bool','OPS','<b>kept apart from colour because your own data keeps it apart</b> — “Apricot/Gold (Rose Nose)” is one colour with two pigments, not two colours. <code>code</code> holds your shorthand: <b>(b) black, (r) rose</b>'],
 ['swatch_hex','text','JUDGE','so it can be drawn as a mark on the coat swatch rather than a ring around it — a ring on a pale coat is invisible'],
 ['ONLY ON YELLOWS','—','LAW','<b>this table joins to a colour only where <code>coat_colour.nose_pigment_applies</code> is true.</b> Two tables and one flag, instead of a nullable column nobody can interpret']]],

['registration','Registry numbers — a row, not a column','ops',[
 ['subject_id','ref','OPS',''],
 ['registry','enum KC | MDBA | other','OPS','you hold MDBA today; <b>a second registry must not need a schema change</b>'],
 ['number · name_if_different · registered_on','text · text · date','OPS','']]],

['visit','A vet visit','ops',[
 ['subject_id · date','ref · date ISO','LAW',''],
 ['practice · clinician','text','LAW','6(9) veterinary treatment; the clinician is named in your file'],
 ['reason','text','OPS','']]],

['visit_item','Typed line-items — the vet system’s own model','ops',[
 ['visit_id','ref','OPS',''],
 ['item_type','enum product | vaccine | measurement | appointment | attachment | treatment | note','OPS','<b>seven types, one table.</b> A new type is a value, not a migration'],
 ['product · strength · batch','text','LAW','batch matters for a vaccine recall'],
 ['qty · unit · dose','decimal · text','LAW',''],
 ['value','text','OPS','for measurements'],
 ['instruction · note','text','OPS','']]],

['vaccination','Every dose — never “last”','risk',[
 ['subject_id · visit_id','ref','LAW',''],
 ['vaccine_type','enum DHP | L2 | L4 | KC | Rabies','LAW',''],
 ['product · batch · date ISO','text · text · date','LAW','<b>batch is the one your sheet cannot give an inspector</b>'],
 ['administered_by','text','LAW',''],
 ['next_due','computed','JUDGE','<b>never stored</b> — derived from the last dose and the product interval']]],

['treatment','Wormer, flea, dental — every application','risk',[
 ['subject_id · visit_id','ref','LAW','6(13) preventative or curative healthcare'],
 ['treatment_type','enum wormer | parasiticide | dental | other','LAW',''],
 ['product · dose · weight_at_dose','text · text · decimal','LAW','<b>dose is weight-banded</b>, so the weight at the time is part of the record'],
 ['date ISO · administered_by · next_due','date · text · computed','LAW','']]],

['weight','Every weighing — with BCS and a photo','ops',[
 ['subject_id · weight_kg · taken_at','ref · decimal · datetime ISO','OPS',''],
 ['size_band','computed','JUDGE','<b>derived, never stored</b> — your sheet stores it and it goes stale'],
 ['bcs_score','int','OPS','<b>Lisa: 1–9.</b> Recurs in every vet note'],
 ['bcs_scale','enum 9 | 5','OPS','<b>YOUR OWN VET FILE USES BOTH.</b> One entry reads <code>bcs 5/9</code>, another <code>Body conditioning score: 3/5</code>. Without the scale, 3/5 and 3/9 are indistinguishable — one is underweight, one is ideal'],
 ['media_id','ref media','OPS','<b>the BCS photo.</b> A score with a photo beside it is evidence; a score alone is an opinion'],
 ['assessed_by','ref','OPS','']]],

['media','Photos and video — the dog’s gallery','est',[
 ['subject_id or litter_id or area_id','ref','OPS','<b>a photo can belong to a dog, a litter or a room</b>'],
 ['kind','enum photo | video','OPS',''],
 ['stored_blob_id','ref','JUDGE','<b>never a URL.</b> Your Infinity keys rotate'],
 ['taken_at','datetime ISO','OPS','<b>from the file’s own metadata where possible</b>, not the upload date — an inspector asks when it was taken'],
 ['taken_by','ref','OPS',''],
 ['caption','text','OPS',''],
 ['is_licence_evidence','bool','LAW',''],
 ['visible_to_buyer','bool','OPS','a separate switch — a photo can be proof without being shared, and shared without being proof'],
 ['superseded_by','ref','JUDGE','a re-shoot replaces it; the old one is kept']]],

['media_purpose','One photo, several jobs','est',[
 ['media_id','ref','OPS',''],
 ['purpose','enum enrichment | socialisation | bcs | conformation | area_condition | milestone | marketing | incident','LAW','<b>Wales requires enrichment and socialisation programmes</b> — the photo is how they are proved'],
 ['condition_ref','ref licence_condition','LAW','which licence condition this photo evidences'],
 ['WHY A JOIN AND NOT A COLUMN','—','JUDGE','<b>one photo is often several things at once</b> — a puppy meeting a visitor is enrichment AND socialisation AND a milestone for the buyer. A single purpose column forces you to pick one and lose the others']]],

['health_screen','Screenings — UNLIMITED rows per dog per test','risk',[
 ['subject_id','ref','OPS',''],
 ['scheme','enum OFA | BVA | KC | PennHIP | other','OPS','<b>a new scheme is a value, never a schema change</b>'],
 ['test','enum hips | elbows | eyes | heart | patella | spine | other','OPS',''],
 ['taken_on','date ISO','OPS',''],
 ['age_at_evaluation_months','computed','OPS','<b>from DOB — and it is what decides whether the result is provisional or final</b>'],
 ['stage','ref screening_scheme_stage','OPS','which rung of the scheme this one is'],
 ['result · score · grade','text','OPS','<b>free text.</b> OFA says NORMAL; BVA gives a hip score; PennHIP a distraction index. One enum cannot hold all three'],
 ['is_final','computed','OPS','<b>derived from the scheme, never typed.</b> OFA is final at 24 months; earlier ones are preliminary'],
 ['certificate_id','ref certificate','OPS',''],
 ['expires_on','date','JUDGE','eye tests expire; a result with no expiry reads as current forever'],
 ['NO LIMIT','—','OPS','<b>Lisa 23 Sep: three OFA X-rays per dog — 4M+, 12M+, 24M+ — and other schemes differ.</b> Your sheet has <code>4 month OFA</code>, <code>4 Month X-Ray</code> and <code>12M Xrays</code> as separate COLUMNS. As rows there is no ceiling, and a fourth re-take needs nothing built']]],

['screening_scheme_stage','The schedule per scheme — rows, not code','est',[
 ['scheme · test','enum','OPS','OFA/hips, OFA/elbows, BVA/hips …'],
 ['stage_name','text','OPS','“preliminary 4M”, “preliminary 12M”, “final 24M”'],
 ['min_age_months','int','OPS','<b>4, 12, 24 for OFA.</b> BVA and PennHIP have their own'],
 ['is_final','bool','OPS','only the last rung certifies'],
 ['purpose','text','OPS','early cull decision · interim check · certification'],
 ['source_citation','text','JUDGE','the scheme’s own published rule'],
 ['effective_from · effective_to','date','JUDGE','<b>schemes change their thresholds.</b> A 2022 result is judged by the 2022 rule'],
 ['THE POINT','—','JUDGE','<b>adding PennHIP, or a breed council scheme, is rows.</b> Nothing is rebuilt and no count is hardcoded anywhere']]],

['screening_plan','What is due, and only if you opted in','risk',[
 ['subject_id','ref','OPS',''],
 ['retained_for_breeding','bool','OPS','<b>Lisa 23 Sep: screening is flagged only when the dog is retained.</b> A pup going to a pet home is not put on the schedule'],
 ['opted_in_schemes','list','OPS','“we opt to screen this dog” — <b>per dog, per scheme.</b> Not everything, not automatically'],
 ['decided_on · decided_by','date · ref','JUDGE','when you decided to keep it back, and who'],
 ['next_stage_due','computed','OPS','<b>next rung whose min_age_months the dog has reached, with no result recorded</b>'],
 ['STORED?','—','JUDGE','<b>only the flag and the opt-in are stored.</b> What is due is computed from age against the scheme — a stored due-date goes stale the moment a result lands']]],

['fit_to_breed','A dated assessment, not a flag','risk',[
 ['subject_id','ref','LAW',''],
 ['assessed_on','date ISO','LAW','<b>recurs annually in your vet file</b>'],
 ['assessed_by · practice','text','LAW','a named vet'],
 ['axis','enum historic_health | physical_fitness | mental_fitness','LAW','<b>CORRECTION — your vet list scores THREE separately:</b> Historic Health, Physical Fitness to Breed, and <b>Mental Fitness to Breed</b>. I had one verdict. Temperament is assessed on its own and can fail alone'],
 ['outcome','enum fit | not_fit | fit_with_conditions','LAW',''],
 ['conditions_noted','text','LAW','“no conditions that can affect breeding potential noticed”'],
 ['valid_until','date','JUDGE','<b>“fit to breed” with no expiry proves nothing to an inspector</b>'],
 ['document_id','ref','LAW','']]],

['mating','Every mating, successful or not','risk',[
 ['dam_id · sire_id','ref','LAW',''],
 ['mated_on','date ISO','LAW',''],
 ['method','enum natural | AI','LAW','Scotland says “mated or undergoes a breeding procedure”'],
 ['successful','bool','LAW','<b>England 6(9): “whether or not successful”. Your sheet only records the ones that worked</b>'],
 ['dam_age_at_mating','computed','LAW','12-month floor everywhere; <b>8-year ceiling in Scotland</b>'],
 ['interval_since_last_litter','computed','LAW','one litter per 12 months'],
 ['rule_check','computed','JUDGE','tested against jurisdiction_rule at the date of mating']]],

['litter','The whelp record','risk',[
 ['dam_id · sire_id · litter_ref','ref · ref · text','LAW',''],
 ['whelped_on','date ISO','LAW',''],
 ['whelp_started_at','datetime','LAW','<b>England wants the TIME of birth</b>'],
 ['total_pups · males · females · stillborn','int','LAW',''],
 ['placentae_passed','int','LAW','<b>named in 6(7) and absent from your sheet</b>'],
 ['delivery_method','enum natural | caesarean','LAW',''],
 ['caesarean_reason','text','LAW','<b>Scotland bars a bitch after ONE caesarean if it was due to conformation</b> — so the reason is load-bearing, not a note'],
 ['attending_vet','text','LAW',''],
 ['significant_events','text','LAW','6(7) “any other significant events”'],
 ['dam_lifetime_litter_no','computed','LAW','max 6'],
 ['reared_at_area_id','ref area','JUDGE','which room the litter was reared in']]],

['care_protocol','LITTER CARE — age-banded, so it generates itself','est',[
 ['category','enum In utero | Pups with mum | Pups without mum | Weaning | Juvenile | Breeding Female | Stud Male | Retired Female | Whelping','LAW','<b>same short names as the occupancy categories — one vocabulary, not two.</b> Your SOP splits neonatal, puppies, adults; these are your words for the same split'],
 ['age_from_days · age_to_days','int','LAW','<b>0–10 days · to 21–28 days · to 8 weeks.</b> Relative to birth — or to mating, for the in-utero band'],
 ['requirement_type','enum temperature | parasite | socialisation | health_check | weighing | vaccination | enrichment | handling','LAW',''],
 ['detail · frequency','text · text','LAW','“daily”, “weekly”, “twice daily”'],
 ['product_id · dose_rule','ref · text','LAW','<b>Panacur from day 40 of pregnancy, 0.25 ml/kg, until 2 days post-whelp</b> · Drontal Puppy 1 ml/kg oral with food'],
 ['sop_version_id','ref','LAW',''],
 ['THE POINT','—','JUDGE','<b>a litter is born and its whole schedule appears</b> — worming from day X, weighing daily, temperature band stepping down as they approach four weeks. Nobody types a to-do list, and nothing is forgotten because someone was busy. <b>Fourth band-matrix in the app</b>'],
  ['effective_from · effective_to','date','LAW','<b>a changed requirement is a NEW ROW, never an edited column.</b> Guidance on weaning, worming and socialisation ages moves. A litter reared in 2025 was reared to the 2025 schedule']]],

['exercise_rota','Scheduled exercise — area × day × slot','risk',[
 ['area_id · day_of_week · start_time · end_time','ref · enum · time · time','LAW','<b>from your Exercise Schedule sheets.</b> 3a.2/3 at 07:30, 10:00, 12:00, 14:00, 16:00; Level 1 Garden 09:30–14:30 then 15:30–17:00'],
 ['destination_area_id','ref','LAW','which garden, patio or field they go TO — <b>a second area, so this is a movement not a property</b>'],
 ['rota_version · effective_from','text · date','JUDGE','your July 2025 rota is titled by month, so it changes'],
 ['actual_taken','ref occupancy','JUDGE','<b>the rota is the plan; occupancy is the proof.</b> An inspector asks whether exercise happened, not whether it was scheduled']]],

['dna_test_batch','Submissions come in batches','ops',[
 ['batch_ref · bottle_no · test_no','text','OPS','<b>from your IVDD Screening sheet</b> — bottle numbers and test 8294'],
 ['lab · submitted_on · returned_on','text · date · date','OPS',''],
 ['subject_ids','list','OPS','<b>18 dogs per sheet.</b> Testing is a batch event, and a batch can be outstanding — which is a state your sheets show as blank result columns']]],

['board_scenario','Modelling a move before making it','est',[
 ['name · based_on','text · ref','OPS','<b>you already do this by hand</b> — “DAY OF INSPECTION”, “UPDATED DAY OF INSPECTION-1”, “EX:WHELP AREAS” are three copies of one board with different placements'],
 ['proposed_moves','list','OPS','“if Juniper whelps in H1 and Clover in H2, what does the board look like”'],
 ['violations','computed','LAW','<b>run every placement_check against the scenario</b> — capacity, temperature band, whelp permission'],
 ['WHY','—','JUDGE','copying a sheet to model a scenario means the copies drift and nobody can tell which is live. <b>A scenario is a proposal against the real board, never a duplicate of it</b>']]],

['puppy_milestone','The Puppy Development Tracker','ops',[
 ['subject_id · litter_id','ref','LAW','your SOP names it as a required record'],
 ['milestone','enum eyes_open | ears_open | first_stand | weaning_started | first_solid | first_worming | first_vaccine | microchipped | leaves_dam | collected','OPS',''],
 ['expected_day · actual_on','int · date ISO','OPS','<b>expected comes from the protocol, actual is observed.</b> The gap is the early-warning sign'],
 ['media_id · notes','ref · text','OPS','the photo is the proof and the update for the buyer']]],

['emergency_protocol','Sign → action, at the point of panic','risk',[
 ['condition','enum hypothermia_puppy | whelping_collapse | heat_stress | fading_puppy | dystocia | outbreak','LAW','<b>straight from your SOP tables</b>'],
 ['signs','text','LAW','“cold, limp, pale” · “pale gums, no nursing” · “panting, red gums, collapse”'],
 ['immediate_action','text','LAW','“warm gradually, dry pup, rub to stimulate, heat source, vet ASAP” · “warm area, glucose gel if responsive, vet emergency”'],
 ['escalate_to · threshold','text','LAW','<b>“puppy area under 27°C during active use by young pups — escalate immediately, risk of fading puppy syndrome”</b>'],
 ['reference_card_id','ref','JUDGE','<b>this is a poster AND a screen.</b> Nobody reads a wall in an emergency — they hold a phone']]],

['biosecurity_rule','Who may enter, and after what','risk',[
 ['area_id · rule','ref · text','LAW','<b>“no entry to puppy or whelping areas on the same day as entering different premises in the same clothes and footwear”</b>'],
 ['applies_to','enum staff | visitor | contractor | vet | inspector','LAW','your SOP covers staff visiting other premises, and visitors at collection'],
 ['ppe_required · barrier_footwear','text · bool','LAW','booties available; footwear removed if soiled'],
 ['declaration_required','bool','JUDGE','<b>the same-day-other-premises rule can only be enforced by asking</b>, so it is a recorded declaration at entry or it is nothing']]],

['puppy_birth','Per pup at birth — becomes a subject','ops',[
 ['litter_id · subject_id','ref','LAW','<b>a puppy is not a new table</b>'],
 ['born_at','datetime ISO','LAW','time, not just date'],
 ['sex · colour · birth_weight_g','enum · text · int','LAW','all three named in 6(7)'],
 ['notes','text','LAW','']]],

['daily_check','Your daily health check','risk',[
 ['subject_id','ref','LAW',''],
 ['performed_on · performed_by','date ISO · ref staff','LAW','<b>the date on the paper, and who did it</b> — see THE CAPTURE RULE'],
 ['recorded_at · recorded_by · source','datetime · ref · enum','LAW','<b>automatic. Never asked for, never a timestamp of convenience</b>'],
 ['identification_ok · card_present · cabin_matches_card','bool','OPS','<b>category 1 of your own 12-point check.</b> “Ensure dog card is present in the area correctly” and “the cabin occupied is correct for the colour coded card” — which is an occupancy check performed by eye, and the app can cross-check it against <code>occupancy</code> and disagree'],
 ['card_colour','text','OPS','<b>your colour-coded card system.</b> The colour carries meaning I have not been told — flagged, not guessed'],
 ['THE 12 POINTS ARE ROWS','—','JUDGE','<b>the seven enum columns that were here are gone.</b> Your check has twelve points in three groups and a thirteenth category for identification — as columns, adding a point is a schema change and removing one loses history. See <code>daily_check_result</code>'],
 ['action_needed · action_taken · escalated_to','bool · text · ref','JUDGE','a check that spots a problem and records no action is worse than no check'],
 ['notes','text','OPS','']]],

['enrichment_log','Socialisation and enrichment — Wales requires it','risk',[
 ['subject_id or litter_id','ref','LAW','<b>Wales: breeders must adopt socialisation, enhancement and enrichment programmes</b>'],
 ['activity_type · done_on · duration_min · by','text · datetime · int · ref','LAW','a programme with no log is an intention'],
 ['notes','text','OPS','']]],

['role','LVL2 — roles with different access','est',[
 ['code · name','text','OPS','owner · manager · staff · casual · vet(DEL) · inspector(DEL)'],
 ['is_internal','bool','OPS','<b>internal roles are <code>LVL</code>. External ones are <code>DEL</code></b> — same mechanism, different grantor']]],

['role_permission','The grid — role × table × level','risk',[
 ['role_id · table_name','ref · text','OPS',''],
 ['level','enum none | read | write | write_own | full','OPS','<b>write_own</b> lets someone add a check and correct their own entry without editing anyone else’s'],
 ['STAFF WRITE','—','OPS','<b>daily_check · area_reading · administration · enrichment_log · weight · media · occupancy.</b> This is the “input permissions” half — the operational record is written by whoever does the work'],
 ['STAFF READ','—','OPS','<b>subject · health_screen · dna_result · litter · sop · reference_card · product_dose_band.</b> They must see the dog and the procedure to do the job'],
 ['STAFF NONE','—','OPS','<b>lead · client · offer · sale · price · deposit · portal messages · tenant financials.</b> Lisa 23 Sep: <i>staff cannot access the CRM</i>. Commercial and buyer-personal data is not needed to care for a dog'],
 ['THE SIXTH TIME','—','JUDGE','<b>role × table × level is the same shape as the CUS portal grid, the DEL inspector scope, PAR1 claims and SID1 field lists.</b> Six appearances of one mechanism. Build it once, point it at different parties']]],

['THE PLATFORM TRAP','Why staff tables must not be user_scoped','risk',[
 ['user_scoped','—','LAW','<b>means “only rows YOU created”.</b> Set it on <code>daily_check</code> and a staff member cannot see yesterday’s check by a colleague — and neither can you'],
 ['THE SETTLED RULE','—','LAW','<b><code>PL18</code>: a tenant-owned table must NEVER be <code>user_scoped</code></b>, because a tenant’s staff must see rows they did not personally create. The named correct shape is <b><code>admin_only</code> plus <code>required_role_key</code></b>'],
 ['WHY IT BITES HERE','—','LAW','<b>every table staff write to is tenant-owned.</b> And the dashboard default is <code>user_scoped</code> (<code>PR243</code>), so the wrong mode is what you get by not choosing. This is the Flowers zero-rows incident waiting to happen on the busiest tables in the app'],
 ['SO','—','LAW','<b>the access mode is named per table inside the build prompt</b>, before any table is created. Correcting one afterwards is a billed Builder turn']]],

['staff','People, and the Welsh ratio','risk',[
 ['person_id','ref person','OPS','<b>REWIRED 23 Sep.</b> This table re-typed <code>name</code> as text while <code>person</code> already held the human — name, contact, and an <code>is_staff</code> flag. Someone who is both staff and a client was two records that drift apart. Now one'],
 ['role','text','LAW',''],
 ['employment','enum full_time | part_time','LAW','<b>Wales: 1 FT per 20 adult dogs, or 1 PT per 10</b> — the ratio cannot be computed without this'],
 ['started_on · ended_on','date','LAW','']]],

['staff_training','','ops',[
 ['staff_id · topic · provider','ref · text · text','PROPOSED','competence requirements recur in every consultation'],
 ['completed_on · expires_on · certificate_document_id','date · date · ref','PROPOSED','']]],

['rule_scope','THREE LEVELS OF RULE, NOT ONE','est',[
 ['level','enum jurisdiction | authority | licence','LAW','<b>Lisa 23 Sep: “some councils require…”.</b> I had one level. There are three'],
  ['jurisdiction','enum wales | england | scotland | northern_ireland','LAW','<b>four regimes, not three.</b> Northern Ireland runs under its own regulations and its own inspector guidance — a separate regime, not a variant of GB'],
 ['authority','text','LAW','<b>the local authority — your own SOP names “Vale of Glamorgan Council’s specific licensing conditions”.</b> Councils add conditions on top of the regulations, and they differ from each other'],
 ['licence_number','text','LAW','<b>and a condition can be written onto YOUR licence alone</b>, after an inspection'],
 ['PRECEDENCE','—','JUDGE','<b>the strictest applicable rule wins, and the app must say which one it applied.</b> “Two readings daily” because Vale of Glamorgan says so is a different answer from “because Wales says so” — and if you move council, one of them stops applying and the other does not'],
 ['THE CONSEQUENCE','—','JUDGE','a jurisdiction-only rules table would have silently made every council identical. <b>It would have looked right and been wrong everywhere except here</b>']]],

['jurisdiction_rule','THE FUTURE-PROOFING MECHANISM','est',[
 ['jurisdiction','enum','LAW',''],
 ['rule_key','text','LAW','min_mating_age_months · max_mating_age_years · max_litters_12m · max_lifetime_litters · caesarean_bar · conformation_caesarean_bar · staff_ft_ratio · staff_pt_ratio · licence_trigger'],
 ['value','text','LAW',''],
 ['source_citation','text','JUDGE','<b>every rule cites the regulation it came from</b>'],
 ['effective_from · effective_to','date','JUDGE','<b>New legislation is new ROWS, not a code change — and a mating in 2024 is still judged by the 2024 rule.</b> This is the whole answer to “future legislation”']]],

['sop','Standard operating procedures','est',[
 ['code · title','text','LAW','<b>an inspector asks for these first.</b> Wales requires documented programmes; England and Scotland require procedures be followed'],
 ['category','enum whelping | daily_care | cleaning | isolation | emergency | fire | euthanasia | transport | socialisation | biosecurity | handover | staff_induction','OPS',''],
 ['owner','ref staff','JUDGE','an unowned SOP is nobody’s job to keep current'],
 ['current_version_id','ref','OPS',''],
 ['review_due','date','JUDGE','an SOP nobody has reviewed in four years reads as neglect, not stability']]],

['sop_version','THE PART THAT IS EASY TO GET WRONG','risk',[
 ['sop_id · version','ref · text','LAW',''],
 ['effective_from · effective_to','date ISO','LAW','<b>the whole point</b>'],
 ['document_id','ref','LAW','the PDF as issued, stored not linked'],
 ['body','text','OPS','the steps, so they can be shown in the app rather than only downloaded'],
 ['changed_by · change_reason','ref · text','JUDGE','<b>why it changed matters more than that it changed</b> — usually an incident'],
 ['status','enum draft | ai_drafted | audited | approved | in_force | superseded','OPS','<b>Lisa: “I have a chat bot making these but they will need to be audited and inserted”.</b> An AI-drafted SOP that reads as in-force is the exact risk — the status is what stops it'],
 ['audited_by · audited_on','ref · date','OPS','<b>who checked it against the regulations</b>'],
 ['WHY VERSIONS','—','JUDGE','<b>Overwrite an SOP and every past record silently claims to have followed the NEW one.</b> A daily check from March must point at the procedure in force in March. Same pattern as jurisdiction rules and screening schemes — <b>this is now the third place a rule needs an effective-from date, which is the argument for doing it once, properly</b>']]],

['sop_acknowledgement','Who read which version','risk',[
 ['sop_version_id · staff_id','ref','PROPOSED','competence and training requirements recur in every consultation'],
 ['acknowledged_on','datetime ISO','PROPOSED',''],
 ['method','enum read | trained | assessed','JUDGE','<b>reading is not training and training is not competence.</b> An inspector asks which one happened'],
 ['THE USE','—','JUDGE','when an SOP changes, <b>the app can say who has not yet acknowledged the new version</b> — which is the actual operational value, not the filing']]],

['governed_by','The link from a record to its procedure','est',[
 ['record_type · record_id','text · ref','JUDGE','<code>daily_check</code>, <code>area_reading</code>, <code>enrichment_log</code>, <code>litter</code>…'],
 ['sop_version_id','ref','JUDGE','<b>stamped at the moment the record is written</b>, never looked up afterwards'],
 ['WHY','—','JUDGE','it turns “we have SOPs” into “<b>this check, on this date, followed this version of this procedure</b>”. That is the difference between a folder and evidence']]],

['reference_card','THE STAFF LIBRARY — signs, generated not typed','est',[
 ['code · title','text','OPS','your 15: Five Freedoms · 12-Point Check · Temperature Ranges by Area · Socialisation Matrix · Vaccination Protocol · Parasite Control · Transport Checklist · Emergency Contacts · Core Duties · Isolation Warning · Competency Matrix · Whelping Timeline · Dog ID Area Map · Chemical Storage · Cleaning Checklist'],
 ['source','enum generated | authored','JUDGE','<b>the important one.</b> Temperature Ranges by Area is <i>generated</i> from <code>area_environment_limit</code>; the Parasite Control chart from <code>product_dose_band</code>; the Area Map from <code>area</code>. Only the Five Freedoms is authored text'],
 ['source_query','text','JUDGE','which data it is built from'],
 ['sop_version_id','ref','LAW','the procedure it summarises — <b>so a card can never contradict the SOP it came from</b>'],
 ['body · layout','text','OPS','for the authored ones'],
 ['WHY GENERATED','—','JUDGE','<b>this is the fix for the stale-poster problem.</b> Change a temperature limit and the phone copy is right instantly, the printed copies are flagged as out of date, and the app can name <b>which walls to visit</b>. A typed poster silently diverges from the rule it claims to state'],
 ['READ AT THE POINT OF WORK','—','JUDGE','staff read it on a phone <b>where the job happens</b>, not by walking to a wall. The wall copy stays, because an inspector looks at walls']]],

['reference_card_view','Who read what, and when','ops',[
 ['card_id · staff_id · viewed_at','ref · ref · datetime ISO','PROPOSED','<b>the light-touch acknowledgement trail.</b> Not a signature — evidence the reference was actually reachable and used'],
 ['context','text','JUDGE','opened from a daily check, from a medication screen, from the isolation room']]],

['display_requirement','Printed copies — posters that must be on the wall','risk',[
 ['poster_id · title','ref · text','LAW','<b>15 named in your SOP</b> — Five Freedoms, 12-Point Check, Temperature Ranges by Area, Isolation Zone Warning, Chemical Storage, Emergency Contacts…'],
 ['required_at','enum kennels | whelping | prep_area | vet_med_station | isolation | public','LAW','your words: “must be displayed <b>clearly</b> in kennels, whelping rooms, prep areas and vet med stations”'],
 ['area_id','ref','LAW','which actual room'],
 ['card_id','ref reference_card','JUDGE','<b>the printed copy is a RENDERING of the card</b>, stamped with the version and date it was printed'],
 ['printed_version · put_up_on · checked_on','text · date · date','JUDGE','<b>the app compares the printed version against the current card and tells you which walls are out of date.</b> That is the whole reason to hold both'],
 ['photo_media_id','ref media','JUDGE','proof it is actually up, and legible']]],

['staff_duty','The 12 Core Duties','risk',[
 ['code · title · description','text','LAW','<b>your Staff Competency SOP defines twelve.</b> Named, so competence can be assessed against each rather than in general'],
 ['sop_version_id','ref','LAW','which procedure governs the duty']]],

['staff_competency','Assessed, not just trained','risk',[
 ['staff_id · duty_code','ref · text','PROPOSED',''],
 ['level','enum inducted | trained | assessed_competent | supervising','LAW','<b>your SOP separates induction, training and competency assessment.</b> They are three different states and an inspector asks which one'],
 ['assessed_on · assessed_by · evidence_document_id','date · ref · ref','LAW',''],
 ['cpd_hours · next_review','decimal · date','LAW','your SOP names <b>CPD tracking</b>'],
 ['signature_media_id','ref','LAW','your SOP names <b>digital signature records</b>']]],

['transport_journey','ATC, Type 1/2 licences, journey logs','risk',[
 ['subject_ids','list ref','LAW','<b>a whole domain I had not modelled.</b> Your Transport SOP names Type 1 and Type 2 transport licences and an ATC specimen page'],
 ['atc_reference · transporter_authorisation_type','text · enum type1 | type2','LAW','Animal Transport Certificate'],
 ['departed_at · arrived_at · route','datetime ISO · datetime · text','LAW','journey logs'],
 ['driver_id · vehicle · crate_size','ref · text · text','LAW','your SOP names vehicle prep, crate sizing and rest periods'],
 ['rest_stops','text','LAW',''],
 ['contingency_invoked','text','LAW','']]],

['medicinal_product','The formulary — one row per product','risk',[
 ['trade_name','text','LAW','Moxiclear, Droncit, Prazitel Plus, Panacur, Milprazon, Norclav'],
 ['active_ingredients','text','LAW','<b>imidacloprid + moxidectin</b>; praziquantel 50mg; fenbendazole. <b>The ingredient is what matters clinically, not the brand</b> — your SOP already says “alternative brands such as Advocate”'],
 ['strength · presentation · pack_size','text · enum tablet | spot_on | liquid | injection | chewable · text','LAW',''],
 ['legal_category','enum POM-V | POM-VPS | NFA-VPS | AVM-GSL','LAW','<b>UK legal classification, and it decides everything downstream.</b> POM-V needs a vet prescription and a dispensing record; AVM-GSL does not. Norclav is POM-V; some parasiticides are not'],
 ['is_antimicrobial','bool','LAW','<b>antibiotic use is recorded and reviewed separately</b> under responsible-use expectations. Norclav is amoxicillin/clavulanate'],
 ['dose_rate · dose_rate_unit','text · enum mg/kg | ml/kg | per_10kg | fixed','LAW','“0.1 ml per kg”, “1 tablet per 10 kg”'],
 ['route','enum topical | oral | injectable | otic | ocular','LAW','<b>your SOP flags it in bold</b> — “spot-on, this is NOT orally administered”. Route errors are the classic harm'],
 ['min_age_weeks · min_weight_kg','int · decimal','LAW','Moxiclear: 7 weeks, 0.4 kg'],
 ['pregnancy_safety · lactation_safety','text','LAW','<b>“no tapeworm tablets in the first 4 weeks of pregnancy” · “many products unlicensed in the first two weeks post-whelp (eg Milprazon)”</b>'],
 ['contraindications · interactions','text','LAW',''],
 ['storage · datasheet_url','text','LAW','the SPC, so the label can be checked rather than remembered'],
 ['is_controlled_drug','bool','OPS','Animana flags this <b>separately from legal category</b> — Schedule 2/3 drives the register; POM-V alone does not'],
 ['is_human_medicine','bool','OPS','human product used under the cascade — Animana “humandrug”'],
 ['indication','text','OPS','what it is licensed to treat — Animana carries it on the product'],
 ['follow_label','bool','OPS','your SOP: “Lexicon and Norclav dosage — <b>follow veterinary label</b>”. Some products carry no house dose and that must be stated, not left blank']]],

['product_dose_band','Weight band → what you actually give','risk',[
 ['product_id','ref','LAW',''],
 ['band_min_kg · band_max_kg','decimal','LAW','<b>up to 4 kg · 4–10 · 10–25 · over 25</b>'],
 ['give_value · give_unit','decimal · text','LAW','<b>0.4 ml · 1 ml · 2.5 ml · 4 ml</b>'],
 ['pack_variant','text','OPS','“Moxiclear for Dogs 10–25 kg” — the band is often a different SKU, not a different measure'],
 ['LOST FROM YOUR OWN SOP','—','OPS','<b>this table was in the July and September documents and is absent from both current ones.</b> It is the part someone needs standing at the cupboard with a dog on the scales'],
 ['THE PAYOFF','—','JUDGE','the app reads the dog’s latest weight and says <b>“15.3 kg → 2.5 ml, Moxiclear for Dogs 10–25 kg”</b> — rather than someone reading a band off a poster that may no longer be current'],
  ['effective_from · effective_to','date','LAW','<b>a changed requirement is a NEW ROW, never an edited column.</b> Datasheets are revised and bands are re-cut. A dose given in 2024 was correct against the 2024 band, and the record has to be able to say so']]],

['prescription','A vet authorises a quantity over a period','risk',[
 ['subject_id · product_id','ref','LAW',''],
 ['prescribing_vet · practice · issued_on','text · text · date ISO','LAW',''],
 ['valid_until','date ISO','LAW','<b>your SOP: “Prescription — obtained annually”</b>'],
 ['quantity_authorised · unit','decimal · text','LAW','your vet file: <i>“can dispense 4 pipettes every 4 months to cover a 12-month period until 15/01/2026”</i> — <b>that is an authorisation with a quantity and an expiry, not a single event</b>'],
 ['repeats_authorised · interval','int · text','LAW',''],
 ['quantity_dispensed · quantity_remaining','computed','JUDGE','<b>drawn down by each dispense.</b> A prescription with no remaining balance is the thing that quietly runs out mid-course'],
 ['document_id','ref','LAW','the written prescription']]],

['dispense','Taking it out of the cupboard','risk',[
 ['prescription_id · product_id · batch · expiry','ref · ref · text · date','LAW',''],
 ['quantity · dispensed_on · dispensed_by','decimal · datetime ISO · ref','LAW',''],
 ['supplier','text','LAW','for a purchase rather than a dispense']]],

['administration','Giving it to the dog','risk',[
 ['subject_id · product_id · dispense_id','ref','LAW',''],
 ['weight_at_dose_kg','decimal','LAW','<b>the dose is banded, so the weight it was based on is part of the record</b>'],
 ['dose_given · unit · route','decimal · text · enum','LAW',''],
 ['given_at · given_by · signature_media_id','datetime ISO · ref · ref','LAW','<b>your SOP: “Medicine Record Sheet (with signatures)”</b>'],
 ['witnessed_by','ref','LAW','for controlled drugs'],
 ['reason · outcome · adverse_reaction','text','LAW','an adverse reaction is reportable'],
 ['off_licence_use','bool','OPS','Animana flags <b>off-license</b> on the line item. Cascade use has to be recorded as such, not inferred'],
 ['logbook_ref','text','OPS','controlled-drug logbook entry — Animana carries it on the administration, not the product'],
 ['recorded_at','timestamp','OPS','Animana keeps <b>usagedate separate from the entry date</b>. The same split as the paper sheets — independently arrived at by a real vet system'],
 ['next_due','computed','JUDGE','from the product interval, never stored']]],

['waste_stream','Clinical and general waste','ops',[
 ['stream','enum clinical | general | sharps | chemical | cadaver','LAW','<b>from your v69 white-bedding section</b> — disposable puppy-pen bedding goes out as clinical waste'],
 ['container_type · contractor · collection_frequency','text','LAW','yellow bags, Initial'],
 ['consignment_note_document_id','ref','LAW','a duty-of-care transfer note is the evidence an inspector asks for'],
 ['permit_required','bool','OPS','your SOP notes this one is <b>not</b> a permit-requiring purchase — worth recording so nobody re-asks']]],

['medicine_register','Controlled medicines, with signatures','risk',[
 ['product · batch · expiry','text','LAW','your Veterinary & Clinical Records SOP names <b>controlled medicine documentation</b>'],
 ['received_on · quantity_in · supplier','date · decimal · text','LAW',''],
 ['administered_to_subject_id · quantity_out · administered_on','ref · decimal · datetime','LAW',''],
 ['administered_by · signature_media_id','ref · ref','LAW','<b>your SOP says “Medicine Record Sheet (with signatures)”</b>'],
 ['balance','computed','JUDGE','<b>in minus out.</b> A controlled-drug register that does not reconcile is the thing that gets noticed'],
 ['disposal_on · disposal_method · witnessed_by','date · text · ref','LAW','']]],

['plan_document','Named plans the licence expects','ops',[
 ['kind','enum disease_outbreak | emergency | fire | retirement | contingency | health_safety','LAW','<b>all named in your SOP index.</b> Health &amp; Safety is dated June 2025 with “next 06/26” — a review cycle already in your own document'],
 ['current_version_id · review_due','ref · date','LAW','']]],

['WHICH BITS NEED AI','Almost none of it — and the distinction that matters','est',[
 ['TWO DIFFERENT COSTS','—','JUDGE','<b>“bespoke paid code” is NOT the same as “AI”.</b> Bespoke means somebody writes code once and it costs credits once. AI at runtime costs money <b>every time anyone uses it, forever, on the tenant’s bill</b>. The Front Door has a field for the second and records it as <b>0 of 120 cards</b> — nothing in the factory has ever carried a runtime AI cost'],
 ['1 · HANDWRITING on the scanned sheet','AI — YES','OPS','<b>and only part of it.</b> A tick in a box the app itself printed is “is this cell dark?” — ordinary image processing, no model. <b>Handwritten numbers (BCS 5, dental 2) and free-text notes are the part that needs a model.</b> So the sheet scan splits: ticks cheap and deterministic, handwriting paid'],
 ['2 · “I need a checklist for…”','AI — YES','OPS','<b>matching plain words to the right SOP and turning its steps into items.</b> Genuinely language work. Low volume, on demand, and only when you ask — so the runtime cost is bounded by how often you press it'],
 ['3 · Drafting SOPs','AI — YES, and already outside the app','OPS','your chatbot is doing this now. <b>It does not need to be inside the app at all</b> — the app’s job is the <code>ai_drafted → audited → in_force</code> status, which is not AI'],
 ['Matching families to puppies','NO','JUDGE','<b>people assume this one.</b> It is rank plus acceptability summed into a number — a scoring function of about thirty lines. <b>No model, no runtime cost, and it can explain itself exactly</b>, which a model cannot'],
 ['COI / inbreeding','NO','JUDGE','<b><code>BR-COI</code> is marked bespoke and paid, and that is code, not AI.</b> Henderson tabular recursion is deterministic arithmetic — the same input gives the same answer forever, which is the only acceptable property for a number you publish to a buyer'],
 ['Colour and trait prediction','NO','JUDGE','<b><code>BR-PREDICTION</code> is Mendelian inheritance from two genotypes.</b> Punnett squares. Arithmetic'],
 ['Placement, capacity, temperature bands','NO','JUDGE','counting and comparing against rule rows'],
 ['Jurisdiction and licence rules','NO','JUDGE','<b><code>BR-RULES-ENGINE</code> is described as a “light bot”, but “was she 12 months old at mating” is an if-statement.</b> Rules as data, evaluated in code'],
 ['Everything due · next vaccine · overdue','NO','JUDGE','date arithmetic'],
 ['Ancestor certificate library','NO','JUDGE','walking sire/dam pointers'],
 ['Dose from weight','NO','JUDGE','<b>your spreadsheet already does it.</b> 19.6 × 0.1 = 1.96'],
 ['THE RULE WORTH KEEPING','—','JUDGE','<b>anything an inspector, a buyer or a court might rely on must be deterministic.</b> A COI figure, a capacity verdict, a “fit to breed” date — these have to give the same answer every time and be able to show their working. <b>AI belongs where the input is messy and a human checks the output</b>: handwriting, and turning a sentence into a draft']]],

['THE CAPTURE RULE','WHEN IT HAPPENED ≠ WHEN IT WAS WRITTEN','risk',[
 ['performed_on','date ISO','LAW','<b>Lisa 23 Sep: staff do the checks on paper; a weekly list of names and ticks comes to me and I input it.</b> This is the date on the paper'],
 ['performed_by','ref staff','LAW','<b>the person who did it</b>'],
 ['recorded_at · recorded_by','datetime ISO · ref','LAW','<b>when it was typed, and by whom.</b> Captured automatically, never asked for'],
 ['source','enum paper | direct | import | device','LAW',''],
 ['source_media_id','ref media','JUDGE','<b>photograph the paper sheet and attach it.</b> The paper is the primary record; the rows are the index into it'],
 ['WHY THIS MATTERS MORE THAN IT LOOKS','—','JUDGE','<b>if the app stamps <code>now()</code>, a week of backfilled paper checks all claim to have happened on Friday.</b> That is not a small inaccuracy — it is a false record, and it is the kind an inspector spots instantly because nobody checks 35 dogs at 21:14 on one evening'],
 ['AND IT IS MORE CREDIBLE, NOT LESS','—','JUDGE','<b>“performed Monday by GC, entered Friday by LC from the paper sheet” reads as a real operation.</b> Accurate provenance beats false immediacy — do not design for a fiction where everyone types as they go'],
 ['APPLIES TO','—','LAW','<b>daily_check · area_reading · administration · enrichment_log · weight · checklist_item · exercise.</b> Every operational record, not health checks alone'],
 ['AND THE RULES USE performed_on','—','LAW','<b>the “two readings ~12 hours apart” test measures the PERFORMED times, never the entry times.</b> Typed one after the other on Friday, the readings still pass if the paper says 08:00 and 19:30']]],

['record_sheet','The app PRINTS the sheet','est',[
 ['template_id · period_from · period_to','ref · date · date','OPS','“Daily health checks, week of 2026-09-21”'],
 ['scope','computed','OPS','<b>which dogs, in which areas, needing which checks</b> — resolved from occupancy at print time, so the sheet already matches reality'],
 ['sheet_code','text','JUDGE','<b>a QR or short code printed on it.</b> No ambiguity later about which week, which dogs, which area'],
 ['grid_definition','json','JUDGE','<b>the exact cell layout — which row is which dog, which column is which field</b>'],
 ['printed_on · printed_by','date · ref','OPS',''],
 ['returned','bool','JUDGE','<b>a printed sheet that never comes back is a gap the app can see.</b> Nothing else notices a missing week until an inspection']]],

['sheet_upload','Completed on paper, photographed back in','risk',[
 ['record_sheet_id','ref','OPS','<b>matched by the printed code</b>, not by someone choosing from a list'],
 ['media_id','ref','LAW','<b>the photograph IS the record</b>, exactly like a Xero receipt. The rows are an index into it, and it is kept whatever happens to them'],
 ['uploaded_on · uploaded_by','datetime · ref','OPS',''],
 ['ocr_status','enum queued | read | needs_review | accepted | rejected','OPS',''],
 ['THE ADVANTAGE OVER A RECEIPT','—','JUDGE','<b>the app printed this sheet, so it knows where every cell is.</b> A Xero receipt is an unknown layout from an unknown supplier — genuinely hard. This is “is the box at row 7 column 3 ticked?” against a grid we defined. <b>That is a far easier problem and a far more reliable read</b>'],
 ['COST, STATED','—','OPS','<b>this is <code>BR-IMPORT-SCAN</code> — “CSV import + AI OCR of paper into structured rows”.</b> It is in the registry, in <b>no kit</b>, and marked <b>bespoke (AI, paid code)</b>. Schema free as always; <b>this is the first genuinely paid thing in v1</b> and it should be a deliberate decision, not a surprise']]],

['sheet_cell_read','Per cell, with a confidence','risk',[
 ['sheet_upload_id · row_subject_id · column_field','ref · ref · text','OPS',''],
 ['read_value · confidence','text · decimal','LAW',''],
 ['accepted_value · reviewed_by · reviewed_at','text · ref · datetime','LAW','<b>nothing is written to the real records until a person accepts it</b>'],
 ['LOW CONFIDENCE IS SHOWN, NEVER GUESSED','—','JUDGE','<b>the same rule as the date parsing.</b> An uncertain tick is surfaced for a human, not resolved by the machine picking the likelier one. A confidently wrong health record is worse than a blank'],
 ['A BLANK IS A FINDING','—','JUDGE','<b>an empty cell means the check was not recorded</b>, and that is exactly what the app should say. Filling it is falsification; ignoring it is what paper already does badly']]],

['batch_entry','Typing it up by hand — the fallback','est',[
 ['sheet_media_id','ref','OPS','<b>the photographed paper list</b>'],
 ['period_from · period_to','date','OPS','the week it covers'],
 ['grid','names × days × fields','OPS','<b>your paper sheet is Name / Teeth / Ears / Eyes / BCS / Notes / Date.</b> The entry screen should be that grid, not one form per dog — 35 dogs × 7 days through single forms is 245 screens'],
 ['entered_by · entered_at','ref · datetime','OPS',''],
 ['missing_flagged','computed','JUDGE','<b>the gaps on the paper are the finding.</b> A dog with no tick on Wednesday is what the app should surface — quietly filling it is falsifying, and leaving it silent is useless'],
 ['THE OTHER DIRECTION','—','JUDGE','<b>the app should also PRINT the week’s blank sheet</b>, with the right dogs, in the right areas, for the right checks — so the paper and the system already agree before anyone picks up a pen']]],

['checklist_template','A reusable list — three origins, one table','est',[
 ['name · version','text','OPS','maps onto <b><code>BR-COMPLIANCE</code></b>, whose own tables are <code>checklists(name,version)</code> and <code>checklist_items</code>. Free-shape-schema, so <b>free to build</b>'],
 ['origin','enum sop | protocol | adhoc','JUDGE','<b>the important distinction.</b> <b>sop</b> — generated from a procedure you already wrote · <b>protocol</b> — age-banded, fires itself when a litter is born · <b>adhoc</b> — you asked for one'],
 ['sop_version_id','ref','LAW','<b>for sop-origin lists, the version it came from</b>, so the list can never drift from the procedure'],
 ['applies_to','enum dog | litter | area | staff | business | none','OPS',''],
 ['recurrence','text','OPS','daily, per litter, annually, one-off'],
 ['promoted_from_instance_id','ref','JUDGE','<b>the learning loop — see below</b>']]],

['checklist_template_item','','ops',[
 ['template_id · sort_order · text','ref · int · text','OPS',''],
 ['default_assignee_role','ref role','OPS','who normally does it'],
 ['evidence_required','enum none | tick | photo | reading | signature | document','LAW','<b>a tick is not evidence for everything.</b> “Thermometer placed” wants a photo; “medicine given” wants a signature'],
 ['blocking','bool','JUDGE','does an unfinished item stop the thing it belongs to'],
 ['due_offset_days','int','LAW','<b>relative to the trigger, not an absolute date.</b> “within 21 days of transfer” is a rule; “by 14 October” is a guess'],
 ['statutory_rule_key','ref jurisdiction_rule','LAW','<b>THE DEADLINE COMES FROM THE RULE, NOT THE TEMPLATE.</b> Microchip keeper transfer is a legal duty with a legal window — typed into a template it silently goes stale when the law moves, and worse, it is wrong for a tenant in a different jurisdiction using the same template'],
 ['statutory','bool','LAW','<b>a late statutory item is an offence; a late nice-to-have is a to-do.</b> The dashboard has to be able to tell them apart']]],

['checklist_instance','A live list, assigned to someone','risk',[
 ['template_id','ref','OPS','<b>null for a pure ad-hoc list</b>'],
 ['title','text','OPS','“Inspection prep — Vale of Glamorgan, March”'],
 ['subject_type · subject_id','text · ref','OPS','this dog, this litter, this cabin, or nothing'],
 ['assigned_to · created_by · created_at','ref · ref · datetime ISO','OPS','<b>your TO DO LIST sheet has Assigned To and it is the only structure it has</b>'],
 ['due_on · priority','date · enum','OPS','your sheet has Priority and Notes'],
 ['state','computed','OPS','from its items — <b>never a separate Done column that can disagree with them</b>'],
 ['sop_version_id','ref','LAW','stamped at creation']]],

['checklist_item','The tick, and what backs it','risk',[
 ['instance_id · text · sort_order','ref · text · int','OPS',''],
 ['state','enum open | done | not_applicable | blocked','OPS','<b>not-applicable is not done</b>, and an inspector reads them differently'],
 ['done_by · done_at','ref · datetime ISO','LAW','<b>nothing changes state before the write lands</b> — a tick painted on press looks identical whether or not it saved'],
 ['evidence_media_id · evidence_document_id · reading_id','ref','LAW','whatever the item demanded'],
 ['na_reason · notes','text','JUDGE','<b>“not applicable” with no reason is the gap an inspector walks into</b>']]],

['checklist_from_request','“I need a checklist for…”','est',[
 ['request_text','text','OPS','<b>what you typed or said</b>'],
 ['matched_sop_version_id','ref','JUDGE','<b>THE RULE: draft from YOUR OWN SOPs, never from nothing.</b> You have 30-odd procedures — “a new stud dog is arriving” should find <i>New Breeding Dog Arriving At Premises</i> and turn its steps into items'],
 ['no_sop_found','bool','JUDGE','<b>and when nothing covers it, say so.</b> That is a gap in your procedures, surfaced — not a licence to invent steps that read as though they were approved'],
 ['status','enum drafted | edited | accepted','OPS','<b>a drafted list is never in force until you accept it</b>, same rule as an AI-drafted SOP'],
 ['PROMOTE','—','JUDGE','<b>the loop that matters:</b> when you have made the same ad-hoc list three times, the app offers to save it as a template — and if it came from an SOP gap, to write the missing SOP from it']]],

['licence_condition','The conditions as worded','risk',[
 ['jurisdiction · condition_ref · wording','enum · text · text','LAW','<b>nothing in the brick registry has this shape</b>'],
 ['category · evidence_required','text · text','LAW',''],
  ['effective_from · effective_to','date','LAW','<b>a changed requirement is a NEW ROW, never an edited column.</b> Councils reissue and reword conditions; the pack must show the wording that was in force on the day the evidence was gathered']]],

['condition_evidence','','risk',[
 ['condition_id · evidence_type · document_id','ref · text · ref','LAW',''],
 ['recorded_on · recorded_by · status','date · ref · enum','LAW','<b>this is what turns records into an inspection pack</b>']]],

['tenant_document','Business-level papers — the annual renewal set','risk',[
 ['tenant_id','ref','LAW','<b>not per dog.</b> Same document table, owner is the business'],
 ['kind','enum public_liability_insurance | vet_retainer | fire_risk_assessment | waste_carrier | planning | electrical_cert | gas_safety | pat_test | water_quality | risk_assessment | other','LAW','<b>insurance is one of a set</b>, and they all behave identically'],
 ['issuer · reference','text','OPS','insurer and policy number'],
 ['effective_from · expires_on','date ISO','LAW','<b>the point of the whole table</b>'],
 ['cover_amount','decimal','LAW','licence conditions specify a minimum for public liability'],
 ['document_id','ref document','LAW','the scan'],
 ['is_licence_evidence','bool','LAW','shows in the inspector view'],
 ['status','enum current | superseded | expired | lapsed','LAW','<b>computed from the dates, not set by hand</b> — a policy does not stop being expired because nobody updated a dropdown'],
 ['supersedes_id · superseded_by_id','ref tenant_document','LAW','<b>Lisa 23 Sep: “an archive so public liability insurance etc can be stored when a new one arrives”.</b> The new certificate does not replace the old one, it follows it — a chain, so you can walk back through every policy you have ever held'],
 ['archived_on · archive_reason','date · text','OPS',''],
 ['WHY THE OLD ONE IS NOT RUBBISH','—','LAW','<b>this is the clearest case in the whole app.</b> If something happened on 14 March and the question is “were you insured that day”, the current certificate <i>cannot answer it</i>. Only the policy that was in force then can, and if it was overwritten the answer is gone permanently. <b>Same for the licence, the waste carrier registration, the electrical certificate and the vet retainer</b> — every one of them is evidence about a period, not about today'],
 ['GAPS BETWEEN POLICIES ARE THE FINDING','—','LAW','<b>and only a chain can show them.</b> One certificate expiring 31 March and the next starting 3 April is a three-day hole. Nobody notices it at the time and it is invisible in a folder of current documents — but it is instantly visible on a timeline, and it is exactly what an inspector or an insurer looks for after an incident'],
 ['EXPIRY DRIVES THE DASHBOARD','—','LAW','<b>a lapsed insurance certificate is a licence breach, not an admin oversight.</b> It belongs in the overdue list beside a missed vaccination, and it is <code>blocking</code>'],
 ['SCAN DATES ARE NOT POLICY DATES','—','JUDGE','<b>when you scanned it is not when it starts or ends.</b> Three separate dates — uploaded_on, effective_from, expires_on — and only the last two mean anything to an inspector. Deriving expiry from the upload date is the mistake waiting to be made'],
 ['NO COPIES','—','JUDGE','<b>stored once, referenced by every condition it evidences.</b> Same rule as the ancestor certificates — copy it and one renewal leaves stale duplicates nobody can find. The renewal supersedes; the old one is kept, never overwritten']]],

['inspection','','ops',[
 ['inspected_on · inspector · authority','date · text · text','LAW',''],
 ['outcome · star_rating · report_document_id','text · int · ref','LAW',''],
 ['actions · action_due · action_closed_on','text · date · date','JUDGE','an action with no due date is not an action']]],

['resource','THE FAMILY RESOURCE CENTRE','est',[
 ['title · slug · kind','text · text · enum article | video | pdf | checklist | form | link','OPS','<b>this is <code>BR-CMS</code></b> — the mint candidate I flagged as missing. It is now clearly needed, which is the evidence it was waiting for'],
 ['body · media_id · document_id','text · ref · ref','OPS',''],
 ['scope','enum library | litter | subject','JUDGE','<b>two different things.</b> “Preparing for your puppy” is library; “your pup’s week-5 update” is pinned to a litter. Same shelf to the reader, different lifetime'],
 ['version · updated_on','text · date','OPS','<b>families read these months apart</b> — two buyers must not silently get different advice'],
 ['author · reviewed_on','ref · date','JUDGE','']]],

['resource_release','Lead → reservation → pre-adoption → post-adoption','risk',[
 ['resource_id','ref','OPS',''],
 ['released_at_stage_id','ref pipeline_stage','OPS','<b>points at the same configurable rows as the enquiry.</b> Previously a second hard-coded list — which meant a tenant adding a stage would have had to get it added in two places, and the two would have drifted'],
 ['cumulative','bool','JUDGE','<b>default TRUE — a post-adoption family still sees the lead material.</b> Releasing in a way that hides earlier content means answering the same questions again by email'],
 ['withdraw_on_state','enum never | declined | lapsed | completed','JUDGE','<b>the question nobody asks until it bites: does a family who withdrew keep the library?</b> Some of it is genuinely yours — breed guides, your own training method. A deliberate answer, not a default'],
 ['STAGE-GATED vs INDIVIDUAL','—','OPS','<b>two mechanisms, both needed.</b> This table is “everyone at reservation sees X”. <code>shared_record_links</code> is “this prescription, to this family”. Do not merge them — one is a rule, the other is a decision'],
 ['THE MECHANISM EXISTS','—','OPS','<code>portal_steps</code> from Satchel is the stage; <code>shared_record_links</code> from <code>K01</code> is the per-row release. <b>Both are already in the kit and free</b>']]],

['resource_view','Did they actually read it','ops',[
 ['resource_id · person_id · viewed_at','ref · ref · datetime','JUDGE','<b>not surveillance — operational.</b> A family who has not opened the collection-day guide two days before collection is a phone call worth making'],
 ['acknowledged','bool','JUDGE','for the ones that matter — the contract, the feeding plan, the vaccination schedule']]],

['enquiry','Stage 1 — they get in touch','ops',[
 ['source','enum website | referral | social | repeat_buyer | waitlist | other','OPS',''],
 ['received_at · channel','datetime ISO · enum form | email | phone | message','OPS',''],
 ['person_id','ref','OPS',''],
 ['pipeline_stage_id','ref pipeline_stage','OPS','<b>a row, not an enum.</b> Lisa 23 Sep described four stages — initial enquiry, deposit paid, puppy allocated and working towards collection, post collection — and said explicitly <i>do not adopt our shorthand</i>. So the stages are configurable rows and her codes are labels on them'],
 ['programme_id','ref programme','OPS','<b>the other half of her code.</b> Her stage codes carry a breed-line prefix, so one string holds two facts: which programme, and how far along. Split them or neither can be counted on its own'],
 ['entered_stage_on · previous_stage_id','date · ref','OPS','<b>how long they sat at each stage is the useful number</b>, and it is unrecoverable if the stage is just overwritten'],
 ['closed_reason','enum declined | lapsed | withdrawn | completed','OPS','leaving the pipeline is not a stage — it is an exit, and it can happen from any stage']]],

['requirement','Stage 2 — the call, and what they actually want','est',[
 ['enquiry_id · taken_on · taken_by','ref · date ISO · ref','OPS','<b>captured on the scheduled call, which is <code>K02</code> booking</b>'],
 ['earliest_date · latest_date','date','OPS','when they can take one'],
 ['household_notes','text','OPS','children, other dogs, work pattern — what makes a placement right or wrong'],
 ['flexible_overall','enum rigid | some_flex | very_flexible','JUDGE','<b>how hard to push a near-match.</b> You know this after ten minutes on the phone; the app should hold it'],
 ['superseded_by','ref','JUDGE','<b>people change their minds.</b> The brief is versioned, so an offer can be shown against what they said AT THE TIME']]],

['requirement_preference','ONE TABLE FOR EVERY PREFERENCE','est',[
 ['requirement_id','ref','OPS',''],
 ['attribute','enum sex | colour | size | coat | temperament | markings | timing | other','OPS','<b>a new attribute is a row, never a column.</b> You will add some'],
 ['value','text','OPS','“female”, “apricot”, “medium”'],
 ['rank','int','OPS','<b>1, 2, 3 — your “colours they would accept in order of preference”</b>'],
 ['acceptability','enum only | preferred | acceptable | excluded','OPS','<b>this is what makes it work.</b> Your four gender answers collapse into rank plus acceptability: <i>male only</i> = male:<code>only</code> · <i>prefer male, would consider female</i> = male:<code>preferred</code> rank 1 + female:<code>acceptable</code> rank 2. The same two fields then handle colours, size and anything else'],
 ['WHY NOT A FILTER','—','JUDGE','<b>a filter excludes; a preference ranks.</b> “Would consider female” means a female pup is still a match, just a lower-scoring one. Build it as a filter and you hide pups from families who would have said yes — which is a lost sale and a puppy staying longer']]],

['match_score','What you currently do in your head','est',[
 ['subject_id · requirement_id','ref','OPS','<b>every available pup × every open requirement</b>'],
 ['score','computed','OPS','from rank and acceptability across all attributes'],
 ['blocked_by','computed','OPS','<b>any <code>excluded</code> or failed <code>only</code> — a hard no, listed by reason</b>'],
 ['unknowns','computed','JUDGE','<b>attributes not yet determinable.</b> Adult size and final colour are not known at three weeks, so the score must say what it is guessing at rather than quietly assuming'],
 ['rank_within_litter · rank_within_waitlist','computed','OPS','<b>two different questions</b>: best pup for this family, and best family for this pup'],
 ['THE OUTPUT','—','JUDGE','a litter is born and the app says <b>“these four families match this pup, in this order, and here is why”</b> — then you decide. It never offers anything by itself']]],

['offer_reason','Why THAT family got THAT pup','risk',[
 ['offer_id','ref','LAW',''],
 ['match_score_at_offer · waitlist_position · deposit_date','computed snapshot · int · date','JUDGE','<b>frozen at the moment of offering</b>, because scores move as pups develop'],
 ['override_reason','text','JUDGE','when you place against the ranking — and you will, for good reasons'],
 ['WHY THIS EXISTS','—','JUDGE','<b>“why did they get one and not me?”</b> is the question that damages a breeder’s reputation. A recorded position, score and reason answers it in one sentence. Nothing else in the app does']]],

['sale','What the law requires at the point of sale','risk',[
 ['subject_id · person_id · sold_on','ref · ref · date ISO','LAW',''],
 ['age_at_sale','computed','LAW','6(8) “the age of the puppy on that date”'],
 ['microchip_number_at_sale','text','LAW','6(8)'],
 ['seen_with_dam','bool','LAW','<b>Lucy’s Law</b> — the buyer must see the pup with its mother'],
 ['vet_record_given','bool','LAW','<b>1(4): “the age, sex and veterinary record of the dog being sold”</b>'],
 ['price · deposit · deposit_date','decimal · decimal · date','OPS',''],
 ['contract_document_id','ref','OPS','']]],

['document','Stored, never linked','risk',[
 ['owner_type · owner_id · kind','text · ref · text','OPS',''],
 ['stored_blob_id','ref','JUDGE','<b>NOT a URL.</b> Your Infinity attachment keys rotate between exports — a stored link breaks'],
 ['filename · uploaded_on · uploaded_by','text · datetime · ref','OPS',''],
 ['released_to_client','bool','OPS','the per-row release, via shared_record_links'],
 ['retain_until','date','JUDGE','records have a retention period; nothing currently tracks it']]],

['consent','','ops',[
 ['person_id · purpose · lawful_basis','ref · text · text','LAW','UK GDPR'],
 ['given_on · withdrawn_on · evidence','datetime · datetime · text','LAW','<b>cannot be retrofitted onto records already taken</b>']]],

['incident','','ops',[
 ['subject_id · incident_type','ref · enum injury | illness | escape | death | bite | near_miss','JUDGE','not named in Sch 6, but it is the first thing an inspector asks after an event'],
 ['occurred_at · action_taken · reported_to','datetime · text · text','JUDGE','']]],

['certificate','Any issued certificate — OFA, Orivet, BVA, KC','risk',[
 ['subject_id','ref','OPS',''],
 ['issuer','enum OFA | Orivet | BVA | KC | MDBA | other','OPS','<b>a new issuer is a value, not a table</b>'],
 ['certificate_number','text','OPS','OFA: <code>HY-EL5050F24-C-VPI</code> — itself structured (breed, test, number, sex, age, grade)'],
 ['application_number · lab_case_number','text','OPS','OFA application no.; Orivet case no.'],
 ['registered_name','text','OPS','<b>differs from the call name</b> — both certificates carry the registered name only'],
 ['report_date','date ISO','OPS',''],
 ['age_at_evaluation_months','int','LAW-adjacent','<b>OFA final hip/elbow certification requires 24 months.</b> A cert at 12 months is provisional and must not read as final'],
 ['verdict','text','OPS','OFA <code>NORMAL</code>; the plain-English answer'],
 ['result_text','text','OPS','the full wording, verbatim'],
 ['signed_by','text','OPS',''],
 ['verification_url','text','JUDGE','<b>both certificates carry a QR that authenticates them online.</b> This is how a buyer or inspector proves it is genuine — capture it'],
 ['approved_collection_method','bool','OPS','<b>Orivet records it explicitly.</b> Some registries reject a self-collected swab, so the result’s admissibility depends on it'],
 ['document_id','ref document','OPS','the PDF itself, stored not linked']]],

['dna_result','Genotypes — diseases AND traits','ops',[
 ['subject_id · certificate_id','ref','OPS',''],
 ['category','enum disease | trait','OPS','<b>the Orivet report has two separate sections.</b> Diseases gate breeding; traits predict the litter'],
 ['marker','text','OPS','“Degenerative Myelopathy”, “E Locus”, “Curly Coat KRT71”'],
 ['breed_qualifier','text','OPS','“(Labrador Retriever Type)”, “(Poodle Type)” — the same marker is reported per breed type'],
 ['genotype','text','OPS','<b><code>e/e</code>, <code>Bᴰ/Bᴰ</code>, <code>shd/shd</code>, <code>m/m [171/171bp]</code>.</b> A clear/carrier/affected enum cannot hold these'],
 ['interpretation','text','OPS','“NEGATIVE / CLEAR [NO VARIANT DETECTED]”, “CARRIER — CARRYING ONE COPY”'],
 ['status','enum clear | carrier | affected | not_showing | research_only','JUDGE','<b>derived from the interpretation for filtering</b> — the raw text stays'],
 ['research_only','bool','OPS','the CDDY/IVDD row is marked [RESEARCH ONLY] and must not be treated as a clinical result'],
 ['lab','text','OPS','Orivet, Embark, AHT \u2014 schemes are not interchangeable'],
 ['tested_on','date','OPS','sample date, not report date'],
 ['basis','enum tested | hereditary','JUDGE','<b>“hereditarily clear”</b> — computable when both parents tested clear for a recessive. Needs the parent link, which is the whole point of the library']]],

['document_library','Per dog, and through to the parents','est',[
 ['subject_id','ref','OPS','every document belongs to <b>one</b> dog'],
 ['kind','enum ofa | dna | pedigree | xray | vet_record | registration | contract | photo | video | insurance | passport | other','OPS',''],
 ['title · issued_on · expires_on','text · date · date','OPS',''],
 ['stored_blob_id','ref','JUDGE','<b>never a URL.</b> Your Infinity attachment keys rotate between exports'],
 ['visible_to_buyer','bool','OPS','the per-row release'],
 ['superseded_by','ref','JUDGE','a re-test replaces a certificate; the old one is kept, not deleted'],
 ['ONE ROW PER DOCUMENT, NEVER PER DOG','—','LAW','<b>Lisa 24 Sep: a library exists only once there is a document — “or we will be making them for ancestors who do not have docs”.</b> The table already works that way: a row IS a document, so a dog with none simply has none. <b>The failure she is guarding against is real:</b> create a library record per subject and every pedigree ancestor — hundreds of dogs that exist only as names on a four-generation chart — acquires an empty folder that then has to be maintained, backed up and explained. <b>A dog’s library is a QUERY: documents where subject_id = this dog. No documents, no row, no empty shell</b>'],
 ['AND IT OVERLAPS WITH document — A DECISION IS NEEDED','—','JUDGE','<b>two tables store a stored file.</b> <code>document</code> is polymorphic (<code>owner_type</code> + <code>owner_id</code>, so it hangs off a tenant, a sale or a dog); this one is subject-only. They are not both needed. <b>Named rather than quietly merged</b>, because merging them moves every existing reference']]],

['ancestor_evidence','A VIEW, not a table — the parent link','est',[
 ['walks sire_id / dam_id','computed','OPS','<b>to a stated depth</b>'],
 ['gathers','computed','OPS','each ancestor’s certificates, health screens and DNA results'],
 ['returns','computed','OPS','“show me this puppy’s parents’ hip scores”, answered by walking the tree'],
 ['THE RULE','—','JUDGE','<b>a document is NEVER copied onto a descendant.</b> Copy it and one correction leaves 400 wrong copies and no way to find them. The library is a view <i>through</i> the pedigree, never a duplication of it'],
 ['completeness','computed','JUDGE','<b>say how many ancestors at that depth are missing a result.</b> A pedigree that looks clear because nobody tested is not clear']]],

['dashboard_item','What the breeder sees on opening','ops',[
 ['due_type','enum vaccine | wormer | flea | dental | health_check | season | mating_window | whelp_due | weigh_in | chip_transfer | contract | licence | inspection | insurance | certificate_expiry','OPS','<b>every one of these is computed, never a stored to-do</b>'],
 ['subject_id or litter_id or area_id or tenant_id','ref','OPS','a to-do can belong to a dog, a litter, a room or the business'],
 ['due_on · overdue_by','date · computed','OPS',''],
 ['severity','enum overdue | due | soon | watch','JUDGE',''],
 ['blocking','bool','JUDGE','<b>does this stop a mating or a sale?</b> An out-of-date fit-to-breed does. A dental does not'],
 ['THE RULE','—','JUDGE','<b>the dashboard stores nothing.</b> Every line is derived from the event tables and the jurisdiction rules. A stored to-do list is a second source of truth that drifts']]],

/* ============ SHOP, SUPPLIERS AND STOCK ============ */
['supplier','Who you buy from','ops',[
 ['name · account_ref','text','OPS',''],
 ['contact_name · email · phone','text','OPS',''],
 ['address · country','text','OPS','<b>country matters</b> — import paperwork and lead time change with it'],
 ['lead_time_days','int','OPS','<b>drives when you must order for a collection date</b>, which is the only question you actually ask a supplier'],
 ['minimum_order_value','decimal','OPS',''],
 ['is_approved · approved_on','bool · date','OPS','for anything that goes near a dog'],
 ['notes','text','OPS','']]],

['product','One item you sell or issue — goods AND services','ops',[
 ['sku · name','text','OPS',''],
 ['kit_id','ref product_kit','OPS','<b>your order form is grouped into 15 kits</b> — Bathing, Crate, Feeding, Teething, Toilet Training, Travel, Vet, Toy, Training, Ear, Eye, Body Groom, Paw, Car Travel, Lifestyle'],
 ['kind','enum good | service | fee | made_to_order','OPS','<b>your Travel Kit is not goods at all</b> — Passport, Rabies, Pre-flight Check, Traces Doc, Defra Doc, Courier are services and statutory fees sitting in the same list'],
 ['variant_of_id','ref product','OPS','<b>36” Crate and 30” Crate are two rows, not one row with a size field</b> — and so are Odour Neutraliser 500 ml / Concentrate 900 ml, and Disinfectant 500 ml / 900 ml / 5 L. Same rule as the Moxiclear pack bands'],
 ['unit · sell_price','text · decimal(10,2)','OPS','<b>6.67 each</b> — unit prices carry pence'],
 ['requires_spec','bool','OPS','<b>“Vetbed (cut to size)”</b> — the line is incomplete without an instruction'],
 ['is_stocked','bool','OPS','a service is not'],
 ['active','bool','OPS','retire, never delete — old orders still point at it']]],

['product_kit','The 15 kits on your order form','ops',[
 ['name · sort_order','text · int','OPS','Bathing · Crate · Feeding · Teething · Toilet Training · Travel · Vet · Toy · Training · Ear · Eye · Body Groom · Paw · Car Travel · Lifestyle'],
 ['shown_by_default','bool','OPS','<b>every kit prints even when nothing in it is ordered</b> — that is what makes it an offer sheet rather than an invoice']]],

['product_supplier','ONE ITEM, MANY SUPPLIERS','risk',[
 ['product_id · supplier_id','ref','OPS','<b>Lisa 23 Sep: “one item in the shop can have more than one supplier”.</b> This is a junction table, and it is the reason supplier cannot be a column on product'],
 ['supplier_sku · supplier_name_for_item','text','OPS','<b>they each call it something different</b>, which is how you fail to match it on an invoice'],
 ['cost_price','decimal(10,2)','OPS','<b>different per supplier, and it is what margin is calculated from</b>'],
 ['pack_size · pack_unit','decimal · text','OPS','one sells singles, one sells a box of 12 — cost per unit is not comparable until this is here'],
 ['lead_time_days','int','OPS','overrides the supplier default for this item'],
 ['is_preferred','bool','OPS','<b>one preferred per product, not one supplier per product</b> — the difference matters the day the preferred one is out of stock'],
 ['last_purchased_on · last_cost','date · decimal','OPS',''],
 ['effective_from · effective_to','date','OPS','<b>a price rise is a new row.</b> An order placed last year was placed at last year’s cost, and margin on it must still compute correctly']]],

['stock_movement','Every in and out — never a quantity column','risk',[
 ['product_id','ref','OPS',''],
 ['direction','enum in | out | adjustment | wastage | return','OPS',''],
 ['quantity','decimal(10,3)','OPS','<b>decimal, not int</b> — your own sheet has a Courier line at quantity 1.2'],
 ['reason','enum purchase | sale | goods_order | internal_use | damaged | expired | count_correction','OPS','<b>internal use is the one people forget</b> — shampoo used on your own dogs leaves stock without a sale'],
 ['purchase_order_line_id · goods_order_line_id','ref','OPS','what caused it'],
 ['batch · expiry','text · date','OPS','for anything medicinal — ties to <code>dispense</code>'],
 ['occurred_on · recorded_at · by','date · timestamp · ref','OPS','<b>the same performed/recorded split as everywhere else</b>'],
 ['STOCK ON HAND IS DERIVED','—','JUDGE','<b>sum the movements.</b> A stored quantity column and a movement history will disagree within a month, and the stored one always wins the argument and is always the wrong one']]],

['purchase_order','What you ordered from a supplier','ops',[
 ['tenant_id · supplier_id','ref','OPS',''],
 ['ordered_on · expected_on','date','OPS',''],
 ['status','text closed set draft | sent | part_received | received | cancelled','OPS',''],
 ['invoice_ref · document_id','text · ref document','OPS','']]],

['purchase_order_line','One line of that order','ops',[
 ['purchase_order_id','ref purchase_order','OPS','<b>SPLIT OUT 23 Sep.</b> This was a single schema entry named <code>purchase_order · purchase_order_line</code> with its line fields prefixed <code>line:</code> — a note pretending to be a table. An order has many lines, so it is two tables or it is wrong'],
 ['product_id · quantity','ref product · decimal','OPS',''],
 ['cost_price','decimal','OPS','<b>copied onto the line, not looked up</b> — the price at the time of ordering is part of the record'],
 ['quantity_received','decimal','OPS','<b>separate from quantity ordered</b>, which is what makes <code>part_received</code> a real status rather than a guess']]],

['goods_order','THE COLLECTION ORDER — your Harper sheet','est',[
 ['person_id · puppy_subject_id','ref','OPS','<b>it hangs off the puppy, not just the buyer</b>'],
 ['going_home_date · collection_mode','date · text','OPS','<b>“collection - 15 weeks, come to us”</b> — the date the whole order has to be ready for'],
 ['puppy_naming_note','text','OPS','<b>“elsa eli now ‘benji’”</b> — sire, dam, and the name the family gave. The family’s name for the dog is not the kennel name and both are needed'],
 ['status','enum draft · offered · confirmed · picked · handed_over','OPS',''],
 ['total','computed','OPS','<b>573.01 on the Harper sheet</b> — summed from the lines, never typed']]],

['goods_order_line','And the zero rows are data','risk',[
 ['goods_order_id · product_id','ref','OPS',''],
 ['unit_price · quantity · line_total','decimal(10,2) · decimal(10,3) · computed','OPS','<b>price copied at the time of the order.</b> If the line looked it up, reprinting an old order would silently reprice it'],
 ['specification','text','OPS','<b>“not cherry blossom” · “Have a choice ready” · “2 cut to 36”” · “blue possibly? backup of cream” · “Cheese Only” · “benji choose”.</b> This column is doing real work and has nowhere else to live'],
 ['QUANTITY ZERO IS KEPT','—','JUDGE','<b>your sheet lists every item in every kit, most at quantity 0.</b> A zero line means offered and declined, which is different from never offered — and it is what makes the sheet reusable as the next family’s starting point. Delete the zeros and you have an invoice; keep them and you have a catalogue'],
 ['COLOUR KEEPS APPEARING','—','JUDGE','<b>“blue” appears seven times in one order.</b> That is the same preference you capture at enquiry, surfacing again at collection — it should be prefilled from <code>requirement_preference</code>, not re-asked']]],

/* ============ WHO THE CUSTOMER IS ============ */
['client_classification','BREEDER OR BUYER — a row, not a second list and not a tag','risk',[
 ['person_id','ref','OPS',''],
 ['classification','enum pet_buyer | breeder | stud_enquiry | rehomer | trade | vet | other','OPS','<b>Lisa 23 Sep: “we sell to breeders as well … if we have a dog for breeding for sale we offer it to breeders not customers”</b>'],
 ['licence_number · issuing_authority · jurisdiction','text','LAW','<b>the whole point.</b> A claimed breeder and a licensed breeder are different, and only one of them may legally buy a dog for breeding'],
 ['verified_on · verified_by · evidence_document_id','date · ref · ref','LAW','<b>you saw the licence, on this date, and here is the copy</b>'],
 ['licence_expires_on','date','LAW','<b>verification goes stale</b> — a breeder verified in 2024 is not a verified breeder today'],
 ['effective_from · effective_to','date','OPS','<b>people change.</b> A pet buyer becomes a breeder; a breeder retires. Neither is an edit'],
 ['WHY NOT TWO LISTS','—','JUDGE','<b>because the same person appears on both.</b> A family who bought a pet from you in 2023 and is licensed by 2026 is one relationship with one history — two lists give you two records that drift, and you lose the fact that you already know them'],
 ['WHY NOT A TAG','—','JUDGE','<b>because a checkbox cannot hold a licence number, an expiry, who verified it or when.</b> The question is never “is this a breeder”, it is “may I offer this dog to this person today” — and that needs all five. A tag also cannot be wrong in a way you can audit'],
 ['THE GATE','—','JUDGE','<b>a subject with <code>retained_for_breeding</code> or a breeding-terms sale may only be offered to a client with a current, verified breeder classification.</b> That is one rule, written once, and it is the reason this is not a tag']]],

/* ============ WEATHER AND EXTERNAL CONDITIONS ============ */
['weather_observation','THE OUTSIDE TEMPERATURE — automatic','est',[
 ['tenant_id · observed_at','ref · timestamp','OPS',''],
 ['source','enum api | on_site_sensor | manual','OPS','<b>a live feed is possible and is the right default</b> — a free weather API on the premises postcode, polled hourly. An outdoor sensor is better and neither is required to start'],
 ['outside_min_c · outside_max_c · now_c','decimal(5,2)','OPS',''],
 ['condition · wind_mph · humidity_pct','text · decimal · int','OPS','wind and humidity change what a temperature means'],
 ['WHY IT IS NOT DECORATION','—','LAW','<b>your Welsh vet form asks: “Is there adequate shelter and shade from inclement or hot weather?”</b> It is a scored licence question. Recording the weather turns an assertion into evidence — “on the four days over 28°C this summer, here is what we did”']]],

['weather_trigger','–4 OUTSIDE MEANS DO SOMETHING DIFFERENT','risk',[
 ['rule_scope_id','ref','LAW','yours, or the council’s'],
 ['when','enum below | above','LAW',''],
 ['threshold_c','decimal(5,2)','OPS','<b>Lisa 23 Sep: “if its -4 or 35 degrees outside then additional measures need to be done”</b>'],
 ['applies_to','enum all_areas | outdoor_only | specific_life_stage','OPS','<b>a heated whelping room does not care that it is –4 outside; an outdoor run does</b>'],
 ['action_checklist_template_id','ref','OPS','<b>the trigger generates the checklist</b> — extra bedding, pipes checked, water not frozen, shade and paddling water out, walks moved to early morning, surfaces tested for heat'],
 ['extra_readings_required','int','OPS','cold snaps are exactly when the twice-daily rule is least sufficient'],
 ['effective_from · effective_to','date','LAW','<b>a changed threshold is a new row</b>'],
 ['IT FIRES ITSELF','—','JUDGE','<b>nobody has to notice the forecast.</b> The observation arrives, the threshold is crossed, the checklist appears on the board, and when it is completed the completion is the evidence. That is the difference between a weather widget and a compliance mechanism']]],

['external_risk_factor','THE VET FORM’S OWN LIST — including pest control','risk',[
 ['tenant_id · factor','ref · enum rodent_pest_bird | waterway_proximity | wildlife | local_disease | high_visitor_numbers | off_site_exercise_area | staff_visit_other_premises','LAW','<b>verbatim from your Welsh veterinary assessment form</b>, which scores each one. None of these were in the schema before this document'],
 ['present · detail','bool · text','LAW','“foxes” · “leptospirosis, Alabama Rot, ticks in the local area” · “premises located near a waterway”'],
 ['control_measure · contractor · frequency','text','LAW','<b>pest control is a contract with visits</b>, not a statement'],
 ['last_visit_on · next_due_on · certificate_document_id','date · date · ref','LAW','<b>the pest control certificate is a document the inspector asks for</b>'],
 ['LEPTOSPIROSIS IS THE JOIN','—','JUDGE','<b>a waterway plus local leptospirosis plus a vaccination record is one connected fact.</b> The vet form asks the first two and the vaccination schedule answers the third, and nothing today puts them on the same screen']]],

['required_vaccination','The four named ones, plus titre and exemption','risk',[
 ['rule_scope_id · disease','ref · enum parvovirus | distemper | adenovirus_ich | leptospirosis | other','LAW','<b>named explicitly on your Welsh vet form</b>: Parvovirus, Distemper, Adenovirus/Infectious Canine Hepatitis, Leptospirosis'],
 ['applies_to','enum adult | puppy | breeding | all','LAW',''],
 ['interval_months · first_dose_age_weeks','int','LAW',''],
 ['titre_accepted','bool','LAW','<b>“in the absence of an annual vaccination, satisfactory titre certs are provided by the animal’s vet”</b> — a titre result is a lawful alternative, so it cannot be modelled as a missing vaccination'],
 ['exemption_requires_certificate','bool','LAW','<b>“a signed veterinary certificate must be available”</b> for medical exemption, eg adverse reaction. Exempt is a documented state, not a blank'],
 ['effective_from · effective_to','date','LAW','']]],

['evidence_kind','WHAT COUNTS AS PROOF — and it is specific','risk',[
 ['kind','enum sop | check_sheet | vaccination_card | vet_declaration | lab_report | photo | certificate | contract','LAW','<b>the vet form lists exactly these</b> under “Evidence of measures in place can include”'],
 ['requires_vet_signature','bool','LAW','<b>“vaccination cards signed by a vet, fully completed”</b>'],
 ['requires_practice_stamp','bool','LAW','<b>“and includes the practice stamp” · “signed veterinary declarations on practice headed note paper with practice stamp”.</b> A scan without the stamp is not evidence, and only a field like this can make the app say so before the inspection rather than during it'],
 ['requires_headed_paper','bool','LAW',''],
 ['accepted_for_condition_refs','text','LAW','which licence conditions this kind of evidence can discharge']]],

['THE SCHEDULE-NUMBER TRAP','—','risk',[
 ['THREE DOCUMENTS, THREE MEANINGS','—','LAW','<b>“Schedule 1” and “Schedule 2” mean three different things across your own paperwork.</b> The 2014 Regulations: Schedule 1 = Licence Conditions, Schedule 2 = consequential amendments to other Acts. The LA guidance contents page: Schedule 1 = Dog Breeding Record, Schedule 2 = Puppy Log Book. Your veterinary assessment form: Schedule 1 = Enhancement and Enrichment Plan, Schedule 2 = Puppy Socialisation Plan'],
 ['WHY IT MATTERS TO THE SCHEMA','—','JUDGE','<b>never key a rule to a schedule number.</b> Key it to the source document plus its own reference, and store the document. An app that said “Schedule 1 complete” would be right, wrong and meaningless at the same time depending on who was reading it'],
 ['AND IT IS NOT A WELSH QUIRK','—','JUDGE','<b>this is what a tenant-uploaded ruleset has to survive.</b> Four jurisdictions, each with its own numbering, each reusing the same words for different things']]],

/* ============ COI AND THE MATING PLAN ============ */
['coi_calculation','COI IS A PROPERTY OF A PAIRING, NOT OF A DOG','risk',[
 ['sire_id · dam_id','ref','JUDGE','<b>your own matrix settles this.</b> Larry is 0.0 against Cookie and 1.0 against Dahlia-Pumpkin. There is no “Larry’s COI” to record — there are 37, one per bitch'],
 ['coefficient_pct','decimal(5,2)','JUDGE','0.0 to 8.0 across your 414 calculated pairings, mean 3.29'],
 ['generations_used','int','JUDGE','<b>the number is meaningless without this.</b> 6.25% over 5 generations and 6.25% over 10 are different facts, and the deeper one is always the larger'],
 ['method','enum wrights | path | registry_published','JUDGE',''],
 ['pedigree_source','enum own_records | kc | mdba | other_registry','JUDGE','<b>two different numbers, both legitimate.</b> Yours is computed over the dogs you hold; the registry’s is computed over its whole database and will be higher. Store both, never average them, never overwrite one with the other'],
 ['computed_on · pedigree_version','date · text','JUDGE','<b>it goes stale by itself.</b> Add one ancestor and every descendant’s figure moves — so a stored number with no date is a number you cannot trust'],
 ['source','enum imported | computed_here','JUDGE','<b>v1 is imported. Corrected 23 Sep after Lisa: no kit has a working coefficient formula, and the pedigrees are not in yet.</b> The same row holds both, so switching later changes no structure'],
 ['pedigree_depth_available','int','JUDGE','<b>how many generations we actually hold for this pairing.</b> Without it a computed figure is not just uncertain, it is wrong in a predictable direction — shallow pedigrees return near-zero for everything, which reads as “safe”'],
 ['pedigree_completeness_pct','decimal(5,2)','JUDGE','<b>of the 2^n ancestor slots at that depth, how many are filled.</b> 5 generations at 40% complete is not a 5-generation COI'],
 ['NOT A V1 BUILD','—','JUDGE','<b>Lisa 23 Sep is right and this changes the plan.</b> The tables are schema — hand-built, free, do them now. The <i>formula</i> is application code, so it is a paid prompt, and it should not be one until the pedigrees are loaded deep enough to return a true answer. <b>Build the tables, import the figures, defer the maths.</b>'],
 ['WHAT V1 DOES INSTEAD','—','JUDGE','<b>exactly what Lisa proposed — record the figure — but per PAIRING, not per male.</b> Her own grid is the proof: Larry is 0.0 against Cookie and 1.0 against Dahlia-Pumpkin. One field on a stud record would have destroyed 36 of his 37 numbers. That is the only part of her instinct that needed correcting, and it costs nothing to get right now and is unrecoverable later'],
 ['THE ACTUAL BLOCKER IS PEDIGREE IMPORT','—','JUDGE','<b>and it is a bigger open question than the coefficient.</b> Where do ancestors come from — an MDBA or KC export, a registry API, or typing? Nobody has answered that, it is not in any brick, and until it is the coefficient cannot be computed by anything, ours or otherwise'],
 ['BUT KEEP THE PUBLISHED ONE TOO','—','JUDGE','<b>the registry figure is evidence and yours is not.</b> A buyer or an inspector asking for COI wants the published one; you want yours for planning, because it updates the moment you add a dog']]],

['mating_exclusion','THE “No” IN YOUR GRID IS A DECISION, NOT A NUMBER','risk',[
 ['sire_id · dam_id','ref','OPS','<b>148 of your 629 cells say No</b> — that is 24% of the grid carrying a judgement rather than a measurement'],
 ['reason','enum coi_too_high | conformation | health_result | colour | temperament | too_closely_related | stud_unavailable | commercial | other','OPS','<b>this is what the spreadsheet cannot hold.</b> “No” for COI and “No” because he is sold look identical in a cell, and only one of them changes when you recalculate'],
 ['decided_by · decided_on · note','ref · date · text','OPS',''],
 ['is_permanent','bool','OPS','<b>a COI exclusion is arithmetic and may move; a conformation exclusion will not</b>'],
 ['review_on','date','OPS','for the ones that are only true this season'],
 ['SURVIVES RECALCULATION','—','JUDGE','<b>the whole reason this is its own table.</b> Recompute every COI tonight and the numbers all change; these 148 decisions must still be there in the morning']]],

['stud_resource','LIVE DOG OR FROZEN SEMEN — not the same thing','ops',[
 ['subject_id','ref','OPS','the dog, where you have one'],
 ['kind','enum owned_live | external_live | frozen_semen | chilled_semen','OPS','<b>four of your 17 studs are semen</b>: Lover, Teddy, Jasper, Ronnie'],
 ['straws_held · storage_location · tank_ref','int · text · text','OPS','<b>semen is stock with a location</b> — and an irreplaceable one'],
 ['collected_on · collection_centre · import_country','date · text · text','LAW','imported semen carries its own paperwork'],
 ['health_certificate_document_id · expires_on','ref · date','LAW',''],
 ['owner_name · stud_fee · terms','text · decimal · text','OPS','an external stud is a supplier relationship'],
 ['available_from · available_to','date','OPS',''],
 ['PROSPECTIVE STUDS HAVE NO NAME YET','—','OPS','<b>five of your columns are a cross, not a dog</b>: “Zenna X George Male”, “HarleyXGeorge”, “MarmitexGeorge”, “DeeDeexLarry”, “CookiexGeorge merle M”. A planned or unnamed dog still needs a <code>subject</code> row with its parents set — that is what makes its COI computable before it is even born']]],

['THE FLAGS INSIDE YOUR NAMES','—','risk',[
 ['IC · BH · merle M','—','OPS','<b>“Buddy(IC/BH)”, “Delia (Penny) (IC/BH)”, “Stefan (BH)”, “CookiexGeorge merle M”, “Dolly (Jasmine)”, “Kendra (Kara)”, “Ivy (Heather)”.</b> Your dog names are carrying at least four separate facts: a status code, a second code, a coat genotype, and a former or alternative name'],
 ['WHY IT BREAKS','—','JUDGE','<b>you cannot filter, count or check a fact that lives inside a string.</b> “Show me every merle carrier” is a text search that will miss a dog spelled “Merle”, and “which dogs are BH” cannot be answered at all by the app. Each of these becomes a field: <code>status</code>, <code>dna_result</code> for merle, <code>subject.call_name</code> plus an <code>aliases</code> row for the bracketed second name'],
 ['STILL UNDECODED','—','OPS','<b>IC and BH have not been explained to me and I am not guessing.</b> Same open question as the area codes 3A/3B/3C/4.x/H1–H6/3S and the F and L suffixes, and the 33 flag columns on your working list']]],

/* ============ GROOMING ============ */
['grooming_task_type','THE TASKS — and your own kits already name them','ops',[
 ['task','enum bath | clip_shave | brush_deshed | dematting | nails | teeth | ears | eyes | anal_glands | paw_trim | sanitary_trim | face_trim','OPS','<b>your goods order is already organised this way</b> — Ear Kit, Eye Kit, Body Groom Kit, Paw Kit, Teething Kit, Bathing Kit. The kits are the task list'],
 ['default_interval_days','int','OPS','<b>the interval is the whole point</b> — nails every 3–4 weeks and a full groom every 6–8 are different clocks on the same dog'],
 ['coat_type_applies_to','text','OPS','<b>a doodle coat and a smooth coat are not the same job.</b> Ties to <code>subject.coat_type</code>'],
 ['typical_minutes · requires_competency','int · ref','OPS','clipping is not a job for an untrained hand — joins <code>staff_competency</code>'],
 ['product_ids','ref product[]','OPS','<b>the same rows you sell.</b> Slicker, Dematter, Curved Scissors, Guillotine, Ear Cleaner — one product table serving the shop and the kennel']]],

['grooming_plan','Per dog, because dogs differ','ops',[
 ['subject_id · task','ref · enum','OPS',''],
 ['interval_days','int','OPS','overrides the default for this dog'],
 ['season_adjustment','text','OPS','coats change with the year'],
 ['hold_reason · hold_until','text · date','OPS','<b>a bitch in late pregnancy or a dog post-surgery comes off the schedule</b> without being forgotten'],
 ['effective_from · effective_to','date','OPS','<b>a changed interval is a new row</b>']]],

['grooming_session','What was actually done, to which dog, by whom','ops',[
 ['subject_id','ref','OPS',''],
 ['performed_on · recorded_at · by','date · timestamp · ref','OPS','<b>the same split as every other record</b> — grooming gets written up later as often as not'],
 ['tasks_done','enum[]','OPS','<b>one session covers several tasks and rarely all of them</b>, which is why the next-due clock is per task and not per session'],
 ['products_used · quantity','ref · decimal','OPS','<b>and this is the “internal use” that takes shampoo out of stock without a sale</b> — straight into <code>stock_movement</code>'],
 ['coat_condition · skin_findings','text','OPS','<b>grooming is the most reliable health check you have.</b> Lumps, hot spots, ear infections and weight change are found by the person doing the nails, not on the daily walk-past'],
 ['media_id','ref','OPS','before and after — and these are the photos that also serve as coat and condition evidence'],
 ['escalated_to_visit_id','ref','OPS','<b>when the groom finds something</b>'],
 ['NEXT DUE IS DERIVED','—','JUDGE','<b>never stored.</b> Last session of that task, plus the interval on the plan, minus any hold — same mechanism as vaccination and worming, and the fourth time this app needs it'],
 ['WHY IT EARNS A TABLE','—','JUDGE','<b>because it is evidence, not housekeeping.</b> Welsh guidance requires dogs kept clean and free from matting, and a nail or coat problem in an inspection is a welfare finding. A grooming history is the defence, and it is also how you show a buyer what their puppy has been used to']]],

/* ============ PEDIGREE IMPORT ============ */
['pedigree_import','GETTING PEDIGREES IN — tested, it works','est',[
 ['source_system','enum breeders_assistant | kc | mdba | manual','OPS','<b>Breeders Assistant for Dogs (Tenset), Professional Edition, licensed to you</b> — it is on the footer of your own Buddy chart'],
 ['export_format','text','OPS','<b>“Linechaser Info, 4 generations”</b> — the TEXT export, not the printed chart'],
 ['file_document_id · imported_on · by','ref · timestamp · ref','OPS',''],
 ['dogs_in_file · dogs_matched · dogs_created · rows_rejected','int','OPS','<b>every import states its own counts</b>, and a row that will not parse is rejected loudly rather than guessed'],
 ['THE PDF CHART IS THE WRONG SOURCE','—','JUDGE','<b>your BuddyPedigree.pdf is a single 2691×3794 JPEG</b> — no text layer at all. Importing from it means OCR on dog names, and OCR on “Rutlands Lil Jewel” versus “Rutlands Lil Jewei” silently creates a second ancestor and quietly changes every COI downstream. <b>Export as text from Breeders Assistant instead; do not scan the print-out</b>'],
 ['AND IT IS NOT TRICKY','—','JUDGE','<b>you have already written the parser specification</b> — your own 4g template document. Built to it and tested 23 Sep 2026 against the worked examples in that document: 4 generations, 30 ancestor slots, <b>29 resolved, one correctly recorded as unknown, 96.7% complete</b>. Siblings on a “Heidi/Nellie” line split into two dogs sharing the tree; “Curlycwtch” and “doodleDogs’” prefixes stripped for matching but kept as written; dates of birth separated from names; empty lines kept as known-unknown so the slot is not silently lost. <b>Deterministic — no AI</b>']]],

['ancestor','The resolved tree — one row per slot','risk',[
 ['subject_id','ref','OPS','the dog whose pedigree this is'],
 ['generation · slot','int','OPS','<b>G1 has 2 slots, G2 has 4, G3 has 8, G4 has 16.</b> Slot order is fixed by the export and is what makes the relationship derivable rather than stated'],
 ['relationship','computed','JUDGE','<b>derived from generation and slot</b> — “Dam’s Dam’s Dam’s Sire”, not typed. 30 labels nobody has to maintain'],
 ['ancestor_subject_id','ref subject','OPS','<b>set once the ancestor is matched to a dog you hold</b>; null while it is only a name'],
 ['name_as_written · match_name · prefix','text','OPS','<b>your own rule: the prefix may be inconsistent and can be ignored for matching, but the inconsistency is reported as a note rather than silently corrected</b>'],
 ['sex · dob','enum · date','OPS','<b>your rule: ancestor dates of birth are not relevant to ancestry or inbreeding</b> and are stored only to answer direct questions'],
 ['is_known','bool','OPS','<b>an empty line is data.</b> It means this slot is unknown, which is exactly what makes completeness measurable'],
 ['import_id','ref','OPS','which run put it here, so a bad import can be backed out']]],

['THE THREE COI NUMBERS','—','risk',[
 ['1 · THE DOG’S OWN','—','JUDGE','<b>Buddy is 0.5%</b>, printed on his chart. That is his own sire × dam. It is a fact about him'],
 ['2 · THE TRIAL MATING','—','JUDGE','<b>Buddy’s column in your grid runs 0.5 to 7.4 across 37 bitches.</b> Those are the figures the PUPPIES would carry. They are facts about pairings that have not happened'],
 ['3 · THE REGISTRY’S','—','JUDGE','computed over a whole registry database rather than your dogs, and it will be higher'],
 ['WHY THIS IS THE WHOLE POINT','—','JUDGE','<b>numbers 1 and 2 both sit on the same dog and are not the same number.</b> A single “inbreeding %” field on a stud record cannot tell you which one it holds — and if it holds the trial figure it has thrown away 36 of the 37. Three fields, clearly named, or the app is lying quietly']]],

/* ============ MDBA — A SECOND, DIFFERENT PEDIGREE SOURCE ============ */
['registry_number','THE JOIN KEY — and the reason name-matching is not good enough','risk',[
 ['subject_id · registry','ref · enum mdba | kc | other','LAW',''],
 ['number','text','LAW','<b>from your Starling certificate: 5525144F4 · 10212F3 · 10210F4 · 5521010F3 · 4160672F3 · MDBAR11200032F2.</b> Three different formats in one document, so this is text and never an integer'],
 ['filial_generation','enum F1 | F2 | F3 | F4 | F5+','LAW','<b>the suffix IS the generation</b> — 5525144<b>F4</b>, and the certificate repeats it as “F4 Australian Cobberdog”. Parse it, but keep the whole string too'],
 ['issued_on · certified_by · document_id','date · text · ref','LAW','<b>“I certify this pedigree to be true and correct”, signed, 4 May 2021.</b> A certified pedigree is evidence and carries a signature and a date'],
 ['WHY THIS CHANGES THE IMPORT','—','JUDGE','<b>MDBA prints a registry number against EVERY ancestor; Breeders Assistant prints names only.</b> Matching “Tegan Park Bridgett” by name across two exports is guesswork that fails on a space, an apostrophe or a typo — matching on <code>10213F3</code> does not. <b>Import MDBA first to seed the numbers, then the BA text export joins to it.</b> That ordering is the difference between a clean tree and a quietly duplicated one'],
 ['FILIAL IS NOT INBREEDING','—','JUDGE','<b>F4 is how far the breed development has come, not how related the parents are.</b> Starling is F4 and her sire Buddy is F3 — two completely different axes that both look like “generation”, and confusing them would put the wrong number in front of a buyer']]],

['registry_attribute','What the registry recognises, in its own words','ops',[
 ['subject_id · registry','ref · enum','LAW',''],
 ['breed_as_registered','text','LAW','<b>“F4 Australian Cobberdog”</b> — the registry’s wording, not ours'],
 ['colour · coat · size','text','LAW','<b>Apricot · Fleece · Miniature.</b> Three separate recognised attributes on the Starling certificate, and they are the registry’s vocabulary — which will not match ours and must not be forced to'],
 ['country_of_origin','text','LAW','United Kingdom'],
 ['owner_member_no · breeder_member_no','text','LAW','<b>“Lisa Joyaa Rose 17619”</b> — the member number, not just a name'],
 ['dna_profile_ref','text','LAW','a DNA field on the certificate, blank on Starling']]],

['pedigree_line_finding','HEALTH RESULTS ARRIVING INSIDE A PEDIGREE','risk',[
 ['ancestor_id · raw_text','ref · text','LAW','<b>Buddy’s line on the Starling certificate reads: 977 200 007 553 769 · DNA #15-102683 Orivet · HS 14/106 · Elbow Grade 0.</b> Hudson Man of the Hour reads “Hips Good”'],
 ['kind','enum microchip | dna_ref | hip_score | elbow_grade | narrative | other','LAW',''],
 ['parsed_value','text','LAW','<b>HS 14/106 is a BVA hip score — 14 and 106 are the two hips, and the total is what matters.</b> “Hips Good” is an OFA grade, a different scheme entirely, on the same certificate'],
 ['scheme','text','LAW','<b>BVA, OFA and “Grade 0” are three schemes and are NOT interchangeable</b> — same rule already settled for the screening schemes'],
 ['promote_to_health_screen_id','ref','JUDGE','<b>a finding on a pedigree is a claim, not a result.</b> It becomes a <code>health_screen</code> row only when someone accepts it, and the certificate stays as its evidence'],
 ['WHY A TABLE AND NOT A PARSE','—','JUDGE','<b>because it is free text on a scanned certificate and it will be wrong sometimes.</b> Keep the raw string next to the parsed value, so a mis-parse is visible and correctable rather than baked in']]],

['BOTH YOUR PEDIGREE SOURCES ARE IMAGES','—','risk',[
 ['MEASURED, NOT ASSUMED','—','OPS','<b>BuddyPedigree.pdf is one 2691×3794 JPEG. MDBA Starling.pdf is 5 pages, every one a JPEG.</b> Neither has a text layer — checked with pdftotext, which returned zero lines from both'],
 ['SO THE ROUTE IS','—','JUDGE','<b>the Breeders Assistant TEXT export for the tree</b> (tested, 96.7% of slots resolved), <b>and the MDBA certificates for the registry numbers, filial generations and certified attributes</b>. The MDBA ones need reading once — by eye or by OCR with every number checked — but only once per dog, and after that the number is the key'],
 ['DEPTH DIFFERS BY SOURCE','—','JUDGE','<b>MDBA certifies 3 generations; the BA export gives 4.</b> Which is exactly why <code>pedigree_depth_available</code> is a field — a COI computed from a 3-generation tree and one from a 4-generation tree are different numbers and neither is wrong']]],

/* ============ SEASON AND FERTILITY MONITORING ============ */
['season','The heat cycle — the thing the readings hang off','ops',[
 ['subject_id','ref','OPS',''],
 ['first_seen_on · proestrus_start · season_end','date','OPS','<b>day 1 is the anchor for every reading</b>, so it is recorded once and not re-derived'],
 ['previous_season_id · interval_days','ref · computed','OPS','<b>her own cycle length is the best predictor she has</b> — and a shortening or lengthening interval is itself a finding'],
 ['outcome','enum mated | not_mated | missed | absorbed | silent_heat','OPS','<b>a season you chose not to use is data</b>, and it is what proves the 12-month rule was respected'],
 ['notes','text','OPS','']]],

['fertility_reading','DRAMINSKI AND PROGESTERONE — a time series, looking for a peak','risk',[
 ['season_id · subject_id','ref','OPS',''],
 ['method','enum draminski | progesterone | cytology | lh | ultrasound','OPS','<b>Lisa 23 Sep: “we do draminski levels … others do progesterone tests”.</b> Both must be first-class — a tenant who uses progesterone is not using a worse version of Draminski, they are using a different instrument'],
 ['value · unit','decimal(8,2) · text','OPS','<b>THE UNIT IS NOT OPTIONAL.</b> Draminski reads in ohms and RISES then FALLS; progesterone reads in ng/ml OR nmol/L (×3.18 between them) and RISES. <b>Never normalise silently</b> — a 6 in the wrong unit is a mating on the wrong day'],
 ['taken_on · taken_at','date · time','OPS','<b>time of day matters near the peak</b>, when readings go to twice daily'],
 ['day_of_season','computed','OPS','from the season start — the x-axis'],
 ['delta_from_previous · direction','computed · computed','OPS','<b>Lisa: “ideally see it visually as we are looking for a peak so whether its up or down from previous”.</b> Both derived from the row before, per method — never typed, never stored'],
 ['taken_by · device_id · note','ref · ref · text','OPS','which meter, because meters differ'],
 ['THE PEAK IS ONLY KNOWN AFTERWARDS','—','JUDGE','<b>you cannot mark a peak at the time — a reading is only the peak once the next one is lower.</b> So <code>is_peak</code> is computed on the whole series and recomputed as each reading arrives. Stored at entry it would be a guess that hardens into a fact, and the mating date would be built on it'],
 ['WHY A CHART AND NOT A LIST','—','JUDGE','<b>the shape is the answer.</b> A column of numbers hides a plateau; a line makes it obvious. Plot day-of-season against value, one line per method, with the direction arrow on the latest point and the peak marked once it can be'],
 ['MIXING METHODS ON ONE CHART','—','JUDGE','<b>two y-axes, never one.</b> Draminski ohms and progesterone ng/ml on a shared scale would be a meaningless picture that looks authoritative']]],

/* ============ MEDICINES: IN, OUT, AND THE BALANCE ============ */
['THE MEDICINE CHAIN','—','est',[
 ['YES — AND IT IS ALREADY BUILT','—','JUDGE','<b>Lisa 23 Sep: “can we track medicines coming in then when we use it then it takes it off inventory?”</b> The chain is <code>purchase_order</code> → <code>stock_movement</code> (in, with batch and expiry) → <code>dispense</code> → <code>administration</code> → <code>stock_movement</code> (out, same batch). One product table serves the shop and the medicine cupboard'],
 ['THE DEDUCTION IS AUTOMATIC','—','JUDGE','<b>recording that you gave 2.5 ml of Moxiclear to a 15.3 kg dog IS the stock movement.</b> Nobody adjusts inventory as a second job — if they did, it would be the job that gets skipped, and the balance would be wrong within a fortnight'],
 ['BALANCE IS DERIVED, NEVER STORED','—','JUDGE','<b>sum the movements per product per batch.</b> A stored quantity and a movement history disagree eventually, and the stored one always wins the argument while being the wrong one'],
 ['BATCH CARRIES THROUGH','—','LAW','<b>your Animana export proves the shape.</b> <code>stockbatch</code> holds batch/amount/expirydate; <code>invoicedetail</code> carries the batch onto the line that gave it to the animal. That is a recall working backwards — “which dogs had batch X” — and it is only answerable if the batch survives the whole chain'],
 ['CONTROLLED DRUGS ARE STRICTER','—','LAW','<b>running balance, two signatures, and disposal witnessed</b> — <code>medicine_register</code> already carries that, and it is a legal register rather than a stock report'],
 ['EXPIRY IS A DASHBOARD LINE','—','JUDGE','<b>the movement history knows what is about to go out of date and how much of it.</b> That is the number worth surfacing, not the total stock value']]],

/* ============ THE PIPELINE, AS ROWS ============ */
['pipeline_stage','THE STAGES — configurable, because yours are not everyone’s','risk',[
 ['tenant_id · sort_order','ref · int','OPS',''],
 ['label','text','OPS','<b>what the tenant calls it.</b> Lisa’s four: initial enquiry · deposit paid · puppy allocated, working towards collection · post collection'],
 ['short_code','text','OPS','<b>her shorthand lives HERE and nowhere else.</b> She said plainly: do not adopt it. A short code is a tenant’s display preference, and the moment it is baked into an enum it stops being one'],
 ['kind','enum enquiry | committed | allocated | delivered | aftercare','OPS','<b>the one thing that IS universal.</b> Reporting, resource release and the offer gate key off this, so a tenant can add a stage or rename one without breaking either. Lisa’s four map to enquiry · committed · allocated · aftercare'],
 ['requires_payment · requires_contract','bool','OPS','<b>“deposit paid” is a stage defined by a payment</b>, so the stage knows what moves it'],
 ['is_terminal','bool','OPS',''],
 ['effective_from · effective_to','date','OPS','<b>changing your pipeline is a new row.</b> An enquiry from 2024 sat in the 2024 stages, and a report over both years has to still make sense']]],

['programme','The breed line or product the enquiry is for','ops',[
 ['tenant_id · code · name','ref · text · text','OPS','<b>the prefix on her stage codes.</b> A tenant may run more than one line, and an enquiry is for one of them'],
 ['breed · size_variants · typical_wait_weeks','text','OPS',''],
 ['active','bool','OPS','retire a line without losing its history'],
 ['WHY IT IS NOT PART OF THE STAGE','—','JUDGE','<b>because you cannot count either one while they share a string.</b> “how many at deposit-paid across all lines” and “how many enquiries for this line at any stage” are both ordinary questions, and both are impossible until the prefix and the letter are separate columns. Same fault as the IC/BH inside the dog names']]],

/* ============ SAMPLES, ORDERS AND PENDING RESULTS ============ */
['sample','ONE SAMPLE, MANY TESTS — and three different dates','risk',[
 ['subject_id · sample_ref','ref · text','LAW','<b>Cooper’s Laboklin sample 2203-W-16578 carries TWO tests.</b> The sample is the thing, and results hang off it'],
 ['material','enum edta_blood | buccal_swab | blood_card | serum | hair | other','LAW','<b>from the Laboklin order form’s own list.</b> Cooper: EDTA blood, with “EDTA AND SERUM SENT” written on the order — so one collection can yield two materials'],
 ['collected_on · received_on · reported_on','date','LAW','<b>THREE DATES, ALL DIFFERENT, ALL ON ONE REPORT.</b> Cooper: sampled 24/02/2022, received 25/02, reported 08/03. Collapse them into one and you can no longer tell a slow lab from a slow post from a slow vet — and “how old is this result” has three possible answers'],
 ['collected_by_vet · vet_practice','bool · text','LAW','<b>only required if the sample was collected by a vet</b> — and whether it was is itself the fact that makes some results acceptable to a scheme. Same axis as the OFA certificate’s approved-collection-method field'],
 ['laboratory · accreditation','text','LAW','<b>LABOKLIN (UK), DIN ISO 17025, AKS-PL-20922.</b> Accreditation is printed on the report because it is part of what makes it evidence'],
 ['order_document_id · result_document_id','ref','LAW','the order form and the report are two documents and both are worth keeping']]],

['test_catalogue','The lab’s own list — number AND name','ops',[
 ['laboratory · test_no · test_name','text','LAW','<b>“8294 Chondrodysplasia (CDPA)”.</b> The order form says in terms: provide BOTH the test number and the test name. So they are two fields, and the pair is what identifies the test'],
 ['cost_incl_vat · currency','decimal · text','OPS',''],
 ['breeds_applicable','text','LAW','<b>the catalogue is breed-scoped</b> — Pompe’s is listed for Finnish Lapphund, Lapponian Herder and Swedish Lapp Hund only. Offering a test to the wrong breed is a wasted £55'],
 ['is_kc_official_scheme','bool','LAW','<b>and it carries a consequence.</b> The order form declaration: results of tests in the official UK Kennel Club scheme <i>will be sent to the Kennel Club and published</i>. That is a publication consent, not a tickbox'],
 ['inheritance_mode','enum autosomal_dominant | autosomal_recessive | x_linked | complex','LAW','<b>Cooper’s CDPA report states “Trait of inheritance: autosomal-dominant”.</b> This changes what a result MEANS — for a recessive, one copy is a safe carrier; for a dominant, one copy is affected. <b>A single “carrier” status across both would be wrong half the time</b>'],
 ['effective_from · effective_to','date','OPS','<b>test numbers, prices and panels change</b>']]],

['THE PENDING RESULT','—','risk',[
 ['“to follow…”','—','LAW','<b>Cooper’s CDDY/IVDD result reads: Genotype “to follow…”, Interpretation “Testing is underway, result will follow once testing is completed.”</b> The report was issued with one test done and one outstanding'],
 ['WHY IT MATTERS','—','JUDGE','<b>a system that only stores completed results would show this dog as simply untested for CDDY</b> — indistinguishable from one nobody ever sampled. But a breeding decision is waiting on it, the money is spent, and the sample is at the lab. <code>dna_result.status</code> needs <b>pending</b> as a first-class state, with the sample date, so the dashboard can say “ordered 24 Feb, still outstanding”'],
 ['AND A PARTIAL REPORT IS NORMAL','—','JUDGE','<b>one PDF, two tests, two different states.</b> Import per TEST, never per document — otherwise the whole report waits for its slowest test, or the finished one is filed as though the pending one had failed'],
 ['CDDY IS THE IVDD ONE','—','OPS','<b>this is the same screening as the IVDD batches on your inspection spreadsheet</b> — the CDDY variant carries the IVDD risk, and CDPA is the separate chondrodysplasia test. Two tests, similar names, different meanings, ordered together']]],

['TWO DISCREPANCIES IN YOUR OWN PAPERWORK','—','risk',[
 ['DATE OF BIRTH','—','OPS','<b>the Laboklin ORDER FORM gives Cooper’s DOB as 20/02/2021. The Laboklin RESULT gives 21/02/2021.</b> One day apart, same dog, same microchip 977200009704335, same lab. Not serious in itself — but it is exactly the kind of difference that makes two records fail to match on import, and it is why <b>microchip, not name plus DOB, is the join key</b>'],
 ['BREED','—','OPS','<b>the order form says “Australian Cobberdog”; the result says “LABRADOODLE”.</b> Your MDBA certificate says “F4 Australian Cobberdog”. Three documents, three breed strings, one dog'],
 ['THE RULE THIS PROVES','—','JUDGE','<b>never let an imported document overwrite a field on the dog.</b> Store what each source said, next to which source said it, and let the app show the disagreement rather than silently picking the most recent one. <code>registry_attribute</code> already does this for registries; the same applies to laboratories'],
 ['NOT CORRECTED HERE','—','JUDGE','<b>I have not decided which DOB is right and will not.</b> Reported because it is the kind of thing that is invisible until an import quietly creates a second Cooper']]],

/* ============ HOW A CHECKLIST COMES INTO EXISTENCE ============ */
['checklist_trigger','FOUR WAYS — and only one of them is a person deciding','est',[
 ['tenant_id · template_id','ref','OPS',''],
 ['trigger_kind','enum event | schedule | condition | request','OPS','<b>Lisa 23 Sep asked how things in the checklist get created. These are the four, and naming them is the answer.</b> <b>EVENT</b> — something changed state (a puppy marked Collected). <b>SCHEDULE</b> — a clock (daily checks, weekly weighing). <b>CONDITION</b> — a fact became true (outside temperature below −4, licence expiring in 30 days, fit-to-breed lapsed). <b>REQUEST</b> — “I need a checklist for…”'],
 ['on_event','text','OPS','<b>sale.collected · litter.whelped · subject.arrived · season.started · inspection.booked.</b> The event is named, so a template can be attached to it without anyone writing code'],
 ['on_condition','text','OPS','the expression, for condition triggers — the same mechanism <code>weather_trigger</code> already uses'],
 ['schedule','text','OPS','for the clock ones'],
 ['creates_for','enum the_subject | the_litter | the_client | the_business','OPS','<b>one collection event creates items about the PUPPY and items about the BUSINESS</b>, and they are not the same checklist'],
 ['assign_to_role','ref role','OPS','<b>so it lands on someone, not in a queue nobody owns</b>'],
 ['active · effective_from · effective_to','bool · date · date','OPS',''],
 ['WHY NOT JUST LET PEOPLE MAKE LISTS','—','JUDGE','<b>because the ones that matter are the ones nobody remembers to make.</b> A person will always create the checklist for the thing they are already thinking about. The microchip transfer nobody thought about on a busy collection day is exactly the one with a legal deadline']]],

['THE COLLECTION EVENT, WORKED THROUGH','—','est',[
 ['1 · WHAT YOU DO','—','OPS','<b>mark the puppy Collected.</b> That is the whole interaction — one status change, on the day, on a phone'],
 ['2 · WHAT CHANGES BY ITSELF','—','JUDGE','<b>the occupancy row closes, so the on-site count drops.</b> Lisa 23 Sep: “our numbers change” — and they change because the count is <b>derived from occupancy</b>, not because anyone edited a total. The dogs-on-licence figure, the area headroom, the staff ratio and the puppies-under-6-months count all move off the same event. <b>Nothing is typed twice, so nothing can disagree</b>'],
 ['3 · WHAT APPEARS','—','JUDGE','<b>the post-adoption checklist, from the template attached to sale.collected.</b> Her own items: transfer the microchip keepership, enter the licence records, register the sale, send the post-adoption resources, diarise the check-in call. Each with its own due date and its own owner'],
 ['4 · WHICH ITEMS HAVE TEETH','—','LAW','<b>microchip keeper transfer is statutory and dated; the welcome email is not.</b> The statutory ones take their deadline from <code>jurisdiction_rule</code> and show red when late — and they are the reason this is a trigger rather than a habit'],
 ['5 · WHAT THE DASHBOARD THEN SHOWS','—','JUDGE','<b>not “1 collection done” but “1 collected, 4 post-adoption items open, 1 of them statutory and due Friday”.</b> The event is finished; the obligations it created are not, and those are the ones that get lost'],
 ['AND IT RUNS BACKWARDS TOO','—','JUDGE','<b>if the collection is cancelled, the items it created are withdrawn rather than left orphaned</b> — which is why the instance records what triggered it']]],

/* ============ PRE-LICENCE AUDIT ============ */
['audit_run','WHAT IS MISSING — run it before they arrive, not after','est',[
 ['tenant_id · licence_id · run_at · run_by','ref · ref · timestamp · ref','OPS',''],
 ['scope','enum full_licence | single_condition | date_range | one_area | one_dog','OPS','<b>the week before renewal you want everything; the morning of a visit you want one room</b>'],
 ['period_from · period_to','date','LAW','<b>an inspection covers a period, and “missing” only means anything inside one.</b> A temperature reading absent from July is a gap; absent from next week is not'],
 ['gaps_found · gaps_closed · statutory_gaps','int','OPS','<b>every run states its own counts</b>'],
 ['snapshot_document_id','ref','OPS','<b>keep the run.</b> “We found 23 gaps in August and 2 in September” is a better answer to an inspector than a clean screen with no history']]],

['audit_gap','ONE ROW PER THING NOT YET IN — and where to find it','risk',[
 ['audit_run_id · licence_condition_id','ref','LAW',''],
 ['gap_kind','enum no_record | record_incomplete | evidence_missing | out_of_window | expired | unsigned | below_precision | not_displayed','LAW','<b>“missing” is at least eight different problems and they need different actions.</b> A reading taken at the wrong precision is not the same as one never taken — the first cannot be fixed at all, the second might be sitting in the staff room'],
 ['what · expected_on · subject_or_area','text · date · ref','LAW','<b>“H3 PM temperature, 14 August”</b> — specific enough to go and find'],
 ['likely_location','text','OPS','<b>Lisa 23 Sep: “so we can locate the missing sheets from the staff room”.</b> If the app printed the sheet it knows which sheet, which week and which batch — so it can say <i>“week 33 check sheet, printed 11 Aug, never returned”</i> rather than just “no data”. <b>That is the difference between a gap list and a search list</b>'],
 ['record_sheet_id · batch_entry_id','ref','OPS','the printed sheet it should have come back on'],
 ['is_statutory · severity','bool · enum blocker | major | minor','LAW','<b>sort by what actually stops the licence</b>'],
 ['how_to_close','computed','JUDGE','<b>plain version of what I called “still_fixable”, which was jargon.</b> Three routes, and <b>the app assumes the first one</b>: <b>FIND IT</b> — the record exists on paper, go and get it. This is nearly every gap and it is what the audit is for. <b>DO IT NOW</b> — the thing itself can still be done: get the signature, renew the certificate, put the sign back on the wall. <b>EXPLAIN IT</b> — the observation genuinely never happened, so there is nothing to find'],
 ['resolution · resolved_on · note','enum found_and_entered | done_now | explained | still_open · date · text','OPS','<b>the audit is worked like a list until it is empty</b> — which is the point of running it in the first place'],
 ['THE GOAL IS ZERO','—','JUDGE','<b>and it is reachable.</b> Run it the week before renewal, get a list, walk to the staff room, find the sheets, enter them, watch the count fall. <b>23 gaps → 21 found → 2 explained → done.</b> That is the whole feature, and “everything is in, no gaps” is exactly what it is built to produce'],
 ['THE ONE GUARD RAIL','—','LAW','<b>and it is small, but it protects you.</b> Where the record is a point-in-time measurement that was never taken — nobody read the thermometer on 14 August — the app will not accept a figure typed in today <i>dated</i> 14 August. You can still record what happened and why. This is your own <code>performed_on</code> vs <code>recorded_at</code> rule doing its job: <b>backfilling a week of real paper checks is fine and expected; inventing a reading that was never taken is a falsified record</b>, and an honest gap with a note is far safer in front of an inspector than a number that cannot be stood behind'],
 ['WHY THIS IS NOT THE DASHBOARD','—','JUDGE','<b>the dashboard asks “what needs doing today”. This asks “what is not yet in, for a period now closed”.</b> Opposite questions, opposite time directions — and only this one can be run before a renewal and worked through to zero']]],

/* ============ THE 12-POINT CHECK, AS DEFINITION + RESULTS ============ */
['health_check_point','YOUR 12 POINTS — with the threshold and the action on each','risk',[
 ['tenant_id · sort_order · code','ref · int · text','OPS',''],
 ['grouping','enum identification | eyes_ears_nose_mouth | skin_appetite_poo_urine | respiratory_mobility_behaviour','OPS','<b>your own three categories, verbatim</b>: Eyes/Ears/Nose/Mouth · Skin/Appetite/Poo/Urine · Respiratory/Mobility/Behaviour and Vocality'],
 ['point','text','OPS','Eyes · Ears · Nose · Mouth · Skin &amp; Coat · Appetite · Faeces · Urine · Respiration · Mobility · Behaviour · Vocality'],
 ['normal_description','text','OPS','<b>“Bright, clear, no discharge” · “Clean, odourless, no scratching” · “Moist, clean, no discharge”.</b> The sheet tells the checker what normal looks like — that is training embedded in the form, and it is why the form works with new staff'],
 ['concerning_description','text','OPS','<b>“Mucus, redness, swelling” · “Loose, bloody, or none” · “Coughing, wheezing, fast rate”</b>'],
 ['escalation','enum flag | monitor | monitor_or_flag | report_and_monitor | record_and_observe | urgent','LAW','<b>THE PART A GENERIC CHECKLIST DESTROYS.</b> Your sheet gives a DIFFERENT action per point: Respiration = <i>urgent</i>. Appetite = <i>refusal = monitor or flag</i>. Faeces and Urine = <i>report and monitor, sample may be needed</i>. Mobility = <i>record &amp; observe</i>. One “concern” flag across all twelve would throw that away and treat a limp like a breathing difficulty'],
 ['may_need_sample','bool','LAW','<b>faeces and urine only</b> — and it is what turns a check into a vet job'],
 ['baseline_relative','bool','JUDGE','<b>Behaviour and Vocality are judged “in accordance with their normal demeanour”, not against a standard.</b> So these two need that dog’s own baseline, which means prior checks are part of reading today’s — an absolute scale would be meaningless for them'],
 ['sop_version_id · effective_from · effective_to','ref · date · date','LAW','<b>a changed check point is a new row.</b> A check passed in 2025 was passed against the 2025 definition']]],

['daily_check_result','One row per point per dog per day','risk',[
 ['daily_check_id · health_check_point_id','ref','OPS',''],
 ['outcome','enum normal | concerning | not_checked','OPS','<b>not_checked is not the same as normal</b>, and a form that cannot say so produces false compliance'],
 ['observation · media_id','text · ref','OPS','what was actually seen'],
 ['escalation_applied · escalated_to · escalated_at','enum · ref · timestamp','LAW','<b>the point’s own action, and whether it was actually taken.</b> “Urgent” recorded with no escalation is the finding, not the concern itself'],
 ['resulting_visit_id','ref visit','OPS','where a concern became a vet appointment'],
 ['WHY NOT ONE ROW WITH TWELVE COLUMNS','—','JUDGE','<b>because your check will change and columns cannot.</b> The same rule you gave for capacity and staffing ratios: when it increases, it is a row. Twelve columns also cannot hold an observation, a photo or an escalation per point — and the observation is the bit the vet actually wants'],
 ['REPORT ANY CONCERNS','—','LAW','<b>the last line of your own sheet, in capitals.</b> With rows, that stops being an instruction on paper and becomes something the app can check: any concerning outcome with no escalation recorded is itself a gap, and the pre-licence audit will list it']]],

/* ============ PAPER RECORDS THAT LIVE ON SITE ============ */
['physical_record','THE HARD COPIES — the app indexes them, it does not replace them','risk',[
 ['tenant_id · kind','ref · enum puppy_log | bitch_record | check_sheet | medicine_sheet | vaccination_card | contract | other','LAW','<b>Lisa 23 Sep: “the puppy logs and the mum’s records are hard copies kept on site”.</b> Welsh Conditions 6 and 7 require a <i>written record</i> — hers are on paper, and the app must work with that rather than pretend otherwise'],
 ['subject_id · litter_id','ref','LAW','which dog or litter it belongs to'],
 ['identifier · opened_on · closed_on','text · date · date','LAW',''],
 ['location','text','OPS','<b>“staff room, blue folder, shelf 2”.</b> This is the field that answers “where is it” — and it is the difference between the audit saying <i>“missing”</i> and saying <i>“not where it should be, which is here”</i>'],
 ['scanned_document_id · last_scanned_on','ref · date','OPS','<b>a scan is a copy, not the record.</b> Worth having, and worth knowing how stale it is'],
 ['retain_until','computed','LAW','<b>AND THE TWO ARE DIFFERENT.</b> Welsh Condition 6(3): the bitch record is kept <i>for the lifetime of the breeding bitch</i>. Condition 7(3): the puppy record is kept <i>3 years from the date of birth of the puppy</i>. Same folder, same shelf, two completely different retention clocks — computed, never typed'],
 ['handed_to_new_owner_on','date','LAW','<b>Conditions 6(2) and 7(2): on transfer, a COPY goes to the new owner and a copy is retained.</b> Both halves are obligations and only one of them is obvious'],
 ['WHAT THE APP CAN HONESTLY KNOW','—','JUDGE','<b>that it exists, where it is, when it was last seen and when it may be destroyed — not what is written in it.</b> Claiming otherwise would be the app asserting compliance it cannot see. The pre-licence audit therefore reports these as <i>“exists, located”</i> or <i>“not located”</i>, never as “complete”'],
 ['WHAT IT CAN DO THAT PAPER CANNOT','—','JUDGE','<b>tell you what you are allowed to throw away.</b> A shelf of folders where some must be kept for the life of a fourteen-year-old bitch and others expired three years after a birth is unmanageable by eye — and the failure mode is keeping everything, which is a UK GDPR problem of its own']]],

/* ============ WHEN THE LIMIT CANNOT BE HELD ============ */
['mitigation_measure','THE LIBRARY — your own list','ops',[
 ['tenant_id · measure · direction','ref · text · enum cooling | warming | both','OPS','<b>Lisa’s own, verbatim: ice cubes in water bowls · paddling pools · walking in shade not full sun.</b> Plus the obvious cold-side ones — extra bedding, heat lamp checked, pipes lagged, water not frozen'],
 ['applies_to_area_kind','text','OPS','<b>a paddling pool is not a measure for an indoor whelping room</b>'],
 ['evidence_expected','enum note | photo | reading | none','OPS','<b>a photo of the paddling pool out is better evidence than a sentence saying it was</b>'],
 ['sop_version_id','ref','LAW','these come from your hot-weather and cold-weather SOPs'],
 ['effective_from · effective_to','date','OPS','']]],

['area_exposure_declaration','DECLARED IN ADVANCE — not explained afterwards','risk',[
 ['area_id · direction','ref · enum can_exceed_max | can_fall_below_min | both','LAW','<b>Lisa 23 Sep: “notes in all relevant areas where it is feasible that the limits could be exceeded but we specify that and explain”.</b> This is the standing declaration, made once per area, before the hot week rather than during it'],
 ['reason','text','LAW','<b>“south-facing, single-skin cabin, no mechanical cooling”</b> — the inspector’s question is whether you understand your own premises, and a declaration proves you do'],
 ['foreseeable_when','text','LAW','<b>“outside above 28°C”</b> — tied to the weather trigger, so the app knows which days to expect it'],
 ['standing_measures','ref mitigation_measure[]','LAW','<b>the plan, agreed in advance.</b> When the day comes, this is what appears as the checklist — nobody is improvising in 32°C'],
 ['reviewed_on · reviewed_by · vet_endorsed','date · ref · bool','LAW','<b>your Welsh vet form asks it directly: “Is there adequate shelter and shade from inclement or hot weather?”</b> A dated, vet-endorsed declaration is the answer to that question in written form'],
 ['effective_from · effective_to','date','LAW','<b>a new cabin or a new shade sail is a new row</b>'],
 ['WHY DECLARED BEATS EXPLAINED','—','JUDGE','<b>the same note written in advance and written afterwards are not worth the same.</b> Written in advance it is a plan, and the actions that follow are the plan being carried out. Written afterwards it is an excuse, and it looks like one — even when it is completely true']]],

['reading_mitigation','WHAT WAS ACTUALLY DONE, ON THE DAY','risk',[
 ['area_reading_id · measure_id','ref','LAW','<b>attached to the specific reading that went out of band</b>, so the two are never separated'],
 ['done_at · done_by','timestamp · ref','LAW',''],
 ['note','text','LAW','<b>free text, and it should be</b> — “paddling pool out from 11am, all dogs walked before 8am, ice in all bowls twice”'],
 ['media_id','ref','LAW','the photo'],
 ['outside_temp_c · weather_observation_id','decimal · ref','LAW','<b>the exceedance is only defensible if the outside conditions are on the record too.</b> 29°C indoors on a 34°C day is a different fact from 29°C indoors on a 15°C day — the second one is a broken heater and no amount of ice explains it. <b>This is why the weather feed stopped being decoration</b>'],
 ['follow_up_reading_id','ref','LAW','<b>did it work?</b> A measure with a later in-range reading behind it is evidence; one with no follow-up is an assertion'],
 ['THE WHOLE CHAIN','—','JUDGE','<b>declared in advance → weather crosses the threshold → checklist appears → measures carried out and photographed → follow-up reading taken → the exceedance is compliant.</b> Every step is a row that already exists for another reason. Nobody writes a report; the report is what the rows already say']]],

/* ============ PEOPLE, ALIASES AND SEARCH ============ */
['person','THE HUMAN RECORD — was referenced but did not exist','risk',[
 ['tenant_id · full_name · known_as','ref · text · text','OPS','<b>ONE HUMAN, ONE ROW.</b> Caught 23 Sep: nine tables carried a <code>client_id</code> pointing at a <code>client</code> table that was never defined, and <code>staff</code> re-typed <code>name</code> as text. All of them now point here. A person can be a client and a supplier contact and staff — that is three flags on one row, not three records that drift apart'],
 ['email · phone · address · postcode','text','OPS',''],
 ['is_client · is_staff · is_vet · is_supplier_contact','bool','OPS','<b>one human, several relationships.</b> Your vet is a person; so is a family who later becomes a breeder. Separate tables for each would duplicate the human'],
 ['marketing_consent · consent_basis','bool · ref consent','LAW',''],
 ['effective_from · effective_to','date','OPS','']]],

['name_alias','THE REASON SEARCH WILL ACTUALLY FIND THINGS','risk',[
 ['entity_type · entity_id','enum subject | person · ref','OPS',''],
 ['alias · alias_kind','text · enum former_name | bracketed_name | family_name | prefix_variant | registry_name | sibling_line','OPS','<b>straight out of your own files.</b> <i>Dolly (Jasmine)</i> · <i>Kendra (Kara)</i> · <i>Ivy (Heather)</i> · <i>Delia (Penny)</i> — four dogs carrying a second name in brackets. <i>elsa eli now “benji”</i> — a family’s name for a puppy. <i>CurlyCwtch Heidi/Nellie</i> — two dogs on one pedigree line'],
 ['is_primary','bool','OPS',''],
 ['source','enum typed | pedigree_import | registry | goods_order','OPS','where the alias came from, so a bad import can be undone'],
 ['WITHOUT THIS, SEARCH FAILS ON YOUR OWN DOGS','—','JUDGE','<b>someone types “Jasmine” and gets nothing, because the record says “Dolly”.</b> That is not a search problem, it is a data-model problem, and no amount of clever matching fixes it at query time']]],

['SEARCH — WHERE THE BARS ARE AND WHAT THEY SEE','—','est',[
 ['ONE GLOBAL BAR','—','JUDGE','<b>top of every page, always the same place.</b> It answers one question: <i>I know a name or a number, take me to it.</i> It searches <b>dogs</b> (name, call name, every alias, microchip, registry number), <b>people</b> (name, alias, email, phone), <b>litters</b> (name, dam, birth date), <b>areas</b> (code) and <b>documents</b> (title). One bar, mixed results, grouped by type'],
 ['MICROCHIP MATCHES FROM THE END','—','JUDGE','<b>nobody types all fifteen digits.</b> A chip reader shows 977200009704335 and a person reads out “…704335”. Trailing-fragment match on 5 digits or more, exact match on the full number — and it must search <code>microchip_number</code> on the dog AND the number written on the Laboklin report and the MDBA certificate, because those are how you will have it to hand'],
 ['PREFIXES ARE IGNORED, NOT REQUIRED','—','JUDGE','<b>your own rule from the 4g template.</b> “Curlycwtch” and “doodleDogs’” may or may not be typed, in any capitalisation — so search strips them before matching and still shows the full name in the result'],
 ['FILTERS, NOT FREE TEXT, ON THE LISTS','—','JUDGE','<b>a second bar on each list page, and it is a different animal.</b> Dogs list: category, breeding status, area, age band, screening due, In Training. Litters: stage, dam, age in days. Families: pipeline stage, programme, colour preference. <b>These are the fields you sort and count by</b> — free text is the wrong tool and returns a list you cannot act on'],
 ['THE AUDIT SEARCHES BY DATE, NOT BY NAME','—','JUDGE','<b>“what is not in, for August, for H3”.</b> Period and condition, never a name — which is why the pre-licence audit has its own controls rather than reusing the global bar'],
 ['ONE BAR, DIFFERENT RESULTS BY ROLE','—','LAW','<b>and this is the part that is easy to get wrong.</b> A staff member searching “Harper” must get nothing, because families and finances are outside their role. Search runs through the same permission grid as every other read — <b>it is not a shortcut around it</b>. An inspector’s view has no global bar at all'],
 ['NOT DESIGNED YET','—','JUDGE','<b>stated plainly because Lisa asked and the honest answer was no.</b> What is settled is the above; what is not is result ranking, whether recent items float, and whether the bar takes commands (“new litter”, “weigh Cookie”). Those are worth deciding before build, not during']]],

/* ============ CHEMICALS, SDS AND COSHH ============ */
['chemical','EVERY SUBSTANCE ON SITE — the inspection asks for this list','risk',[
 ['tenant_id · product_name · manufacturer','ref · text · text','LAW','<b>your Welsh vet form: “Suitable cleaning agents, disinfectants and equipment are available (detail disinfectants in use)”.</b> It asks you to name them, so they are a list, not a sentence'],
 ['category','enum disinfectant | detergent | parasiticide | rodenticide | pool_chemical | fuel | paint | veterinary_medicine | other','LAW','<b>rodenticide ties straight to <code>external_risk_factor</code> — the pest-control entry on the same form</b>'],
 ['used_for · areas_used','text · ref area[]','LAW','<b>the same disinfectant is a different risk in a whelping room and a yard</b>'],
 ['dilution_rate · contact_time','text','LAW','<b>a disinfectant used at the wrong dilution or wiped off too soon has not disinfected anything</b> — and your SOP carries 500 ml / 900 ml / 5 L concentrate variants, which are different products with different rates'],
 ['product_id','ref product','OPS','<b>the same row you buy and hold stock of</b> — Odour Neutraliser and Disinfectant are already on your goods order'],
 ['storage_location · locked','text · bool','LAW','<b>where it is kept, and whether a dog or a child could reach it</b>'],
 ['in_use_from · in_use_to','date','LAW','<b>you changed disinfectant in June — a row, not an edit</b>']]],

['safety_data_sheet','THE SDS — theirs, and it gets reissued','risk',[
 ['chemical_id · document_id','ref','LAW','<b>the PDF upload area Lisa asked for, on the licence side</b>'],
 ['sds_revision · sds_dated','text · date','LAW','<b>an SDS carries its own revision number and date, and manufacturers reissue them.</b> The one in your folder may be two revisions behind, and “we have an SDS” is not the same as “we have the current SDS”'],
 ['supersedes_id','ref safety_data_sheet','LAW','<b>same archive chain as the insurance</b> — the sheet in force when someone was exposed is the one that matters'],
 ['hazard_statements · signal_word · pictograms','text','LAW','H-statements, Danger or Warning, and the GHS symbols'],
 ['ppe_required · first_aid · spillage_action · storage_requirements','text','LAW','<b>the four sections anyone actually needs at 7am</b>, pulled out of a twelve-page PDF so they can be printed onto a wall card via <code>reference_card</code>'],
 ['obtained_on · checked_current_on','date','LAW','<b>when you last verified it was still the current revision</b>'],
 ['IT IS NOT YOUR DOCUMENT','—','JUDGE','<b>the SDS is the manufacturer’s.</b> You cannot edit it, you can only hold the right version of it — which is why the useful fields here are the revision, the date and whether anyone has checked it lately']]],

['coshh_assessment','AND THIS ONE IS YOURS','risk',[
 ['chemical_id · document_id','ref','LAW','<b>the SDS is the manufacturer’s; the COSHH assessment is YOURS.</b> It assesses that substance <i>in your setting, with your staff, around your dogs</i>. Inspectors ask for both and they are routinely confused for each other — having only the SDS is a common finding'],
 ['assessed_by · assessed_on · review_due','ref · date · date','LAW',''],
 ['who_is_exposed · how · how_often','text','LAW','staff, dogs, visitors — and by inhalation, skin contact or ingestion'],
 ['control_measures · residual_risk','text · enum low | medium | high','LAW',''],
 ['staff_briefed_ids · briefed_on','ref staff[] · date','LAW','<b>an assessment nobody has read is not a control measure</b> — ties to <code>sop_acknowledgement</code>'],
 ['supersedes_id · status','ref · enum current | superseded','LAW','<b>reviewed, not rewritten over</b>']]],

['THE ARCHIVE RULE, NAMED','—','est',[
 ['THIS IS THE SAME THING, FOR THE SEVENTH TIME','—','JUDGE','<b>jurisdiction rules · screening schemes · SOP versions · capacity tables · temperature bands · staffing ratios · prices · and now insurance, SDS and COSHH.</b> Every one of them: <i>a change is a new row with dates, never an edit, and the old row is kept</i>'],
 ['LISA SAID IT FIRST','—','JUDGE','<b>“when they increase size then it’s a row not a column”.</b> It has turned out to be the single most repeated structural rule in this app, and it is worth building ONCE as shared machinery — a versioned-record behaviour that any table can take on — rather than nine separate implementations that will drift'],
 ['THE TEST FOR IT','—','JUDGE','<b>ask: could anyone ever need to know what this said on a date in the past?</b> For a compliance record the answer is almost always yes, and wherever it is yes, overwriting is data loss dressed up as an update']]],

/* ============ THE AUDIT TRAIL — MISSING UNTIL NOW ============ */
['audit_log','WHO CHANGED WHAT — and BLD had no such table','risk',[
 ['tenant_id · occurred_at · actor_id · actor_name','ref · timestamp · ref · text','LAW','<b>found 23 Sep by comparing against CareCircle, an app Lisa already owns.</b> Its <code>activity_event</code> has this and BLD did not — a compliance app with no audit trail, which nobody had noticed because every individual table looked complete'],
 ['entity_type · entity_id','text','LAW','which table, which row'],
 ['action','enum created | updated | deleted | released | withdrawn | signed | escalated','LAW',''],
 ['field_key · old_value · new_value','text','LAW','<b>field-level, not row-level.</b> Red Way’s audit_log carries exactly these three — “the record changed” is not an answer; “the temperature was edited from 24.4 to 26.4 by X on Y” is'],
 ['reason','text','LAW','<b>required on anything back-dated or corrected</b>'],
 ['WHY A COMPLIANCE APP CANNOT SKIP THIS','—','LAW','<b>because the whole defence rests on the records being trustworthy.</b> An inspector who suspects a record was written after the fact has no way to be reassured, and you have no way to prove otherwise — unless every edit carries who, when, from what, to what, and why. It is also the only thing that makes the <code>performed_on</code> / <code>recorded_at</code> split enforceable rather than merely intended'],
 ['AND IT IS APPEND-ONLY','—','LAW','<b>no edit, no delete, ever.</b> An editable audit log is not an audit log']]],

['feed_product','THE FOODS — entered once, used everywhere','ops',[
 ['tenant_id','ref','LAW',''],
 ['name · brand','text','OPS','<b>Lisa 23 Sep: “a place I can enter the foods”.</b> This is that place'],
 ['form','text closed set dry | wet | raw | topper | supplement | milk_replacer','OPS','<b>TEXT, never select (PR147).</b> Milk replacer is here because orphan and supplemented litters are fed it and it must be recorded like any other feed'],
 ['life_stage_suitability','text closed set puppy | junior | adult | senior | all_life_stages | lactating','OPS','what the bag says it is for — so the app can warn when a pup is on an adult food'],
 ['kcal_per_100g · protein_pct · fat_pct','decimal','JUDGE','<b>only needed if you ever want the app to check a ration against a requirement.</b> Leave blank and nothing breaks'],
 ['product_id','ref product','OPS','<b>OPTIONAL, and this is the join that matters.</b> If the food is also a shop line, point at it and feeding a dog can decrement stock the same way selling one does. If you do not sell it, leave it null and feed_product stands alone'],
 ['supplier_id','ref supplier','OPS',''],
 ['active · discontinued_on','bool · date','OPS','<b>a food you stopped using is not deleted.</b> Past feeding records still point at it and must still read correctly'],
 ['NOT A DIET','—','JUDGE','<b>this table is the tin, not the meal.</b> How much of it a given dog gets is feeding_plan_line — keeping them apart is what lets one food serve forty dogs at forty different amounts']]],

['feeding_plan','WHAT THIS DOG IS ON — and it is a row, not a column','risk',[
 ['tenant_id','ref','LAW',''],
 ['subject_id · litter_id','ref','OPS','<b>one or the other.</b> Pups with mum are fed as a litter, not forty individual plans; a weaned pup gets its own'],
 ['effective_from · effective_to','date','OPS','<b>THE ARCHIVE RULE, ninth application.</b> A dog’s diet changes — weaning, pregnancy, lactation, weight loss, a vet’s instruction. Overwrite the amount and you can never answer “what was she on in June”, which is exactly what you are asked when a litter did badly'],
 ['feeds_per_day','int','OPS','3 for young pups, 2 for most adults, 1 for some — and it changes with age'],
 ['reason_for_change','text','OPS','<b>weaning · pregnancy · lactation · vet instruction · weight · owner request.</b> Costs nothing to record and is the whole story when you look back'],
 ['set_by · set_on','ref staff · date','OPS',''],
 ['vet_directed','bool','LAW','<b>a prescription diet is a clinical instruction, not a preference.</b> Flag it so nobody changes it casually'],
 ['notes','text','OPS','']]],

['feeding_plan_line','The actual meal','ops',[
 ['feeding_plan_id','ref','OPS',''],
 ['meal_slot','text closed set morning | midday | evening | overnight | free_access','OPS','<b>this is what makes a daily routine printable.</b> Group every line in the house by slot and you have the morning round'],
 ['feed_product_id','ref feed_product','OPS',''],
 ['amount · unit','decimal · text closed set g | ml | scoop | can | pouch | handful','OPS','<b>Lisa: “an amount (can vary)”.</b> Decimal, not integer — half a scoop is a real instruction'],
 ['amount_max','decimal','OPS','<b>the “can vary” half.</b> Fill it in and the line reads “80–100g”; leave it null and it reads “80g”. One optional field instead of a second table'],
 ['sort_order','int','OPS',''],
 ['instruction','text','OPS','“soaked 10 min” · “mixed with the wet” · “slow bowl” — the bit staff actually need']]],

['feeding_event','What was actually fed, and whether it was eaten','risk',[
 ['tenant_id','ref','LAW',''],
 ['subject_id · litter_id · area_id','ref','OPS','<b>area_id because a room of pups gets fed as a room.</b> Forcing a per-dog row on a litter feed is how you get staff not recording it at all'],
 ['feeding_plan_line_id','ref','OPS','<b>what was supposed to happen</b>, so a deviation is visible rather than invisible'],
 ['feed_product_id · amount · unit','ref · decimal · text','OPS','what actually went in the bowl — may differ from the plan'],
 ['performed_on · recorded_at','datetime ISO','LAW','<b>THE CAPTURE SPLIT.</b> Fed at 7am, entered at 11 — both true, both recorded'],
 ['performed_by · recorded_by','ref staff','OPS',''],
 ['intake','text closed set all | most | half | little | none | not_offered','LAW','<b>THE CLINICALLY IMPORTANT FIELD, and the reason this table exists at all.</b> A refused meal is the earliest sign of almost everything. Without it feeding is admin; with it, feeding is monitoring — and the dashboard can raise a dog that has eaten “little” twice running'],
 ['notes','text','OPS',''],
 ['DECREMENTS STOCK','—','JUDGE','<b>only where feed_product.product_id is set.</b> Same mechanism as medicines coming off inventory — built once, used by both']]],

['feeding_routine','THE DAILY ROUND — derived, never typed','est',[
 ['NOT A TABLE','—','JUDGE','<b>this card is here so nobody builds it as one.</b> “Today’s feeding routine” is a query, not stored data'],
 ['HOW IT IS BUILT','—','JUDGE','take every feeding_plan where today falls between effective_from and effective_to → join feeding_plan_line → join occupancy for where each dog is now → group by area, then by meal_slot. <b>Staff get one screen per round, in room order</b>'],
 ['AND IT TICKS OFF','—','JUDGE','each line on that screen writes a feeding_event with its intake value. <b>The routine is the input form, not a separate record</b>'],
 ['WHY DERIVED MATTERS','—','JUDGE','<b>a stored routine goes stale the moment a diet changes or a dog moves room.</b> A derived one cannot — same reason the hub’s own counts are computed and not typed']]],

['contract_template','THE PAPER, versioned','risk',[
 ['tenant_id','ref','LAW',''],
 ['name','text','OPS',''],
 ['applies_to','text closed set puppy_sale | breeder_sale | stud | guardian | co_ownership | deposit | staff | supplier','OPS','<b>Lisa sells to customers AND to breeders — they are not the same contract.</b> Guardian and stud are the two people forget'],
 ['body','text','OPS','the clause text, with merge fields'],
 ['version','text','LAW',''],
 ['effective_from · effective_to','date','LAW','<b>THE ARCHIVE RULE again.</b> A contract signed in 2024 must still read as the 2024 wording. Overwrite the template and every past signature silently claims to have agreed to today’s terms — the same failure as overwriting an SOP, with legal consequences instead of regulatory ones'],
 ['requires_witness · requires_countersignature','bool','JUDGE','']]],

['contract','One agreement, one row','risk',[
 ['tenant_id','ref','LAW',''],
 ['contract_template_id · template_version','ref · text','LAW','<b>the version is copied onto the contract, never looked up.</b> Same rule as sop_version_id on a daily check'],
 ['subject_id · litter_id','ref','OPS','which dog it concerns, where it concerns one'],
 ['person_id','ref','OPS','the primary party'],
 ['issued_on · due_by','date','OPS',''],
 ['status','text closed set draft | sent | viewed | part_signed | signed | countersigned | void | superseded','OPS','<b>part_signed is the one that earns its place</b> — joint buyers sign at different times and the gap is exactly when things go wrong'],
 ['body_snapshot','text','LAW','<b>the rendered text as it was signed, stored on the contract.</b> Not a pointer to the template — a copy. This is the difference between having a contract and having a claim about one'],
 ['document_id','ref document','OPS','the signed PDF once complete'],
 ['void_reason','text','OPS','']]],

['contract_party','WHO IS SIGNING — and there is more than one','ops',[
 ['contract_id','ref','OPS',''],
 ['person_id','ref','OPS','null where the party is not a client — a witness, a staff member'],
 ['name · email · phone','text','OPS','<b>captured on the contract, not only on the client record.</b> People move; the contract must still say who signed it'],
 ['role','text closed set buyer | co_buyer | breeder | guardian | stud_owner | witness | staff','OPS','<b>co_buyer is why this is a table and not two columns.</b> Your own puppy logbook prints TWO owner blocks — the paper already knew'],
 ['sort_order','int','OPS','']]],

['contract_signature','The signature itself','risk',[
 ['contract_party_id','ref','LAW',''],
 ['signed_at','datetime ISO','LAW','<b>the moment, to the second, in ISO</b> — a date alone is not evidence of sequence'],
 ['method','text closed set drawn | typed | wet_scanned | click_accept','LAW','<b>they are not equally strong and a dispute turns on which it was.</b> Record it rather than implying one'],
 ['signature_media_id','ref media','LAW','the drawn or scanned mark'],
 ['typed_name','text','LAW','what they typed, where method is typed'],
 ['agreed_body_hash','text','JUDGE','<b>a hash of the body they were shown.</b> Cheap to store, and it is the one field that proves the text did not change after signing. Without it the whole record is trust-me'],
 ['ip_address · user_agent','text','JUDGE','<b>only for click_accept and typed.</b> Standard e-signature evidence — and note this is personal data, so it belongs in the consent register'],
 ['declined_at · decline_reason','datetime · text','OPS','<b>a refusal is a record too.</b> Most designs only model success and then cannot explain a gap'],
 ['NOT V1','—','JUDGE','<b>Lisa: “eventually”.</b> These three tables are here so the shape is right when it arrives — building them later against signed paper contracts is the migration you do not want. Build the tables, leave the screens']]],

['subject_owner','OWNERSHIP OVER TIME — a row, not a column','risk',[
 ['tenant_id','ref','LAW',''],
 ['subject_id','ref','LAW',''],
 ['person_id','ref','LAW',''],
 ['role','text closed set owner | co_owner | guardian | breeder_retained','LAW','<b>your Puppy Logbook prints two Owner Details blocks.</b> One owner column could never have held that'],
 ['from_date · to_date','date','LAW','<b>THE ARCHIVE RULE, tenth application, and this one is statutory.</b> Change of ownership must be recorded and the record kept — which is impossible if ownership is a column you overwrite'],
 ['transfer_document_id','ref document','LAW','the change-of-ownership record itself'],
 ['microchip_transferred_on','date','LAW','<b>the item most often missed post-collection</b>, and it is on your own post-adoption checklist'],
 ['registry_transferred_on','date','OPS','MDBA / KC transfer, separate from the chip and usually later']]],

['handover_pack','THE PUPPY LOGBOOK, as a generated thing','risk',[
 ['tenant_id · subject_id','ref','LAW',''],
 ['issued_on','date','LAW',''],
 ['issued_to_person_id','ref','LAW',''],
 ['pack_document_id','ref document','LAW','<b>the PDF as handed over, stored.</b> Not regenerated on demand — regenerating gives today’s data, and the question is always what was given on the day'],
 ['retention_until','date','LAW','<b>issued_on + the statutory retention period.</b> Your own logbook says it in print: the record must be retained by the licence holder for THREE YEARS'],
 ['includes','text','OPS','which documents went in — pedigree, vaccination card, microchip paperwork, contract, care sheet, insurance voucher'],
 ['WHAT IT IS BUILT FROM','—','JUDGE','<b>every field on your logbook already exists in this schema.</b> Puppy gender, DOB, breed, microchip — subject. Vaccinations and worming with next-due — treatment and required_vaccination. Colour and identifying features — subject. Dam and sire with their microchips, colour, height, weight, health-screened status — subject and health_screen via pedigree. Owner blocks — subject_owner. <b>The logbook is a report, not a data-entry form</b>'],
 ['THE ONE THING IT NEEDED','—','JUDGE','<b>the standing advice lines.</b> “Flea Treatment Monthly Forever” and “Wormer monthly until 6 months, thereafter quarterly” are tenant text that prints on every pack — they are care_advice, below']]],

['subject_insurance','FREE COVER — activated, by whom, and proved','risk',[
 ['tenant_id · subject_id','ref','LAW',''],
 ['insurer · policy_number','text','LAW','<b>Lisa 23 Sep.</b> The policy number is the thing the buyer rings up with and the thing you are asked for when it goes wrong'],
 ['cover_level · cover_weeks','text · int','OPS','the free breeder cover is typically 4 or 5 weeks — record which, because it decides when the buyer must take over'],
 ['activated_on · activated_by','date · ref staff','LAW','<b>who pressed the button, and when.</b> Activation is a task a person does before the puppy leaves, and the only way to know it was done is to record the person and the date'],
 ['cover_start · cover_end','date','LAW','<b>NOT the same as activated_on, and this is the part that catches people.</b> You activate on the Tuesday; cover starts at collection on the Saturday. One date cannot carry both, and the gap between them is exactly the window a claim falls into'],
 ['transferred_to_person_id','ref person','OPS','who the cover was put in the name of'],
 ['document_id','ref document','LAW','the certificate or voucher — goes in the handover pack'],
 ['lapsed_on · renewed_as_policy_number','date · text','OPS','<b>whether the buyer continued it.</b> Not your obligation, but it is the single most useful thing to know when a former buyer rings about a sick dog'],
 ['WHY A ROW AND NOT THREE COLUMNS ON subject','—','JUDGE','<b>because a puppy can have more than one policy over its life</b> — your free breeder cover, then the owner’s own, then a renewal. Three columns hold the first and silently lose the rest. It is also the third item on the post-collection checklist alongside microchip transfer and registry transfer, and those two are already rows'],
 ['AND IT IS A BLOCKING CHECK','—','JUDGE','<b>no activated_on means the puppy is not insured.</b> That belongs on the pre-collection checklist as a blocking item with evidence required, not as something anyone hopes was remembered']]]

,
['care_advice','Standing text that prints on the pack','ops',[
 ['tenant_id','ref','OPS',''],
 ['applies_to','text closed set all | puppy | adult | breed | litter','OPS',''],
 ['heading · body','text','OPS','<b>“Wormer is Due Monthly Until 6 Months Old. Thereafter Quarterly.”</b> Straight off your own logbook'],
 ['effective_from · effective_to','date','OPS','<b>THE ARCHIVE RULE, eleventh.</b> Advice changes; a pack issued in 2024 said what it said'],
 ['sort_order','int','OPS','']]],

['retention_rule','HOW LONG EACH RECORD MUST BE KEPT','risk',[
 ['tenant_id · jurisdiction','ref · text','LAW','<b>and it differs by country</b> — which is the whole reason it is a row'],
 ['record_kind','text','LAW','change_of_ownership · daily_check · medicine_register · temperature · contract · staff_training'],
 ['retain_years','decimal','LAW','<b>three years for the change-of-ownership record</b>, in print on your own logbook, from the Animal Welfare (Breeding of Dogs) (Wales) Regulations 2014'],
 ['statutory_source','text','LAW','the regulation and paragraph, so it can be defended rather than asserted'],
 ['effective_from · effective_to','date','LAW','<b>THE ARCHIVE RULE, twelfth.</b> Retention periods change with the law and the old one governed the old records'],
 ['WHY IT IS A TABLE AND NOT A CONSTANT','—','JUDGE','<b>because the app should be able to say “this record is now past its retention date”</b> — which is a query against a row, and impossible against a number someone hard-coded. It is also the only honest way to answer an inspector who asks how long you keep things']]]


];
