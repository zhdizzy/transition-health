// Transition Health Coverage Bridge — UI wiring. Engine stays pure; this renders.
import { solve, fmtDate, iso, parseDate, addDays, daysBetween, todayUTC, HORIZON_DAYS } from './data/engine.js';
import { PROGRAMS, TAMP_CATEGORIES, WINDOWS, DATA_STAMP, OFFICIAL_LINKS } from './data/rules.js';

const $ = id => document.getElementById(id);
const fmtUSD = n => (n === Infinity ? '∞' : '$' + Math.round(n).toLocaleString('en-US'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SHORT = { tricare: 'TRICARE', tamp: 'TAMP', chcbp: 'CHCBP', va: 'VA', champva: 'CHAMPVA', marketplace: 'Marketplace', employer: 'Employer', spouse: "Spouse's plan", fehb: 'FEHB', ship: 'Student plan', medicaid: 'Medicaid', trs: 'TRS', trr: 'TRR', retireeSelect: 'TRICARE Select', retireePrime: 'TRICARE Prime', uninsured: 'NO COVERAGE' };

const state = { mode: 'voluntary', revealed: false, last: null, activePath: null, viewer: 'member' };
// Voice: who is at the keyboard. The engine is identical; only the pronouns, a few labels, and one extra card change.
// Third-person rewrite of engine strings for spouse view ("your $60,000" → "their $60,000").
const voice = s => state.viewer === 'spouse' ? String(s).replace(/\byou\'re\b/g, 'they\'re').replace(/\bYou\'re\b/g, 'They\'re').replace(/\byourself\b/g, 'themselves').replace(/\byours\b/g, 'theirs').replace(/\byour\b/g, 'their').replace(/\bYour\b/g, 'Their').replace(/\byou\b/g, 'they').replace(/\bYou\b/g, 'They') : String(s);
const V = () => state.viewer === 'spouse'
  ? { You: 'Your veteran', you: 'your veteran', vetChip: 'Your veteran', famRow: (sp, kids) => sp && kids ? 'You + kids' : sp ? 'You' : 'Kids' }
  : { You: 'You', you: 'you', vetChip: 'You, the veteran', famRow: (sp, kids) => sp && kids ? 'Spouse + kids' : sp ? 'Spouse' : 'Kids' };

/* ─── Elements ─────────────────────────────────────────────────────────── */
const sepEl = $('sep-date'), spouseEl = $('spouse'), childrenEl = $('children'), combatEl = $('combat'), ratingEl = $('rating');
const nextEl = $('next'), jobStartEl = $('job-start'), spousePlanEl = $('spouse-plan'), selresEl = $('selres'), grayEl = $('gray-area');
const tampTypeEl = $('tamp-type'), retireeGroupEl = $('retiree-group'), pregnantEl = $('pregnant'), treatmentEl = $('treatment');
const usageEl = $('usage'), dentalEl = $('dental'), incomeEl = $('income'), marketPremEl = $('market-premium');
const spousePremEl = $('spouse-plan-premium'), employerPremEl = $('employer-premium'), waitEl = $('wait-days'), shipPremEl = $('ship-premium');
const stateEl = $('state'), vetAgeEl = $('vet-age'), spouseAgeEl = $('spouse-age');
const STATES = [['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']];
stateEl.innerHTML = '<option value="">Choose a state</option>' + STATES.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');

/* ─── Mode pills (reshape the tool) ────────────────────────────────────── */
const MODE_BRIEF = {
  voluntary: 'The most common exit and the worst-explained one. Voluntary separations don\'t get TAMP (the 180-day Transitional Assistance Management Program), so your family\'s TRICARE ends on your last day. We\'ll find the cheapest plan that starts the next morning and every deadline that makes it possible.',
  involuntary: 'Involuntary separations get TAMP, and medical separations with severance usually do (confirm it shows in milConnect): 180 days of premium-free TRICARE for the whole family. Every clock in this plan runs from the day TAMP ends, not the day you separate. We\'ll also line up the VA side, since a rating is probably pending.',
  retiring: 'No gap if you enroll: retiree TRICARE has a 90-day enrollment window. What changes is the cost (enrollment fees, cost shares), dental (TRICARE Dental ends; FEDVIP, the federal dental and vision program, must be elected before your date to avoid a gap), and how VA care and an employer plan stack on top.',
  reserve: 'Coming off contingency orders longer than 30 days gets you 180 days of TAMP, then back to TRICARE Reserve Select if you keep drilling. Leaving the Selected Reserve entirely ends TRS with no TAMP. Tell us which, and we\'ll build the bridge.',
  out: 'Already separated and the coverage never got sorted. Enter your separation date and we\'ll show which windows are still open (some are longer than you think), which have closed, and the fastest route to coverage this month.',
};
const SEP_LABEL = { voluntary: 'Separation date', involuntary: 'Separation date', retiring: 'Retirement date', reserve: 'Release from active duty (REFRAD) date', out: 'Date you separated' };
const SEP_HINT = { voluntary: 'Your last day in uniform. TRICARE ends at 11:59 p.m. on your last duty day.', involuntary: 'Your last day. TAMP runs 180 days from the separation date; the plan shows the exact end date.', retiring: 'Your retirement date. Retiree TRICARE starts the next day if you enroll.', reserve: 'The day your orders end. TAMP runs 180 days from here if the orders qualify.', out: 'The date on your DD-214. We count the windows from here.' };
const TAMP_OPTS = { voluntary: ['voluntary', 'vsi', 'selres', 'stoploss', 'solesurvivor'], involuntary: ['involuntary', 'medsep', 'vsi', 'stoploss', 'solesurvivor'], out: ['voluntary', 'involuntary', 'medsep', 'vsi', 'contingency', 'title32', 'reserveNone', 'stoploss', 'solesurvivor', 'selres'], reserve: ['contingency', 'title32', 'reserveNone'], retiring: ['retiree'] };

function fillTampTypes(m) {
  const keep = tampTypeEl.value;
  tampTypeEl.innerHTML = TAMP_OPTS[m].map(k => `<option value="${k}">${esc(TAMP_CATEGORIES[k].label)}</option>`).join('');
  if (TAMP_OPTS[m].includes(keep)) tampTypeEl.value = keep;
  syncTampHint();
}
function syncTampHint() {
  const c = TAMP_CATEGORIES[tampTypeEl.value];
  if (!c) return;
  $('tamp-hint').innerHTML = c.eligible ? `<strong>TAMP: yes.</strong> 180 days of premium-free TRICARE after this date.${c.note ? ' ' + esc(c.note) : ''}` : `<strong style="color:var(--accent)">TAMP: no.</strong> Coverage ends on the separation date.`;
}
function setMode(m, opts = {}) {
  state.mode = m;
  document.querySelectorAll('.mode-pill').forEach(p => { p.classList.toggle('active', p.dataset.mode === m); p.setAttribute('aria-pressed', p.dataset.mode === m ? 'true' : 'false'); });
  $('mode-briefing').textContent = MODE_BRIEF[m];
  $('sep-date-label').innerHTML = `${SEP_LABEL[m]} <span class="req-tag">required</span>`;
  $('sep-hint').textContent = SEP_HINT[m];
  if (typeof syncDateHint === 'function') syncDateHint();
  $('reserve-fields').hidden = m !== 'reserve';
  $('field-tamp-type').hidden = m === 'retiring';
  $('field-retiree-group').hidden = m !== 'retiring';
  fillTampTypes(m);
  $('compare-btn').textContent = m === 'retiring' ? 'Show My Retiree Coverage Plan →' : m === 'out' ? 'Show Me What\'s Still Open →' : 'Build My Coverage Plan →';
  syncConditionalFields();
  if (state.revealed) reveal({ silent: true });
  updateLiveStrip();
}
document.querySelectorAll('.mode-pill').forEach(p => p.addEventListener('click', () => {
  setMode(p.dataset.mode);
  if (isTourActive() && tourState.steps[tourState.i]?.id === 'pills') showTourStep(tourState.i + 1);
}));

/* ─── Viewer toggle (service member vs. spouse view) ───────────────────── */
const VIEWER_LABELS = {
  member: { 'card-you-title': 'You and your household', 'spouse-label': 'Married?', 'combat-label': 'Combat deployment or toxic exposure? <span class="optional-tag">(drives VA enrollment)</span>', 'rating-label': 'VA disability rating status', 'spouse-plan-label': 'Does your spouse have an employer plan you could join?', 'spouse-plan-hint': 'Usually the cheapest family path, and it has the shortest window: 30 days.' },
  spouse: { 'card-you-title': 'Your veteran and your household', 'spouse-label': 'Married to them? <span class="optional-tag">(that\'s you)</span>', 'combat-label': 'Did they deploy to a combat zone or have toxic exposure? <span class="optional-tag">(drives their VA enrollment)</span>', 'rating-label': 'Their VA disability rating status', 'spouse-plan-label': 'Do YOU have an employer plan the family could join?', 'spouse-plan-hint': 'Usually the cheapest family path, and the one only you can set up. The window is 30 days.' },
};
function setViewer(v) {
  state.viewer = v === 'spouse' ? 'spouse' : 'member';
  const t = $('viewer-toggle');
  t.setAttribute('aria-pressed', state.viewer === 'spouse' ? 'true' : 'false');
  t.textContent = state.viewer === 'spouse' ? 'Spouse view on · switch back to the service member view' : 'I\'m the spouse or family member doing this for them';
  for (const [id, html] of Object.entries(VIEWER_LABELS[state.viewer])) $(id).innerHTML = html;
  document.querySelector('#hero-capture .hc-line').innerHTML = state.viewer === 'spouse' ? 'That\'s the bridge. <strong>Email yourself this coverage plan</strong>: the timeline, every deadline with its date, the forms, and one link that rebuilds it for your veteran.' : 'That\'s your bridge. <strong>Email yourself this coverage plan</strong>: the timeline, every deadline with its date, the forms, and one link that rebuilds it for your spouse.';
  if (state.viewer === 'spouse' && spouseEl.value !== 'yes') spouseEl.value = 'yes';
  syncConditionalFields();
  if (state.revealed) reveal({ silent: true });
  updateLiveStrip();
}
$('viewer-toggle').addEventListener('click', () => setViewer(state.viewer === 'spouse' ? 'member' : 'spouse'));

/* ─── Conditional fields ───────────────────────────────────────────────── */
function syncConditionalFields() {
  const nx = nextEl.value;
  $('field-job-start').hidden = !(nx === 'job' || nx === 'gs' || nx === 'school');
  $('job-start-label').innerHTML = nx === 'school' ? 'First term start date <span class="optional-tag">(estimate is fine)</span>' : 'Job start date <span class="optional-tag">(estimate is fine)</span>';
  $('job-hint').textContent = nx === 'gs' ? 'FEHB starts the first pay period after you elect it (60 days to elect). No 90-day wait.' : nx === 'school' ? 'Most four-year universities offer a student health plan that starts with the term (community colleges usually don\'t). The months before the term still need a bridge.' : 'Employer plans can make you wait up to 90 days. Set the waiting period in the drawer.';
  $('field-ship-premium').hidden = nx !== 'school';
  $('field-spouse-plan').hidden = spouseEl.value !== 'yes';
  $('field-spouse-age').hidden = spouseEl.value !== 'yes';
  $('field-wait-days').hidden = nx !== 'job';
  const rl = $('rating-line');
  const r = ratingEl.value;
  if (r === 'pt') { rl.hidden = false; rl.innerHTML = '<strong>100% P&amp;T unlocks CHAMPVA</strong> for your spouse and children: $0 premium, $3,000 family cap. That usually beats every other family path.'; }
  else if (r === 'none' || r === 'pending') { rl.hidden = false; rl.innerHTML = 'No rating yet: VA enrollment depends on combat/exposure service or the income test. <strong>A compensable rating (10% or higher) fixes that.</strong>'; }
  else if (r === '100') { rl.hidden = false; rl.innerHTML = '<strong>100% schedular, not P&amp;T: CHAMPVA stays off.</strong> If your conditions are unlikely to improve, ask the VA for Permanent &amp; Total status; that is what turns on $0 family coverage.'; }
  else if (parseInt(r, 10) >= 50) { rl.hidden = false; rl.innerHTML = '<strong>50%+: no VA copays for care or medications.</strong> The family still needs its own plan until 100% P&amp;T.'; }
  else if (r === '0') { rl.hidden = false; rl.innerHTML = '<strong>0% noncompensable does not guarantee VA enrollment.</strong> It is income-tested like no rating; a 10% rating on any condition removes the test.'; }
  else if (parseInt(r, 10) >= 10) { rl.hidden = false; rl.innerHTML = '<strong>10%+: no VA copays for inpatient or outpatient care</strong> (medication copays still apply for non-service-connected prescriptions). The family needs its own plan.'; }
  else rl.hidden = true;
}
[nextEl, ratingEl, spouseEl].forEach(el => el.addEventListener('change', syncConditionalFields));
tampTypeEl.addEventListener('change', syncTampHint);

/* ─── Inputs → engine ──────────────────────────────────────────────────── */
function buildInput() {
  const val = el => el.value.trim() === '' ? null : el.value;
  return {
    mode: state.mode, sepDate: sepEl.value || null,
    spouse: spouseEl.value === 'yes', children: parseInt(childrenEl.value, 10) || 0,
    combat: combatEl.value, rating: ratingEl.value,
    next: nextEl.value, jobStart: (nextEl.value === 'job' || nextEl.value === 'gs' || nextEl.value === 'school') ? (jobStartEl.value || null) : null,
    shipMonthly: val(shipPremEl),
    waitDays: val(waitEl) ?? 30,
    spousePlan: spousePlanEl.value === 'yes' && spouseEl.value === 'yes', spousePlanMonthly: val(spousePremEl),
    employerMonthly: val(employerPremEl), marketMonthly: val(marketPremEl),
    pregnant: pregnantEl.value === 'yes', treatment: treatmentEl.value === 'yes', dental: dentalEl.value === 'yes',
    income: val(incomeEl) ?? 0,
    selres: state.mode === 'reserve' ? selresEl.value === 'yes' : false, grayArea: state.mode === 'reserve' && grayEl.value === 'yes',
    tampType: $('field-tamp-type').hidden ? null : tampTypeEl.value,
    usage: usageEl.value, retireeGroup: retireeGroupEl.value,
    state: stateEl.value || null, vetAge: val(vetAgeEl), spouseAge: val(spouseAgeEl),
  };
}
const run = () => solve(buildInput());

/* ─── Live strip ───────────────────────────────────────────────────────── */
let liveTimer = null;
function updateLiveStrip() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    const el = $('live-strip');
    if (!sepEl.value) { el.innerHTML = '<strong>Required to run:</strong> your separation date. Your coverage runway builds here as you type.'; return; }
    // (sep-date entered)
    const r = run();
    const hh = r.hh;
    let runway;
    if (r.runwayDays === Infinity) runway = `<span class="runway ok">No gap</span>: retiree TRICARE continues`;
    else if (r.runwayDays > 0) runway = `Covered for <span class="runway ok">${r.runwayDays} days</span> past ${fmtDate(r.p.sep)} (TAMP), until <strong>${fmtDate(r.dates.tampEnd)}</strong>`;
    else if (r.p.mode === 'out') runway = `Out <span class="runway zero">${r.dates.daysSinceSep} days</span>; TRICARE ended ${fmtDate(r.p.sep)}`;
    else runway = `Covered for <span class="runway zero">0 days</span> past ${fmtDate(r.p.sep)}${hh.hasFamilyRow ? '. Your family needs a plan that starts the next morning' : ''}`;
    const best = r.best ? ` · ${r.gaplessExists ? 'cheapest no-gap path so far' : 'fastest path from here'}: <strong>${esc(r.best.label)}</strong>, ${r.best.cost12 === 0 ? 'no premiums' : `about <strong>${fmtUSD(r.best.cost12)}</strong> for the first 12 months`}${r.gaplessExists ? '' : ` (${r.best.gapDays} uninsured days)`}` : '';
    el.innerHTML = runway + best + '. Press the button for the full plan.';
  }, 150);
}
document.querySelectorAll('#calc-form input, #calc-form select').forEach(el => { el.addEventListener('input', updateLiveStrip); el.addEventListener('change', updateLiveStrip); });

/* ─── Validation (novalidate + JS, house rule) ─────────────────────────── */
function clearMissing() { document.querySelectorAll('.field-missing, .field-error').forEach(el => el.classList.remove('field-missing', 'field-error')); }
function validate() {
  clearMissing();
  if (!sepEl.value || parseDate(sepEl.value) == null) {
    sepEl.closest('.fg-field').classList.add('field-missing'); sepEl.classList.add('field-error'); $('card-you').classList.add('field-missing');
    return { message: 'Required: your separation date (the red field). Everything else is optional.', focusEl: sepEl };
  }
  return { message: '', focusEl: null };
}
sepEl.addEventListener('input', () => { if (sepEl.value) { clearMissing(); $('form-error').textContent = ''; } syncDateHint(); });
function syncDateHint() {
  const d = parseDate(sepEl.value);
  const past = d != null && d < todayUTC() && state.mode !== 'out' && state.mode !== 'retiring';
  $('sep-hint').innerHTML = past ? `<strong style="color:var(--accent)">That date is in the past.</strong> This mode plans forward from your last duty day. If you\'re already out, pick <strong>Already out and uninsured</strong> above; your other answers carry over.` : esc(SEP_HINT[state.mode]);
}

/* ─── Submit gate ──────────────────────────────────────────────────────── */
$('calc-form').addEventListener('submit', e => { e.preventDefault(); reveal(); });
function reveal(opts = {}) {
  const v = validate();
  $('form-error').textContent = v.message;
  if (v.message) { if (!isTourActive()) v.focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); v.focusEl.focus({ preventScroll: true }); return; }
  const r = run();
  state.last = r;
  if (!state.activePath || !r.paths.some(x => x.id === state.activePath)) state.activePath = r.best ? r.best.id : r.paths[0]?.id;
  renderHero(r);
  renderResults(r);
  state.revealed = true;
  $('hero-verdict').style.display = 'block';
  $('hero-capture').style.display = 'block';
  $('results-container').style.display = 'block';
  $('action-bar').style.display = 'flex';
  if (opts.silent) return;
  if (typeof gtag === 'function') gtag('event', 'show_results', { mode: state.mode, best: r.best ? r.best.id : 'none', tamp: r.tamp.eligible });
  if (isTourActive() && tourState.steps[tourState.i]?.id === 'gate') endTour();
  if (!isTourActive()) $('hero-verdict').scrollIntoView({ behavior: 'smooth', block: 'start' });
  let resultsSeen = true;
  try { resultsSeen = localStorage.getItem(RESULTS_TOUR_KEY) === '1'; } catch {}
  if (!resultsSeen && !window.__thbArrivalHadParams) setTimeout(() => startTourWith(RESULTS_TOUR, RESULTS_TOUR_KEY), 800);
}
$('retake-btn').addEventListener('click', () => {
  state.revealed = false;
  ['hero-verdict', 'hero-capture', 'results-container'].forEach(id => $(id).style.display = 'none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ─── Hero ─────────────────────────────────────────────────────────────── */
function firstMove(r) {
  const soon = r.actions.filter(a => a.urgency === 'high' && daysBetween(r.p.today, a.date) >= -7);
  const a = soon[0] || r.actions.find(a => a.urgency === 'high') || r.actions[0];
  return a;
}
// "Employer plan starts Aug 31 (30-day wait) · " for the do-nothing tile, so two paths with the same start date explain themselves.
function anchorLine(r, wait) {
  const row = wait.segments.family || wait.segments.veteran;
  const a = row.find(s => !['uninsured', 'tricare', 'tamp'].includes(s.program));
  if (!a) return '';
  const startMs = addDays(r.origin, a.start);
  if (r.p.jobStart && startMs <= r.p.today && a.start === 0) return `${esc(SHORT[a.program])} plan already in effect (since ${fmtDate(addDays(r.p.jobStart, a.program === 'employer' ? r.p.waitDays : a.program === 'fehb' ? 14 : 0))}) · `;
  const why = a.program === 'employer' ? (r.p.waitDays === 0 ? ' (no waiting period)' : ` (${r.p.waitDays}-day waiting period)`) : a.program === 'fehb' ? ' (first pay period after you elect)' : a.program === 'ship' ? ' (term start)' : '';
  return `${esc(SHORT[a.program])} starts ${fmtDate(startMs)}${why} · `;
}
function renderHero(r) {
  const el = $('hero-verdict');
  const hh = r.hh, best = r.best, wait = r.paths.find(x => x.id === 'wait');
  const who = hh.hasFamilyRow ? 'your household\'s' : 'your';
  let kicker, line;
  if (r.p.mode === 'retiring') {
    kicker = 'No gap. Here\'s what changes.';
    line = `Retiree TRICARE picks up on <strong>${fmtDate(addDays(r.p.sep, 1))}</strong> if you enroll. The cheapest full year for ${hh.hasFamilyRow ? 'the family' : 'you'} is <strong>${esc(best.label)}</strong> at about <strong>${fmtUSD(best.cost12)}</strong> all-in. Dental is the real change: the TRICARE Dental Program ends at retirement, and FEDVIP has to be elected before your date (the window opens 31 days out) because it can\'t be backdated.`;
  } else if (r.p.mode === 'out') {
    const open = r.clocks.filter(c => c.status !== 'missed' && !c.courtesy && !c.soft);
    const missed = r.clocks.filter(c => c.status === 'missed' && !c.courtesy);
    kicker = `${r.dates.daysSinceSep} days out. Here\'s what\'s still open.`;
    const startsIn = best.gapDays > 0 && best.id !== 'wait' ? ` It can\'t start until <strong>${fmtDate(addDays(r.origin, best.gapDays))}</strong>, so that\'s ${best.gapDays} more uninsured days.` : '';
    const alreadyCovered = best.id === 'wait' && best.gapDays === 0;
    const openNames = open.slice(0, 3).map(c => c.label.replace(/\s*\(.*$/, '')).join(', ');
    line = `<strong>${missed.length} window${missed.length === 1 ? '' : 's'} closed, ${open.length} still open${open.length ? ` (${esc(openNames)})` : ''}.</strong> ${alreadyCovered ? `If you enrolled in the <strong>${esc(SHORT[best.primary])}</strong> plan when it started, ${hh.hasFamilyRow ? 'the family is' : 'you are'} covered; the checklist below is what\'s left (VA enrollment, mostly).` : `The fastest route to coverage for ${hh.hasFamilyRow ? 'the family' : 'you'} is <strong>${esc(best.label)}</strong>${best.id === 'wait' ? ', which is no coverage at all: the paths below show what is still possible' : ''}.${startsIn}`}`;
  } else {
    kicker = r.tamp.eligible ? `${who[0].toUpperCase() + who.slice(1)} TRICARE runs 180 more days` : `${who[0].toUpperCase() + who.slice(1)} TRICARE ends ${fmtDate(r.p.sep)}`;
    const verdict = r.gaplessExists
      ? `The cheapest path with no uninsured day is <strong>${esc(best.label)}</strong>${best.cost12 === 0 ? ': <strong>no premiums, no cost share</strong>' : ` at about <strong>${fmtUSD(best.cost12)}</strong> for the first 12 months`}.`
      : `No path closes every gap from here. The cheapest is <strong>${esc(best.label)}</strong> at about <strong>${fmtUSD(best.cost12)}</strong> for the first 12 months, with <strong>${best.gapDays} uninsured days</strong>.`;
    line = r.tamp.eligible
      ? `TAMP covers everyone through <strong>${fmtDate(r.dates.tampEnd)}</strong>. After that: ${verdict}`
      : `No TAMP for this separation type, so ${hh.hasFamilyRow ? 'the family' : 'you'} need${hh.hasFamilyRow ? 's' : ''} a plan that starts <strong>${fmtDate(addDays(r.p.sep, 1))}</strong>. ${verdict}`;
  }
  const fm = firstMove(r);
  const cards = `<div class="three-num">
    ${r.p.mode === 'out' ? `<div class="num-card"><span class="nc-label">Since separation</span><span class="nc-amount">${r.dates.daysSinceSep} days</span><span class="nc-sub">TRICARE ended ${fmtDate(r.p.sep)}${r.tamp.eligible ? `; TAMP ended ${fmtDate(r.dates.tampEnd)}` : ''}</span></div>` : `<div class="num-card"><span class="nc-label">Coverage runway</span><span class="nc-amount">${r.runwayDays === Infinity ? 'No gap' : r.runwayDays + ' days'}</span><span class="nc-sub">${r.runwayDays === Infinity ? 'retiree TRICARE continues' : r.runwayDays > 0 ? `TAMP through ${fmtDate(r.dates.tampEnd)}` : `ends ${fmtDate(r.p.sep)} · ${esc(r.tamp.label)}`}</span></div>`}
    <div class="num-card comfortable"><span class="nc-label">Best path, 12-month cost</span><span class="nc-amount">${fmtUSD(best.cost12)}</span><span class="nc-sub">${esc(best.label)} · ${fmtUSD(best.premiums12)} premiums + ${fmtUSD(best.oop12)} est. cost share</span></div>
    ${wait ? `<div class="num-card ${wait.gapDays === 0 ? 'gap-zero' : 'gap-bad'}"><span class="nc-label">If you do nothing</span><span class="nc-amount">${wait.gapDays} uninsured days</span><span class="nc-sub">${anchorLine(r, wait)}${wait.gapDays > 0 ? `about ${fmtUSD(wait.cost12)} exposure in year one` : 'a plan is already lined up'}</span></div>` : `<div class="num-card"><span class="nc-label">Spread between paths</span><span class="nc-amount">${fmtUSD(r.spread)}</span><span class="nc-sub">best vs. worst, first 12 months</span></div>`}
  </div>`;
  const move = fm ? `<p class="v-sub"><span class="chip chip-gold">Do this first</span> <strong>${esc(voice(fm.title))}</strong> ${fm.startNow || fm.kind === 'start' ? 'starting now' : `by ${fmtDate(fm.date)}`}${fm.form?.id ? ` (${esc(fm.form.id)})` : ''}. ${esc(voice(fm.why))}</p>` : '';
  const cheaper = r.cheapestAny && r.cheapestAny.cost12 < best.cost12 ? `<p class="v-sub"><span class="chip chip-red">The cheaper path has a gap</span> <strong>${esc(r.cheapestAny.label)}</strong> is about ${fmtUSD(best.cost12 - r.cheapestAny.cost12)} cheaper over 12 months but leaves <strong>${r.cheapestAny.gapDays} uninsured days</strong>${r.dates.daysToSep > 0 && (r.cheapestAny.primary === 'marketplace' || r.cheapestAny.primary === 'spouse') && r.dates.lossOfCoverage && new Date(r.dates.lossOfCoverage).getUTCDate() !== 1 ? (r.tamp.eligible ? '. TAMP ends mid-month, so bridge those days with CHCBP or pick a separation date whose 180th day is a month end' : '. A last-day-of-the-month separation date would erase that gap and make it the cheapest gapless path') : ''}.</p>` : '';
  let fallback = '';
  if (best.id === 'va' && r.va.status === 'likely') { const nb = r.paths.filter(x => x.feasible && x.id !== 'va' && x.id !== 'wait' && x.gapDays === 0).sort((a, b) => a.cost12 - b.cost12)[0]; fallback = `<p class="v-sub"><span class="chip chip-gold">If the VA says no</span> This assumes you qualify; check the list before you count on it. ${nb ? `The next-best path with no uninsured day is <strong>${esc(nb.label)}</strong> at about <strong>${fmtUSD(nb.cost12)}</strong>.` : ''}</p>`; }
  const vaLine = r.p.mode !== 'retiring' && !(fm && fm.why === r.va.reason) ? `<p class="v-sub"><span class="chip chip-navy">${V().vetChip}</span> ${esc(voice(r.va.reason))}${hh.hasFamilyRow ? ' VA care never covers the family; that\'s what the paths below are for.' : ''}</p>` : '';
  const medicareLine = r.p.mode === 'retiring' && r.p.vetAge >= 60 ? `<p class="v-sub"><span class="chip chip-gold">Medicare is next</span> At 65 (or earlier if Medicare Part A starts), TRICARE For Life requires Part B. Skip it and TRICARE ends; enroll late and the surcharge lasts as long as you have Part B. <a href="https://www.tricare.mil/LifeEvents/Medicare" target="_blank" rel="noopener" style="color:#ffe9a8">tricare.mil: Medicare and TRICARE →</a></p>` : '';
  const champvaLine = r.champva.eligible ? `<p class="v-sub"><span class="chip chip-green">CHAMPVA</span> ${esc(r.champva.reason)} <a href="/champva/" style="color:#ffe9a8">Run the CHAMPVA tool →</a></p>` : r.champva.gray ? `<p class="v-sub"><span class="chip chip-gold">CHAMPVA gray area</span> ${esc(r.champva.reason)} <a href="/champva/?mode=reserve" style="color:#ffe9a8">Run the Reserve fork →</a></p>` : '';
  const past = r.p.mode !== 'out' && r.p.mode !== 'retiring' && r.dates.daysToSep < 0 ? `<p class="v-sub v-warning">That separation date is ${Math.abs(r.dates.daysToSep)} days in the past. The plan above is what you should have done. <button type="button" id="switch-out" class="chip chip-gold" style="cursor:pointer;border:none">Switch to "Already out" →</button> to see which windows are still open today, keeping everything else you entered.</p>` : '';
  el.innerHTML = `<p class="v-kicker">${kicker}</p><p class="v-line">${line}</p>${cards}${past}${move}${cheaper}${fallback}${vaLine}${champvaLine}${medicareLine}`;
  const sw = $('switch-out');
  if (sw) sw.addEventListener('click', () => { setMode('out'); reveal(); });
}

/* ─── Results panels ───────────────────────────────────────────────────── */
function tlBar(segs, sep, markers) {
  const total = HORIZON_DAYS;
  const inner = segs.map(s => {
    const w = (s.end - s.start) / total * 100;
    const label = SHORT[s.program];
    return `<div class="tl-seg${s.program === 'uninsured' ? ' uninsured' : ''}${['marketplace', 'employer', 'spouse', 'fehb', 'champva'].includes(s.program) ? ' light' : ''}" style="flex:${s.end - s.start} 0 0;background:${s.program === 'uninsured' ? '' : PROGRAMS[s.program].color}" title="${esc(PROGRAMS[s.program].label)}: ${fmtDate(addDays(sep, s.start))} – ${fmtDate(addDays(sep, s.end))} (${s.end - s.start} days)">${w >= 7 ? esc(label) : ''}</div>`;
  }).join('');
  const mk = markers.map(m => `<div class="tl-marker" style="left:${m.day / total * 100}%" data-label="${esc(m.label)}"></div>`).join('');
  return `<div class="tl-bar">${inner}${mk}</div>`;
}
function renderTimeline(r) {
  const path = r.paths.find(x => x.id === state.activePath) || r.best;
  const sep = r.origin;
  const markers = [];
  if (r.dates.tampEnd) { const t = daysBetween(sep, r.dates.lossOfCoverage); if (t > 0 && t < HORIZON_DAYS) markers.push({ day: t, label: 'TAMP ends' }); }
  if (r.p.jobStart) { const d = daysBetween(sep, r.p.jobStart); if (d > 0 && d < HORIZON_DAYS) markers.push({ day: d, label: r.p.next === 'gs' ? 'GS start' : 'Job start' }); }
  const ticks = [0, 6, 12, 18, 24].map(m => `<span class="tl-tick${m === 0 ? ' first' : ''}" style="left:${m * 30.4375 / HORIZON_DAYS * 100}%">${m === 0 ? fmtDate(sep) : m + ' mo'}</span>`).join('');
  const segList = row => `<ul class="sr-only">${row.map(s => `<li>${esc(PROGRAMS[s.program].label)}: ${fmtDate(addDays(sep, s.start))} to ${fmtDate(addDays(sep, s.end))}</li>`).join('')}</ul>`;
  const rows = [`<div class="tl-row"><div class="tl-label">${V().You}</div>${tlBar(path.segments.veteran, sep, markers)}${segList(path.segments.veteran)}</div>`];
  if (path.segments.family) rows.push(`<div class="tl-row"><div class="tl-label">${V().famRow(r.p.spouse, r.p.children > 0)}</div>${tlBar(path.segments.family, sep, markers)}${segList(path.segments.family)}</div>`);
  const used = new Set(); [path.segments.veteran, path.segments.family || []].flat().forEach(s => used.add(s.program));
  const legend = [...used].map(k => `<span style="--sw:${k === 'uninsured' ? '#e53e3e' : PROGRAMS[k].color}">${esc(PROGRAMS[k].label)}</span>`).join('');
  const tabs = r.paths.filter(x => x.feasible).map(x => `<button type="button" class="path-tab${x.id === path.id ? ' active' : ''}" data-path="${x.id}" aria-pressed="${x.id === path.id}">${esc(x.label)}<span class="pt-cost">${fmtUSD(x.cost12)}</span>${x.gapDays > 0 ? ` <span class="gap-chip bad">${x.gapDays}d gap</span>` : ''}</button>`).join('');
  $('timeline-panel').innerHTML = `<h3>Who is covered by what, for the next 24 months${r.p.mode === 'out' ? ' (starting today)' : ''}</h3>
    <p class="table-note">Click a path to draw it. Red means nobody is paying but you. Hover a block for dates.</p>
    <div class="path-tabs no-print">${tabs}</div>
    <div class="tl-wrap">${rows.join('')}<div class="tl-axis"><div></div><div class="tl-ticks">${ticks}</div></div></div>
    <div class="tl-legend">${legend}</div>
    <p class="table-note"><strong>${esc(path.label)}</strong>: ${path.gapDays === 0 ? 'no uninsured days.' : `<span class="gap-chip bad">${path.gapDays} uninsured days</span>`} ${path.notes.map(esc).join(' ')}</p>`;
  $('timeline-panel').querySelectorAll('.path-tab').forEach(b => b.addEventListener('click', () => { state.activePath = b.dataset.path; renderTimeline(state.last); }));
}
function renderClocks(r) {
  const cl = r.clocks;
  const card = c => {
    const isStart = c.id === 'employer' || c.id === 'tamp' || c.id === 'ship';
    const rel = c.status === 'missed' ? `${Math.abs(c.days)} days ago` : c.status === 'future' ? `opens in ${daysBetween(r.p.today, c.opensAt)} days` : c.days === 0 ? 'today' : `${c.days} days`;
    return `<div class="clock ${c.status}${c.courtesy ? ' courtesy' : ''}"><div class="ck-days">${c.status === 'missed' ? (isStart ? 'Started' : 'Closed') : c.soft ? 'Open' : rel}</div><div class="ck-date">${c.status === 'missed' ? `${isStart ? 'on' : 'was'} ${fmtDate(c.date)}` : c.soft ? `target ${fmtDate(c.date)}` : fmtDate(c.date)}</div><div class="ck-label">${esc(c.label)}</div><p class="ck-why">${esc(c.why)}</p>${c.form ? `<div class="ck-form"><strong>${esc(c.form.id)}</strong> · ${c.form.url ? `<a href="${esc(c.form.url)}" target="_blank" rel="noopener">${esc(c.form.where)}</a>` : esc(c.form.where)}</div>` : ''}</div>`;
  };
  $('clocks-panel').innerHTML = `<h3>Money clocks: every deadline that applies to this household</h3>
    <p class="table-note">Counted from today (${fmtDate(r.p.today)}). Red is inside 30 days. Dashed is a courtesy item, not health coverage. "HIPAA" is the federal rule that gives you a special enrollment on a group plan; "BDD" is the pre-discharge VA claim.</p>
    <div class="clock-grid">${cl.map(card).join('')}</div>`;
}
function renderPaths(r) {
  const hh = r.hh;
  const rank = x => (x.id === r.best?.id ? 0 : !x.feasible ? 3 : x.id === 'wait' ? 2 : 1);
  const rows = [...r.paths].sort((a, b) => rank(a) - rank(b) || (a.gapDays > 0) - (b.gapDays > 0) || a.cost12 - b.cost12).map(x => {
    const who = x.segments.family ? `${state.viewer === 'spouse' ? 'You + kids' : 'Family'}: ${[...new Set(x.segments.family.map(s => SHORT[s.program]))].join(' → ')}<br>${V().You}: ${[...new Set(x.segments.veteran.map(s => SHORT[s.program]))].join(' → ')}` : `${V().You}: ${[...new Set(x.segments.veteran.map(s => SHORT[s.program]))].join(' → ')}`;
    return `<tr class="path-row${x.id === r.best?.id ? ' best' : ''}${x.id === 'wait' || !x.feasible ? ' wait' : ''}"><td><strong>${esc(x.label)}</strong>${x.id === r.best?.id ? ' <span class="best-tag">Recommended</span>' : ''}${!x.feasible ? ` <span class="gap-chip bad">${x.blockedKind === 'eligibility' ? 'not eligible yet' : 'window closed'}</span>` : ''}<span class="path-notes">${x.feasible ? x.notes.map(esc).join(' ') : esc(voice(x.infeasibleWhy))}</span></td><td style="font-size:0.82rem">${who}</td>${x.feasible ? `<td class="num"><span class="gap-chip ${x.gapDays === 0 ? 'zero' : 'bad'}">${x.gapDays === 0 ? 'none' : x.gapDays + ' days'}</span></td><td class="num">${fmtUSD(x.premiums12)}</td><td class="num">${fmtUSD(x.oop12)}</td><td class="num"><strong>${fmtUSD(x.cost12)}</strong></td><td class="num">${fmtUSD(x.cost24)}</td>` : '<td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>'}</tr>`;
  }).join('');
  const mk = r.market;
  const marketNote = r.paths.some(x => x.primary === 'marketplace' || x.segments.family?.some(s => s.program === 'marketplace')) ? `<p class="table-note">Marketplace premium ${mk.estimated ? `estimated at ${fmtUSD(mk.monthly)}/mo${mk.subsidized ? ` after a premium tax credit (household at ${Math.round(mk.ratio * 100)}% of the poverty line; full price about ${fmtUSD(mk.full)}/mo)` : mk.note ? `, ${esc(mk.note.replace(/\.\s*$/, '').replace(/^No income entered: /, 'the ').replace(/^No income or state entered: /, 'the ').replace(/ used$/, ''))}` : ''}. ${mk.basis === 'state' ? `Priced from ${esc(STATES.find(s => s[0] === r.p.stateCode)?.[1] || r.p.stateCode)}\'s 2026 benchmark silver plan (KFF) and the federal age curve for ${mk.bf.members} ${mk.bf.members === 1 ? 'person' : 'people'}${mk.bf.noAge ? ' (this state does not rate by age)' : mk.bf.approx ? ' (approximate: this state uses its own age curve)' : ''}.` : mk.basis === 'national' ? `Priced from the 2026 national average benchmark for ${mk.bf.members} ${mk.bf.members === 1 ? 'person' : 'people'}; pick your state in the form for a state-priced estimate.` : 'Pick your state in the form for a state-priced estimate.'} Enter your real quote in the drawer.` : `entered at ${fmtUSD(mk.monthly)}/mo.`}</p>` : '';
  $('paths-panel').innerHTML = `<h3>Every path, priced for ${hh.hasFamilyRow ? `a household of ${hh.size}` : 'you'}</h3>
    <div class="table-scroll"><table class="cmp-table"><thead><tr><th>Path</th><th>Who's on what</th><th class="num">Uninsured</th><th class="num">Premiums (12 mo)</th><th class="num">Est. cost share</th><th class="num">12-mo total</th><th class="num">24-mo total</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${marketNote}
    <p class="table-note">Cost share = ${V().your === undefined ? 'your' : 'your'} expected household charges at the "${esc(document.querySelector('#usage option:checked').textContent.split(':')[0])}" usage level run through each plan's deductible, coinsurance, and out-of-pocket cap; an uninsured stretch pays 100% of its share with no cap. At typical usage the cost share can look the same across paths because every dollar falls under a deductible either way; the difference is that only the uninsured days have no ceiling if something big happens. Premiums for employer, spouse, and FEHB plans use the KFF 2025 average worker share unless you entered yours.</p>
    <p class="verify-note">CHCBP at the CY2026 rate ($2,103 / $5,339 per quarter); TRICARE 2026 rates as published; marketplace estimates use the standard premium-credit schedule (the enhanced credits expired Dec 31, 2025). Data stamp ${DATA_STAMP}.</p>`;
}
function renderActions(r) {
  const items = r.actions.map(a => {
    const d = daysBetween(r.p.today, a.date);
    const rel = a.startNow ? 'start now' : a.overdue && r.p.mode !== 'out' ? 'now (overdue)' : d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
    const sub = a.checklist ? `<ul class="act-sub">${a.checklist.map(c => `<li>${esc(voice(c))}</li>`).join('')}</ul>` : '';
    return `<li class="act ${a.urgency}"><div class="a-date">${fmtDate(a.date)}<span class="a-rel">${rel}</span></div><div><p class="a-title">${a.urgency === 'high' ? '<span class="a-tag">must do</span> ' : ''}${esc(a.title)}</p><p class="a-why">${esc(a.why)}</p>${sub}${a.form ? `<div class="a-form"><strong>${esc(a.form.id)}</strong> · ${a.form.url ? `<a href="${esc(a.form.url)}" target="_blank" rel="noopener">${esc(a.form.where)}</a>` : esc(a.form.where)}</div>` : ''}</div></li>`;
  }).join('');
  const spouseNote = state.viewer === 'spouse'
    ? `<p class="table-note">Written to the service member; the gold card above is the part that's yours.</p>`
    : (r.p.spouse ? `<p class="table-note">Married? Your spouse has their own to-do list (their HR, the paperwork, the kids' doctors). <button type="button" id="spouse-link-btn" class="action-btn secondary" style="padding:6px 12px;font-size:0.8rem">Copy a link to the spouse view</button></p>` : '');
  // Official portals only: programs that appear in any feasible path, plus the always-on VA/VSO/dental links.
  const progs = new Set(['always']);
  r.paths.filter(x => x.feasible).forEach(x => [x.segments.veteran, x.segments.family || []].flat().forEach(s => progs.add(s.program)));
  if (r.p.children > 0) progs.add('kids');
  const links = OFFICIAL_LINKS.filter(l => l.when.some(w => progs.has(w)));
  const official = `<div class="official-links"><h4>Official places to enroll and get free help</h4><p class="table-note">Government and program-administrator pages only. No brokers, no carriers, no referral fees. If a site asks you to pay for help enrolling, close it.</p><ul>${links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul></div>`;
  $('actions-panel').innerHTML = `<h3>${state.viewer === 'spouse' ? 'Your veteran\'s action plan, in order' : 'Your action plan, in order'}</h3><p class="table-note">"Must do" items cost real money if missed. Print this; it's the whole point.</p><ul class="act-list">${items}</ul>${spouseNote}${official}`;
  const sb = $('spouse-link-btn');
  if (sb) sb.addEventListener('click', async () => { const url = buildShareUrl('spouse'); try { await navigator.clipboard.writeText(url); sb.textContent = '✓ Link copied'; setTimeout(() => { sb.textContent = 'Copy a link to the spouse view'; }, 2000); } catch { prompt('Copy this link:', url); } });
}
function renderSpouse(r) {
  const el = $('spouse-panel');
  const show = state.viewer === 'spouse' && r.spouseActions.length > 0;
  el.style.display = show ? 'block' : 'none';
  if (!show) return;
  const items = r.spouseActions.map(a => { const d = daysBetween(r.p.today, a.date); const rel = d === 0 ? 'today' : `in ${d} days`; return `<li class="act ${a.urgency}"><div class="a-date">${fmtDate(a.date)}<span class="a-rel">${rel}</span></div><div><p class="a-title">${esc(a.title)}</p><p class="a-why">${esc(a.why)}</p>${a.form ? `<div class="a-form"><strong>${esc(a.form.id)}</strong> · ${a.form.url ? `<a href="${esc(a.form.url)}" target="_blank" rel="noopener">${esc(a.form.where)}</a>` : esc(a.form.where)}</div>` : ''}</div></li>`; }).join('');
  el.innerHTML = `<h3>Things only you can do</h3><p>Your veteran can't request enrollment at your HR, and usually isn't the one holding the marriage certificate. These are yours.</p><ul class="act-list">${items}</ul>`;
}
function renderDependents(r) {
  const el = $('dependents-panel');
  const show = r.dependentNotes.length > 0;
  el.style.display = show ? 'block' : 'none';
  if (!show) return;
  el.innerHTML = `<h3>What separation does to each person in the house</h3><ul class="dep-list">${r.dependentNotes.map(([who, what]) => `<li><strong>${esc(state.viewer === 'spouse' && who === 'Your spouse' ? 'You' : who)}.</strong> ${esc(state.viewer === 'spouse' && who === 'Your spouse' ? what.replace(/a spouse\./, 'you.').replace(/covers them/, 'covers you').replace(/their own employer plan/, 'your own employer plan') : what)}</li>`).join('')}</ul>`;
}
function renderLadder(r) {
  const S = { yes: 'Enrolled', likely: 'Likely (check)', check: 'Income-tested', blocked: 'Closed (PG 8e/8g)' };
  const rows = r.ladder.map(l => `<tr class="ladder-row${l.current ? ' current' : ''}"><td>${esc(l.label)}${l.current ? ` <span class="best-tag">${state.viewer === 'spouse' ? 'Them' : 'You'}</span>` : ''}</td><td><span class="status-${l.va.status}">${S[l.va.status]}</span>${l.va.group ? ` · Priority Group ${l.va.group}` : ''}${l.va.copays === 'none' ? ' · no copays' : l.va.copays === 'meds' ? ' · no care copays (meds only)' : l.va.copays === 'combat-free' ? ' · no copays for combat-related care' : l.va.status === 'yes' ? ' · copays apply' : ''}</td><td>${r.p.mode === 'retiring' ? 'Retiree TRICARE (unchanged)' : l.champva.eligible ? '<span class="status-yes">CHAMPVA, $0 premium</span>' : 'Own plan needed'}</td><td class="num">${l.bestCost12 == null ? '—' : fmtUSD(l.bestCost12)}</td></tr>`).join('');
  const cur = r.p.ratingNum;
  $('ladder-panel').innerHTML = `<h3>The rating changes everything</h3>
    <p>Same household, same separation, same next step. Only the rating moves. ${r.p.mode === 'retiring' ? 'Retirees keep TRICARE, so CHAMPVA doesn\'t apply; the VA column still does.' : ''}</p>
    <div class="table-scroll"><table class="cmp-table"><thead><tr><th>Rating</th><th>VA care for ${V().you}</th><th>${r.p.mode === 'retiring' ? 'Family coverage' : r.hh.hasFamilyRow ? (state.viewer === 'spouse' ? 'You and the kids' : 'Your family') : 'Family (if any)'}</th><th class="num">Best 12-mo household cost</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="table-note">${cur == null ? 'Never filed? An <a href="/secondary-conditions/">Intent to File</a> takes one click and locks today\'s date. Then build the claim: <a href="/va-combined/">VA Combined Rating Calculator</a>, <a href="/secondary-conditions/">Secondary Conditions</a>, and <a href="/cp-exam-prep/">C&amp;P Exam Prep</a>.' : r.p.rating === 'pt' ? 'You\'re at the top of this ladder. See <a href="/100-pt/">everything P&amp;T is worth</a> and run the <a href="/champva/">CHAMPVA tool</a> for the family\'s catastrophic-year math.' : 'The most common path up is <a href="/secondary-conditions/">secondary conditions</a>, which need no in-service records. Check the math in the <a href="/va-combined/">VA Combined Rating Calculator</a>.'}</p>`;
}
function renderTraps(r) {
  $('traps-panel').innerHTML = `<h3>What TAP (the transition class) didn't tell ${V().you}</h3>${r.traps.map(([h, b]) => `<p>• <strong>${esc(voice(h))}</strong> ${esc(voice(b))}</p>`).join('')}`;
}
function renderResults(r) { renderTimeline(r); renderClocks(r); renderPaths(r); renderDependents(r); renderSpouse(r); renderActions(r); renderLadder(r); renderTraps(r); }

/* ─── FAQ (visible; mirrors FAQPage JSON-LD) ───────────────────────────── */
const FAQ = [
  ['How long does TRICARE last after you leave the military?', 'For most voluntary separations, TRICARE ends on the separation date. TAMP\'s 180 premium-free days apply only to the separation types in 10 U.S.C. 1145: involuntary separation under honorable conditions (including VSI/VSP recipients who cannot draw retired pay), Guard or Reserve members released from more than 30 consecutive days of active duty for a contingency or preplanned mission, National Guard released from Title 32 disaster or emergency duty, stop-loss or a voluntary contingency extension of under a year, sole survivorship discharge, and active-duty members who agree to join the Selected Reserve. Retirees keep TRICARE as retirees if they enroll in Prime or Select within 90 days.'],
  ['What is CHCBP and how long do I have to enroll?', 'The Continued Health Care Benefit Program is premium-based, temporary coverage with TRICARE Select-style benefits: up to 18 months for separating members and families, up to 36 months for certain former spouses and children. Enroll within 60 days of losing TRICARE or TAMP, or 30 days after losing TRICARE Reserve Select (DD Form 2837, Humana Military). Premiums are quarterly in advance and much higher than TRICARE Reserve Select or a subsidized marketplace plan, so it\'s usually a bridge, not a destination.'],
  ['Does VA health care cover my spouse and children?', 'No. VA health care enrolls the veteran only. The only VA family coverage is CHAMPVA, which requires a 100% Permanent and Total rating (or TDIU with P&T) and no TRICARE eligibility. Every other household needs a family plan: a spouse\'s employer plan, the marketplace, CHCBP, TRICARE Reserve Select, or the new employer\'s plan after its waiting period.'],
  ['Can I get VA health care if I have no disability rating yet?', 'Often, yes. Combat-zone service after November 11, 1998, or exposure to burn pits, radiation, Agent Orange, or other hazards enrolls you directly under the PACT Act; combat veterans get a 10-year window in Priority Group 6 with no copays for related care. A veteran with neither is income-tested, and Priority Group 8 enrollment is closed more than 10% above the income limit. Any compensable rating, even 10%, guarantees enrollment; a 0% noncompensable rating is income-tested too.'],
  ['How long do I have to add my family to my spouse\'s employer plan after losing TRICARE?', 'Thirty days. Loss of coverage is a HIPAA special enrollment event, and group plans must give at least 30 days to request enrollment, not the marketplace\'s 60. Ask the spouse\'s HR for the effective-date rule before the separation date and have the DD-214 or TRICARE termination letter ready.'],
];
$('faq-items').innerHTML = FAQ.map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');

/* ─── Share URL ────────────────────────────────────────────────────────── */
const URL_FIELDS = [['sep', sepEl], ['sp', spouseEl], ['ch', childrenEl], ['cb', combatEl], ['r', ratingEl], ['nx', nextEl], ['js', jobStartEl], ['spp', spousePlanEl], ['sr', selresEl], ['ga', grayEl], ['tt', tampTypeEl], ['rg', retireeGroupEl], ['pg', pregnantEl], ['tx', treatmentEl], ['us', usageEl], ['dn', dentalEl], ['inc', incomeEl], ['mp', marketPremEl], ['spm', spousePremEl], ['em', employerPremEl], ['wd', waitEl], ['shp', shipPremEl], ['st', stateEl], ['va', vetAgeEl], ['sa', spouseAgeEl]];
function buildShareUrl(viewer) {
  const p = new URLSearchParams();
  p.set('mode', state.mode);
  if ((viewer || state.viewer) === 'spouse') p.set('who', 'spouse');
  for (const [k, el] of URL_FIELDS) if (el.value !== '' && el.value != null) p.set(k, el.value);
  if (state.activePath) p.set('path', state.activePath);
  return location.origin + location.pathname + '?' + p.toString() + '&source=transition-health';
}
function loadFromUrl() {
  const p = new URLSearchParams(location.search);
  if (!p.has('sep')) {
    if (p.has('mode') && MODE_BRIEF[p.get('mode')]) { setMode(p.get('mode')); history.replaceState(null, '', location.pathname); }
    return false;
  }
  const mode = MODE_BRIEF[p.get('mode')] ? p.get('mode') : 'voluntary';
  setMode(mode);
  for (const [k, el] of URL_FIELDS) if (p.has(k)) el.value = p.get(k);
  if (p.has('tt')) { fillTampTypes(mode); tampTypeEl.value = p.get('tt'); syncTampHint(); }
  if (p.has('path')) state.activePath = p.get('path');
  if (p.get('who') === 'spouse') setViewer('spouse');
  syncConditionalFields();
  if (p.has('inc') || p.has('mp') || p.has('pg') === 'yes') $('assumptions-drawer').open = true;
  history.replaceState(null, '', location.pathname);
  reveal();
  return true;
}

/* ─── Email capture ────────────────────────────────────────────────────── */
async function sendResultsEmail(email, statusEl, btn, placement) {
  if (!email || !email.includes('@')) { statusEl.textContent = 'Please enter a valid email.'; statusEl.className = 'email-status error'; return false; }
  btn.disabled = true;
  statusEl.textContent = 'Sending…'; statusEl.className = 'email-status';
  try {
    const res = await fetch('/api/email-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, resultsUrl: buildShareUrl(), source: 'transition-health' }) });
    const data = await res.json();
    if (res.ok && data.success) {
      statusEl.textContent = '✓ Check your inbox: your coverage plan link is on the way.'; statusEl.className = 'email-status success';
      if (typeof gtag === 'function') gtag('event', 'email_capture', { placement });
      return true;
    }
    statusEl.textContent = data.error || 'Something went wrong. Please try again.'; statusEl.className = 'email-status error';
  } catch { statusEl.textContent = 'Network error. Please try again.'; statusEl.className = 'email-status error'; }
  finally { btn.disabled = false; }
  return false;
}
$('hero-capture-form').addEventListener('submit', async e => { e.preventDefault(); if (await sendResultsEmail($('hero-email-input').value.trim(), $('hero-email-status'), $('hero-email-btn'), 'hero')) $('hero-email-input').value = ''; });
$('email-results-form').addEventListener('submit', async e => { e.preventDefault(); if (await sendResultsEmail($('email-input').value.trim(), $('email-status'), $('email-submit-btn'), 'bottom')) $('email-input').value = ''; });
$('print-btn').addEventListener('click', () => window.print());
$('share-btn').addEventListener('click', async () => {
  const btn = $('share-btn');
  try { await navigator.clipboard.writeText(buildShareUrl()); const o = btn.textContent; btn.textContent = '✓ Link Copied!'; setTimeout(() => { btn.textContent = o; }, 2000); }
  catch { prompt('Copy this link:', buildShareUrl()); }
});

/* ─── Interactive tour (house standard, copied from VFI/va-affordability) ── */
const INPUT_TOUR_KEY = 'thb-tour-seen', RESULTS_TOUR_KEY = 'thb-results-tour-seen';
const INPUT_TOUR = [
  { id: 'welcome', target: null, label: 'Step 1 of 7', title: 'Welcome: 60 seconds, then it\'s all yours', text: 'TRICARE ends on your separation date and nobody explains what comes next, for whom, or by when. This builds the bridge. Fill in your real answers as we go; exit anytime.' },
  { id: 'pills', target: '#mode-pills', label: 'Step 2 of 7', title: 'How are you leaving?', text: 'This single answer decides whether you get 180 days of TAMP or zero. Voluntary end-of-contract separations get zero. Click the one that fits and the form reshapes around it.' },
  { id: 'you', target: '#card-you', label: 'Step 3 of 7', title: 'Your date, your household, your rating', text: 'The date starts every clock. Your household decides who needs a plan at all: VA care never covers a spouse or kids. Combat or exposure service and your rating decide whether the VA enrolls you, and at 100% P&T, whether CHAMPVA covers the family.' },
  { id: 'next', target: '#card-next', label: 'Step 4 of 7', title: 'What\'s next, and the spouse-plan question', text: 'A new employer plan is the destination; the question is what covers the family until it starts. If your spouse has an employer plan, say so: it\'s usually the cheapest path and it has the shortest window, 30 days.' },
  { id: 'assumptions', target: '#assumptions-drawer', label: 'Step 5 of 7', title: 'Assumptions, all editable (optional)', text: 'Ages and income price the marketplace for your state and check Medicaid and CHIP. Pregnancy or ongoing treatment raises what a gap costs. A real quote beats our estimate; paste it here if you have one.' },
  { id: 'live', target: '#live-strip', label: 'Step 6 of 7', title: 'Your runway, live', text: 'This line already shows how many days of coverage you have past your date and the cheapest no-gap path so far. Watch it change as you answer.' },
  { id: 'gate', target: '#compare-btn', label: 'Step 7 of 7', title: 'Build the plan', text: 'Press it, and we\'ll walk through the results together.' },
];
const RESULTS_TOUR = [
  { id: 'r-hero', target: '#hero-verdict', label: 'Results 1 of 4', title: 'The verdict', text: 'Your runway, the cheapest path with no uninsured day, and what doing nothing costs. The gold chip is the one thing to do this week.' },
  { id: 'r-timeline', target: '#timeline-panel', label: 'Results 2 of 4', title: 'Who is covered by what', text: 'One row for you, one for the family, 24 months. Red is nobody paying but you. Click the other paths to compare.' },
  { id: 'r-clocks', target: '#clocks-panel', label: 'Results 3 of 4', title: 'The money clocks', text: 'Every deadline that applies to your household, counted from today, with the form and where to file. Red is inside 30 days.' },
  { id: 'r-capture', target: '#email-results-container', label: 'Results 4 of 4', title: 'Don\'t lose this', text: 'Email yourself the link; it rebuilds this exact plan for your spouse or your HR office. That\'s the walkthrough.' },
];
const tourState = { active: false, i: 0, steps: INPUT_TOUR, seenKey: INPUT_TOUR_KEY, timer: null };
function isTourActive() { return tourState.active; }
function tourEls() { return { root: $('tour-root'), spot: $('tour-spotlight'), tip: $('tour-tooltip') }; }
function positionTour() {
  const step = tourState.steps[tourState.i]; if (!step) return;
  const { spot, tip } = tourEls();
  if (!step.target) {
    spot.style.cssText = `top:${scrollY + innerHeight / 2}px; left:50vw; width:0; height:0;`;
    if (!matchMedia('(max-width: 560px)').matches) {
      tip.style.left = Math.max(24, (innerWidth - Math.min(380, innerWidth - 48)) / 2) + 'px';
      tip.style.top = (scrollY + innerHeight / 2 - (tip.offsetHeight || 220) / 2) + 'px';
    }
    return;
  }
  const target = document.querySelector(step.target);
  if (!target || target.offsetParent === null) return;
  const r = target.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  const pad = 8;
  Object.assign(spot.style, { top: (r.top + scrollY - pad) + 'px', left: (r.left + scrollX - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
  const tipH = tip.offsetHeight || 180;
  const below = r.bottom + 16 + tipH < innerHeight || r.top < tipH + 32;
  if (matchMedia('(max-width: 560px)').matches) { tip.style.top = ''; tip.style.left = ''; }
  else {
    tip.style.top = (below ? r.bottom + scrollY + 14 : r.top + scrollY - tipH - 14) + 'px';
    tip.style.left = Math.max(12, Math.min(r.left + scrollX, innerWidth - tip.offsetWidth - 12)) + 'px';
  }
}
function showTourStep(i, dir = 1) {
  if (i < 0 || i >= tourState.steps.length) return endTour();
  const step = tourState.steps[i];
  if (step.target) { const el = document.querySelector(step.target); if (!el || el.offsetParent === null) return showTourStep(i + dir, dir); }
  tourState.i = i;
  const visible = tourState.steps.filter(s => { if (!s.target) return true; const el = document.querySelector(s.target); return el && el.offsetParent !== null; });
  $('tour-step-label').textContent = `${step.label.split(' ')[0]} ${visible.indexOf(step) + 1} of ${visible.length}`;
  $('tour-title').textContent = step.title;
  $('tour-text').textContent = step.text;
  $('tour-next').textContent = i === tourState.steps.length - 1 ? 'Done ✓' : 'Next';
  $('tour-back').style.visibility = i === 0 ? 'hidden' : 'visible';
  if (!step.target) window.scrollTo({ top: 0, behavior: 'smooth' });
  else { const target = document.querySelector(step.target); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  setTimeout(positionTour, 350);
}
function startTourWith(steps, seenKey) {
  tourState.steps = steps; tourState.seenKey = seenKey; tourState.active = true; tourState.i = 0;
  $('tour-root').hidden = false;
  showTourStep(0);
  clearInterval(tourState.timer);
  tourState.timer = setInterval(positionTour, 400);
}
function endTour() {
  tourState.active = false;
  clearInterval(tourState.timer);
  $('tour-root').hidden = true;
  try { localStorage.setItem(tourState.seenKey, '1'); } catch {}
}
$('tour-next').addEventListener('click', () => showTourStep(tourState.i + 1, 1));
$('tour-back').addEventListener('click', () => showTourStep(tourState.i - 1, -1));
$('tour-exit').addEventListener('click', endTour);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && tourState.active) endTour(); });
document.addEventListener('click', e => {
  if (!tourState.active || e.detail === 0) return;
  if (e.target.closest('#tour-tooltip') || e.target.closest('#tour-restart')) return;
  if (e.target.closest('#compare-btn') || e.target.closest('.mode-pill')) return;
  const r = $('tour-spotlight').getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) endTour();
});
$('tour-restart').addEventListener('click', () => startTourWith(INPUT_TOUR, INPUT_TOUR_KEY));
addEventListener('resize', positionTour);

/* ─── Init ─────────────────────────────────────────────────────────────── */
setMode('voluntary');
const arrived = loadFromUrl();
let tourSeen = true;
try { tourSeen = localStorage.getItem(INPUT_TOUR_KEY) === '1'; } catch {}
if (!arrived && !window.__thbArrivalHadParams && !tourSeen) setTimeout(() => startTourWith(INPUT_TOUR, INPUT_TOUR_KEY), 600);
updateLiveStrip();
