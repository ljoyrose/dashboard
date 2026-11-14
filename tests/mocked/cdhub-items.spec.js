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
    addTable(guard.world, 'BLD-check_field.csv', csv('id,tenant_id,type_key,field_key,label,kind,choices,required,sort,active,effective_from,set_at,set_by,unit,limit_low,limit_high,source',
      ['f1,t,pretend_pat,earth,Pretend earth,number,,false,1,true,2020-01-01,,,Ω,,0.1,x']));
    addTable(guard.world, 'BLD-check_value.csv', csv('id,tenant_id,check_log_id,check_field_id,field_key,value', ['v1,t,l1,f1,earth,0.2']));
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
    await page.locator('[name="v_earth"]').fill('0.09');
    await expect(page.locator('.itm-lim.ok')).toHaveText('inside limit');
  });
});
