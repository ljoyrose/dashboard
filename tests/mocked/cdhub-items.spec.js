// Items page (ITEMS, 14 Nov 2026): list, card, status, filters, CSV. Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const addTable = (world, name, content) => world.file('bld-items-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';

test.describe('CD Hub: items', () => {
  test('items list by kind, best to worst; the card shows room, tests and readings', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-item_kinds.csv', csv('id,tenant_id,kind_key,label,source,set_by,set_on', ['k1,t,pretend_plug,Pretend plug,x,o,2026-01-01', 'k2,t,pretend_ext,Pretend extinguisher,x,o,2026-01-01']));
    addTable(guard.world, 'BLD-items.csv', csv('id,tenant_id,item_no,name,kind_key,make,model,serial_no,size,made_on,expires_on,photo,note,corrects_id,created_at,created_by',
      ['i1,t,P-01,Pretend kettle,pretend_plug,,,,,,,,,,2026-01-01T00:00:00Z,o', 'i2,t,E-01,Pretend CO2,pretend_ext,,,,2 kg,2020-01-01,2099-01-01,,,,2026-01-01T00:00:00Z,o']));
    addTable(guard.world, 'BLD-check_type.csv', csv('id,tenant_id,type_key,label,target,active,effective_from,every_days,item_kind',
      ['c1,t,pretend_pat,Pretend PAT,item,true,2020-01-01,365,pretend_plug', 'c2,t,pretend_svc,Pretend service,item,true,2020-01-01,3650,pretend_ext']));
    addTable(guard.world, 'BLD-check_log.csv', csv('id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded,litter_id,note_for_id,item_id',
      ['l1,t,c1,,,,,ok,2020-05-28T12:00:00Z,,,o,,,typed,,,i1', 'l2,t,c2,,,,,ok,2024-05-28T12:00:00Z,,,o,,,typed,,,i2']));
    addTable(guard.world, 'BLD-check_field.csv', csv('id,tenant_id,type_key,field_key,label,kind,choices,required,sort,active,effective_from,set_at,set_by',
      ['f1,t,pretend_pat,look,Pretend look,choice,Pass|Fail,false,1,true,2020-01-01,,']));
    addTable(guard.world, 'BLD-check_value.csv', csv('id,tenant_id,check_log_id,check_field_id,field_key,value', ['v1,t,l1,f1,look,Pass']));
    addTable(guard.world, 'BLD-reading_kinds.csv', csv('id,tenant_id,kind_key,label,unit_id,value_shape,precision_dp,source,set_by,set_on', ['r1,t,pretend_earth,Pretend earth,Ω,single,2,x,o,2026-01-01']));
    addTable(guard.world, 'BLD-reading_limits.csv', csv('id,tenant_id,kind_id,scope_table,scope_id,low,high,label,from_date,to_date,source,set_by,set_on', ['m1,t,r1,,,,0.1,,2020-01-01,,x,o,2026-01-01']));
    addTable(guard.world, 'BLD-readings.csv', csv('id,tenant_id,kind_id,area_id,item_id,subject_id,check_log_id,value_min,value_max,value,unit_id,taken_at,in_range', ['g1,t,r1,,i1,,l1,,,0.2,Ω,2020-05-28T12:00:00Z,']));
    addTable(guard.world, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,link_kind_key,sort,note,from_date,to_date,source,set_by,set_on,created_at,updated_at', ['n1,t,reading_kinds,r1,check_types,pretend_pat,reading_for_job,,,2020-01-01,,x,o,2026-01-01,,']));
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => { location.hash = '#/items'; });
    const rowsIn = page.locator('#itmPage .itm-row');
    await expect(rowsIn).toHaveCount(2);
    await expect(rowsIn.nth(0)).toContainText('Pretend CO2');        // in date first
    await expect(rowsIn.nth(1)).toContainText('Overdue');           // tested 2020, every 365 days
    await page.locator('[data-itm-filter="due"]').click();
    await expect(page.locator('#itmPage .itm-row')).toHaveCount(1);
    await page.locator('#itmPage .itm-row').first().click();
    await expect(page.locator('#itmCard')).toContainText('Pretend PAT');
    await expect(page.locator('#itmCard')).toContainText('outside');  // 0.2 Ω above the 0.1 limit
    await expect(page.locator('#itmCard [data-itm-form="archive"]')).toBeVisible();
    await page.locator('#itmCard [data-itm-form="test:pretend_pat"]').click();
    await page.locator('[name="r_r1"]').fill('0.09');
    await expect(page.locator('.itm-lim.ok')).toHaveText('inside limit');
  });
});
