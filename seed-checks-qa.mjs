import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase env vars');

const email = 'lovabletester2026@mailinator.com';
const password = 'TesterPass2026!';
const userId = '1ca20bd9-9cf2-445b-b08e-1dedc812646a';
const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

const requireOk = (res, label) => {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
};

const today = new Date();
const isoDate = (offsetDays) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const signIn = await supabase.auth.signInWithPassword({ email, password });
requireOk(signIn, 'sign in');
if (signIn.data.user?.id !== userId) throw new Error(`Signed in as unexpected user ${signIn.data.user?.id}`);

await supabase.from('profiles').update({
  company_name: 'QA Tester Co',
  controller_name: 'QA Tester',
  address: 'Test Yard, QA Lane, Blackpool FY1 1QA',
  showmen_name: 'QA Tester',
  subscription_status: 'trial',
  trial_started_at: new Date(Date.now() - 86400000).toISOString(),
  trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  subscription_plan: 'operator',
  app_mode: 'checks',
}).eq('user_id', userId);

let category = requireOk(await supabase
  .from('ride_categories')
  .select('id,name,category_group')
  .eq('name', 'Inflatable Combo')
  .maybeSingle(), 'load category');
if (!category) {
  category = requireOk(await supabase
    .from('ride_categories')
    .select('id,name,category_group')
    .eq('name', 'Bouncy Castle')
    .maybeSingle(), 'fallback category');
}
if (!category) throw new Error('No suitable ride category found');

let ride = requireOk(await supabase
  .from('rides')
  .select('id,ride_name,ride_code,category_id')
  .eq('user_id', userId)
  .eq('ride_name', 'QA Checks Rig — Inflatable Combo')
  .maybeSingle(), 'load ride');

if (!ride) {
  ride = requireOk(await supabase.from('rides').insert({
    user_id: userId,
    category_id: category.id,
    ride_name: 'QA Checks Rig — Inflatable Combo',
    manufacturer: 'AirSafe QA Manufacturing',
    year_manufactured: 2022,
    serial_number: 'QA-INF-2026-001',
    owner_name: 'QA Tester Co',
    ride_code: 'QAIC',
    requires_operational_checks: true,
    preopening_covers_daily: false,
  }).select('id,ride_name,ride_code,category_id').single(), 'insert ride');
}

async function ensureTemplate(freq, name, startNotice, finishNotice) {
  let template = requireOk(await supabase
    .from('daily_check_templates')
    .select('id,template_name,check_frequency')
    .eq('user_id', userId)
    .eq('ride_id', ride.id)
    .eq('check_frequency', freq)
    .eq('is_archived', false)
    .maybeSingle(), `load ${freq} template`);
  if (!template) {
    template = requireOk(await supabase.from('daily_check_templates').insert({
      user_id: userId,
      ride_id: ride.id,
      template_name: name,
      check_frequency: freq,
      template_type: freq,
      is_active: true,
      is_archived: false,
      start_notice_required: !!startNotice,
      start_notice_text: startNotice,
      finish_notice_required: !!finishNotice,
      finish_notice_text: finishNotice,
      description: `${name} seeded for full browser QA`,
    }).select('id,template_name,check_frequency').single(), `insert ${freq} template`);
  } else {
    requireOk(await supabase.from('daily_check_templates').update({
      template_name: name,
      is_active: true,
      is_archived: false,
      start_notice_required: !!startNotice,
      start_notice_text: startNotice,
      finish_notice_required: !!finishNotice,
      finish_notice_text: finishNotice,
    }).eq('id', template.id).select('id').single(), `update ${freq} template`);
  }
  return template;
}

const startNotice = 'Before opening, confirm the inflatable is fully anchored, blowers are secure, emergency exits are clear, and weather conditions are suitable for operation.';
const finishNotice = 'Before completion confirm covers are secure, tools removed, the operating area is left safe, and any failed items have a linked defect record.';
const dailyTemplate = await ensureTemplate('daily', 'QA Daily Opening Checklist', startNotice, finishNotice);
const yearlyTemplate = await ensureTemplate('yearly', 'QA Annual Thorough Checklist', startNotice, finishNotice);

async function ensureItems(templateId, labels) {
  const existing = requireOk(await supabase.from('daily_check_template_items').select('id,check_item_text').eq('template_id', templateId), 'load items');
  const byText = new Map(existing.map(i => [i.check_item_text, i]));
  const result = [];
  for (let i = 0; i < labels.length; i++) {
    const item = labels[i];
    if (byText.has(item.text)) {
      result.push(byText.get(item.text));
    } else {
      const inserted = requireOk(await supabase.from('daily_check_template_items').insert({
        template_id: templateId,
        check_item_text: item.text,
        category: item.category,
        is_required: true,
        sort_order: i + 1,
      }).select('id,check_item_text').single(), 'insert item');
      result.push(inserted);
    }
  }
  return result;
}

const dailyItems = await ensureItems(dailyTemplate.id, [
  { text: 'Anchorage points checked and secure', category: 'Anchorage' },
  { text: 'Blower and electrical cable route safe', category: 'Electrical' },
  { text: 'Matting and entrance step correctly positioned', category: 'Public Safety' },
  { text: 'Fabric, seams and rain cover inspected', category: 'Structure' },
  { text: 'Operating area clear of trip hazards', category: 'Site' },
]);
await ensureItems(yearlyTemplate.id, [
  { text: 'Annual inspection certificate present and in date', category: 'Documentation' },
  { text: 'Structural stitching and pressure test reviewed', category: 'Inspection' },
  { text: 'Anchorage system condition verified', category: 'Anchorage' },
]);

const existingChecks = requireOk(await supabase
  .from('checks')
  .select('id,check_date,notes')
  .eq('user_id', userId)
  .eq('ride_id', ride.id)
  .eq('template_id', dailyTemplate.id), 'load checks');

async function ensureCheck(marker, date, inspector, status, itemPlan, notes) {
  let check = existingChecks.find(c => c.notes?.includes(marker));
  if (!check) {
    check = requireOk(await supabase.from('checks').insert({
      user_id: userId,
      ride_id: ride.id,
      template_id: dailyTemplate.id,
      inspector_name: inspector,
      check_date: date,
      check_frequency: 'daily',
      status,
      notes: `${marker} ${notes}`,
      location: 'QA Test Yard — Bay 3',
      weather_conditions: 'Dry, 12 mph wind',
      start_notice_acknowledged: true,
      start_notice_acknowledged_at: new Date().toISOString(),
      start_notice_acknowledged_by: userId,
      start_notice_snapshot: startNotice,
      finish_notice_acknowledged: true,
      finish_notice_acknowledged_at: new Date().toISOString(),
      finish_notice_acknowledged_by: inspector,
      finish_notice_snapshot: finishNotice,
      performed_by_user_id: userId,
    }).select('id,check_date,notes').single(), `insert check ${marker}`);
  }
  const existingResults = requireOk(await supabase.from('check_results').select('id,template_item_id').eq('check_id', check.id), 'load results');
  const existingResultItemIds = new Set(existingResults.map(r => r.template_item_id));
  const rows = dailyItems.filter(item => !existingResultItemIds.has(item.id)).map((item, idx) => {
    const plan = itemPlan[item.check_item_text] || { result: 'pass', note: 'Checked and satisfactory' };
    return {
      check_id: check.id,
      template_item_id: item.id,
      is_checked: plan.result === 'pass',
      result: plan.result,
      notes: plan.note,
    };
  });
  if (rows.length) requireOk(await supabase.from('check_results').insert(rows), `insert results ${marker}`);
  return check;
}

const check1 = await ensureCheck('[QA-SEED-CHECK-1]', isoDate(-2), 'QA Tester', 'failed', {
  'Blower and electrical cable route safe': { result: 'fail', note: 'Cable crossing needs rerouting and matting before opening.' },
  'Fabric, seams and rain cover inspected': { result: 'fail', note: 'Small seam tear visible on rear left panel.' },
}, 'Two failed items with linked evidence defects.');

const check2 = await ensureCheck('[QA-SEED-CHECK-2]', isoDate(-1), 'QA Tester', 'passed', {}, 'All items passed after corrective action review.');

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWElEQVR4nO3PsQ0AIBDAMMC/5+ONyRZ5iMS9Pcu8GdwcAAAAAAAAAAD8rvXsgK9zzgQMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDBgwIABAwYMGDDwFgHLHAJ9UlWMYgAAAABJRU5ErkJggg==';
const photoBytes = Uint8Array.from(Buffer.from(pngBase64, 'base64'));
async function ensurePhoto(name) {
  const path = `${userId}/${ride.id}/${name}.png`;
  const upload = await supabase.storage.from('defect-photos').upload(path, photoBytes, { contentType: 'image/png', upsert: true });
  if (upload.error && !upload.error.message.includes('already exists')) throw new Error(`upload ${name}: ${upload.error.message}`);
  return path;
}
const openPhoto = await ensurePhoto('qa-open-defect-evidence');
const reopenedPhoto = await ensurePhoto('qa-reopened-defect-evidence');
const closedPhoto = await ensurePhoto('qa-closed-defect-evidence');

async function ensureDefect(marker, attrs) {
  let defect = requireOk(await supabase
    .from('defects')
    .select('id,description,status,photo_paths,template_item_id')
    .eq('user_id', userId)
    .eq('ride_id', ride.id)
    .ilike('description', `%${marker}%`)
    .maybeSingle(), `load defect ${marker}`);
  const payload = {
    check_id: attrs.check_id,
    ride_id: ride.id,
    user_id: userId,
    description: `${marker} ${attrs.description}`,
    severity: attrs.severity,
    status: attrs.status,
    photo_paths: attrs.photo_paths,
    location_on_ride: attrs.location_on_ride,
    resolved_at: attrs.resolved_at ?? null,
    resolved_by: attrs.resolved_by ?? null,
    resolution_notes: attrs.resolution_notes ?? null,
    template_item_id: attrs.template_item_id,
    reported_by_user_id: userId,
  };
  if (!defect) {
    defect = requireOk(await supabase.from('defects').insert(payload).select('id,description,status,photo_paths,template_item_id').single(), `insert defect ${marker}`);
  } else {
    defect = requireOk(await supabase.from('defects').update(payload).eq('id', defect.id).select('id,description,status,photo_paths,template_item_id').single(), `update defect ${marker}`);
  }
  return defect;
}

const blowerItem = dailyItems.find(i => i.check_item_text === 'Blower and electrical cable route safe');
const fabricItem = dailyItems.find(i => i.check_item_text === 'Fabric, seams and rain cover inspected');
const mattingItem = dailyItems.find(i => i.check_item_text === 'Matting and entrance step correctly positioned');

const openDefect = await ensureDefect('[QA-OPEN-DEFECT]', {
  check_id: check1.id,
  template_item_id: blowerItem.id,
  description: 'Blower cable route crosses public access route. Reroute cable and fit matting before operation.',
  severity: 'urgent',
  status: 'open',
  photo_paths: [openPhoto],
  location_on_ride: 'Front right blower cable run',
});

const reopenedDefect = await ensureDefect('[QA-REOPENED-DEFECT]', {
  check_id: check1.id,
  template_item_id: fabricItem.id,
  description: 'Previously repaired seam tear has reopened on rear left panel. Existing photo evidence must show when reopened from checks.',
  severity: 'stop_operation',
  status: 'open',
  photo_paths: [reopenedPhoto],
  location_on_ride: 'Rear left seam panel',
  resolution_notes: 'Closed after temporary patch; reopened during QA seed because the seam lifted again.',
});

const closedDefect = await ensureDefect('[QA-CLOSED-DEFECT]', {
  check_id: check2.id,
  template_item_id: mattingItem.id,
  description: 'Entrance mat edge lifted during setup. Matting repositioned and taped down.',
  severity: 'non_urgent',
  status: 'resolved',
  photo_paths: [closedPhoto],
  location_on_ride: 'Entrance step matting',
  resolved_at: new Date().toISOString(),
  resolved_by: 'QA Tester',
  resolution_notes: 'Matting secured and area rechecked safe.',
});

console.log(JSON.stringify({
  userId,
  email,
  password,
  ride,
  category,
  templates: { dailyTemplate, yearlyTemplate },
  dailyItemIds: dailyItems,
  checks: [check1, check2],
  defects: { openDefect, reopenedDefect, closedDefect },
  photos: [openPhoto, reopenedPhoto, closedPhoto],
  routes: {
    checksLanding: '/checks',
    checkRecords: `/checks/register?rideId=${ride.id}`,
    execution: `/checks/${ride.id}/daily/execute`,
    equipmentChecksTab: `/rides/${ride.id}?tab=checks`,
    defects: '/defects',
  }
}, null, 2));
