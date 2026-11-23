// Invented sample of the tools tab with the Tech columns added (TECH-HUB-1). Fake names only (Example Tool A...), fake ids only
// (EXAMPLE-ID-n), example.com logos (answered by the test harness). The real list lives in Lisa's private Drive sheet.
// The first five columns are Studio's own (the tab is extended, not copied): the tile's name comes from "tool".
// Dates are worked out from "now" so the fresh / stale and renews-in-N-days checks never go out of date.
const DAY = 864e5;
function iso(now, off) { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + off * DAY).toISOString().slice(0, 10); }

const HEADER = ['tool', 'licence_tier_and_codes', 'agency_white_label', 'used_for', 'verdict',
  'tool_key', 'group', 'sort_order', 'plan_or_tier', 'allowance_amount', 'allowance_unit', 'used_period', 'unused_period', 'period',
  'renewal_or_expiry', 'flag_unused_month', 'status', 'verified', 'source_name', 'last_updated', 'review_file_id', 'review_file_name',
  'review_count', 'ai_share_used_week', 'ai_unused_premium_images', 'ai_higher_spec_runs', 'ai_outputs_in_drive',
  'ai_outputs_waiting_review', 'ai_right_first_time', 'logo_url'];

// One row from a short object; every other column blank.
function row(o) { return HEADER.map((h) => (o[h] == null ? '' : String(o[h]))); }

function values(now = Date.now(), extra = []) {
  const d = (off) => iso(now, off);
  return [HEADER,
    row({ tool: 'Example Tool A', tool_key: 'example-a', group: 'AI', sort_order: 2, plan_or_tier: 'Tier 2', allowance_amount: '100', allowance_unit: 'credits', used_period: '0', period: 'month',
      renewal_or_expiry: d(18), status: 'live', verified: 'VERIFIED', source_name: 'example source', last_updated: d(-2), review_file_id: 'EXAMPLE-ID-1', review_file_name: 'Example review A',
      review_count: '1', ai_share_used_week: '40', ai_outputs_in_drive: '12', ai_outputs_waiting_review: '3', ai_right_first_time: '5', logo_url: 'https://example.com/logo-a.png' }),
    row({ tool: 'Example Tool B', tool_key: 'example-b', group: 'AI', sort_order: 1, plan_or_tier: 'Tier 1', period: 'lifetime', renewal_or_expiry: 'lifetime', status: 'live',
      verified: 'UNVERIFIED', last_updated: d(-4), review_count: '0' }),
    row({ tool: 'Example Tool C', tool_key: 'example-c', group: 'Design and assets', plan_or_tier: 'Monthly plan', allowance_amount: '500', allowance_unit: 'tasks', used_period: '120',
      period: 'month', renewal_or_expiry: d(40), status: 'trial', verified: 'VERIFIED', last_updated: d(-1), review_file_id: 'EXAMPLE-ID-2', review_count: '2' }),
    row({ tool: 'Example Tool D', tool_key: 'example-d', group: 'Comms', plan_or_tier: 'Starter', allowance_amount: '2,000', allowance_unit: 'messages', used_period: '1500', period: 'month',
      renewal_or_expiry: d(9), status: 'live', verified: 'VERIFIED', last_updated: d(-60), review_file_id: 'EXAMPLE-ID-3', review_count: '1' }),
    row({ tool: 'Example Tool E', tool_key: 'example-e', group: 'Dev and hosting', plan_or_tier: 'Hobby', period: 'week', status: 'live', verified: 'UNVERIFIED', last_updated: d(-3),
      review_file_id: 'EXAMPLE-ID-6', review_count: '1', ai_outputs_in_drive: 'see EXAMPLE-ID-9' }),
    row({ tool: 'Example Tool F', tool_key: 'example-f', group: 'Money and admin', plan_or_tier: 'Lifetime deal', period: 'lifetime', renewal_or_expiry: 'lifetime', status: 'live',
      verified: 'VERIFIED', last_updated: d(-5), review_file_id: 'EXAMPLE-ID-4', review_count: '1' }),
    row({ tool: 'Example Tool G', tool_key: 'example-g', group: 'Data and automation', plan_or_tier: 'Pro', allowance_amount: '50', allowance_unit: 'runs', used_period: '50', period: 'month',
      renewal_or_expiry: d(-10), status: 'live', verified: 'VERIFIED', last_updated: d(-2), review_file_id: 'EXAMPLE-ID-5', review_count: '1' }),
    row({ tool: 'Example Tool H', tool_key: 'example-h', group: 'Example group', plan_or_tier: 'Basic', period: 'month', status: 'live', verified: 'VERIFIED', last_updated: d(-2),
      review_file_id: 'EXAMPLE-ID-7', review_count: '1' }),
    row({ tool: 'Example Tool I', tool_key: 'example-i', group: 'Comms', plan_or_tier: 'Half row', period: 'month', verified: 'VERIFIED', last_updated: d(-2) }), // no status: tile fails closed
    row({ tool: 'Example Tool J', tool_key: 'example-j', group: 'AI', plan_or_tier: 'Old plan', period: 'month', status: 'expired', verified: 'VERIFIED', last_updated: d(-2) }), // ended: no tile
    row({ tool: 'Example Tool K', tool_key: 'example-k', group: 'AI', period: 'month', status: 'live', verified: 'VERIFIED', last_updated: d(-2) }), // no plan: not a paid tool, no tile
    row({ tool: '', tool_key: 'example-blank', group: 'AI', status: 'live' }) // no name: skipped
  ].concat(extra.map(row));
}

module.exports = { HEADER, row, values, iso };
