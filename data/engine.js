/**
 * Transition Health Coverage Bridge — pure engine. No DOM.
 *
 *   solve(input) → { p, hh, tamp, va, champva, dates, clocks, paths, best, actions, ladder, traps }
 *
 * Dates are UTC-midnight epoch ms. Timeline day index 0 = the separation
 * date; index d = separation + d days. TRICARE covers through the last duty
 * day, so the first uncovered date is index 1 (or TAMP's end). Timelines run
 * HORIZON_DAYS. Costs are household estimates: premiums for each segment plus
 * a usage-based cost share (allowed charges × plan shape), labeled as
 * assumptions in the UI.
 */
import { WINDOWS, TAMP_CATEGORIES, PROGRAMS, USAGE, VA, ACA, FORMS } from './rules.js';
import * as SM from './state-medicaid-2026.js';
const { STATE_MEDICAID, FPL_2025 } = SM;
const FPL_2026 = SM.FPL_2026 || null;   // Medicaid/CHIP use the 2026 guidelines; plan-year 2026 marketplace credits use 2025
import { BENCHMARK_40_2026, BENCHMARK_40_2026_US, AGE_CURVE, AGE_RATING_EXCEPTIONS } from './marketplace-benchmarks-2026.js';

export const HORIZON_DAYS = 730;
const DAY = 86400000;

/* ── dates ─────────────────────────────────────────────────────────────── */
export function parseDate(s) {
    if (!s) return null;
    if (typeof s === 'number') return s;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return Number.isFinite(t) ? t : null;
}
export const addDays = (ms, n) => ms + n * DAY;
export const daysBetween = (a, b) => Math.round((b - a) / DAY);
export function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
export function fmtDate(ms) {
    const d = new Date(ms);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
export function todayUTC() { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
export function firstOfMonthOnOrAfter(ms) {
    const d = new Date(ms);
    if (d.getUTCDate() === 1) return ms;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}
export function nextJan1After(ms) { return Date.UTC(new Date(ms).getUTCFullYear() + 1, 0, 1); }
export function isLastDayOfMonth(ms) { return new Date(addDays(ms, 1)).getUTCDate() === 1; }

/* ── input normalization ───────────────────────────────────────────────── */
const RATING_NUM = r => r === 'pt' ? 100 : (r === 'none' || r === 'pending' || r == null || r === '') ? null : (parseInt(r, 10) || 0);

export function normalize(inp = {}) {
    const today = parseDate(inp.today) ?? todayUTC();
    let sep = parseDate(inp.sepDate);
    const mode = ['voluntary', 'involuntary', 'retiring', 'reserve', 'out'].includes(inp.mode) ? inp.mode : 'voluntary';
    if (sep == null) sep = mode === 'out' ? addDays(today, -120) : addDays(today, 90);
    const children = Math.max(0, Math.min(10, parseInt(inp.children, 10) || 0));
    const spouse = !!inp.spouse;
    const rating = inp.rating || 'none';
    const next = ['job', 'gs', 'school', 'gap', 'unsure'].includes(inp.next) ? inp.next : 'unsure';
    const jobStart = (next === 'job' || next === 'gs' || next === 'school') ? parseDate(inp.jobStart) : null;   // job start, or term start for school
    const tampDefault = { voluntary: 'voluntary', involuntary: 'involuntary', retiring: 'retiree', reserve: 'contingency', out: 'voluntary' }[mode];
    const tampType = TAMP_CATEGORIES[inp.tampType] ? inp.tampType : tampDefault;
    return {
        mode, today, sep, spouse, children, rating, ratingNum: RATING_NUM(rating),
        combat: ['yes', 'no', 'unsure'].includes(inp.combat) ? inp.combat : 'unsure',
        next, jobStart,
        waitDays: Math.max(0, Math.min(WINDOWS.employerWaitMaxDays, Number.isFinite(parseInt(inp.waitDays, 10)) ? parseInt(inp.waitDays, 10) : 30)),
        spousePlan: !!inp.spousePlan,
        spousePlanMonthly: num(inp.spousePlanMonthly),
        employerMonthly: num(inp.employerMonthly),
        marketMonthly: num(inp.marketMonthly),
        shipMonthly: num(inp.shipMonthly),
        pregnant: !!inp.pregnant, treatment: !!inp.treatment, dental: !!inp.dental,
        income: Math.max(0, num(inp.income) ?? 0),
        selres: inp.selres == null ? (mode === 'reserve') : !!inp.selres,
        grayArea: !!inp.grayArea,
        tampType, chapter61: !!inp.chapter61,
        usage: USAGE[inp.usage] ? inp.usage : 'typical',
        retireeGroup: inp.retireeGroup === 'B' ? 'B' : 'A',
        stateCode: /^[A-Z]{2}$/.test(String(inp.state || '')) ? String(inp.state) : null,
        vetAge: clampAge(inp.vetAge, 30),
        spouseAge: clampAge(inp.spouseAge, clampAge(inp.vetAge, 30)),
    };
}
function num(v) { if (v === '' || v == null) return null; const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function clampAge(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(17, Math.min(80, n)) : d; }

/* Federal poverty level for the household (2025 guidelines govern 2026 determinations). */
export function fplFor(p, hh, use = 'marketplace') {
    const f = (use === 'medicaid' && FPL_2026) ? FPL_2026 : (FPL_2025 || {});
    const s = (p.stateCode === 'AK' && f.AK) ? f.AK : (p.stateCode === 'HI' && f.HI) ? f.HI : { base: f.base48 ?? ACA.fpl.base, perPerson: f.perPerson48 ?? ACA.fpl.perPerson };
    return s.base + s.perPerson * (hh.size - 1);
}

/* Medicaid / CHIP read for the household, from the state table when present. */
export function medicaidEligibility(p, hh) {
    const st = p.stateCode ? STATE_MEDICAID[p.stateCode] : null;
    if (!st) return { available: false };
    if (!p.income) return { available: true, unknown: true, state: st };
    const ratio = (p.income / fplFor(p, hh, 'medicaid')) * 100;
    const adultLimit = p.children > 0 ? st.parentsPctFpl : st.adultPctFpl;
    const adults = adultLimit != null && ratio <= adultLimit;
    const kids = p.children > 0 && st.chipUpperPctFpl != null && ratio <= st.chipUpperPctFpl;
    const pregnancy = p.pregnant && st.pregnancyPctFpl != null && ratio <= st.pregnancyPctFpl;
    return { available: true, unknown: false, state: st, ratio, adults, kids, pregnancy, adultLimit, kidsLimit: st.chipUpperPctFpl, household: adults && (p.children === 0 || kids) };
}

/* Unsubsidized marketplace premium for the people who would be on the plan: state benchmark (age 40) × the federal age curve. */
export function benchmarkFull(p, hh, tier, includeVet = true) {
    const stateBench = p.stateCode ? BENCHMARK_40_2026[p.stateCode] : null;
    const bench = stateBench || BENCHMARK_40_2026_US || null;
    if (!bench || !AGE_CURVE || AGE_CURVE[40] == null) return { monthly: ACA.benchmarkPremiumMonthly[tier], basis: 'placeholder' };
    const exc = p.stateCode ? AGE_RATING_EXCEPTIONS[p.stateCode] : null;
    const noAge = !!(exc && /no age rating/i.test(exc));
    const approx = !!(exc && !noAge);
    const f = age => noAge ? AGE_CURVE[40] : (AGE_CURVE[Math.max(0, Math.min(64, age))] ?? AGE_CURVE[40]);
    const members = [];
    if (tier === 'individual' || includeVet) members.push(f(p.vetAge));
    if (tier === 'family') { if (p.spouse) members.push(f(p.spouseAge)); for (let i = 0; i < Math.min(3, p.children); i++) members.push(AGE_CURVE[10] ?? 0.765); }
    const total = members.reduce((a, b) => a + b, 0) / AGE_CURVE[40] * bench;
    return { monthly: total, basis: stateBench ? 'state' : 'national', bench40: bench, noAge, approx, members: members.length };
}

export function household(p) {
    const dependents = (p.spouse ? 1 : 0) + p.children;
    return { size: 1 + dependents, dependents, tier: dependents > 0 ? 'family' : 'individual', hasFamilyRow: dependents > 0 };
}

/* ── eligibility ───────────────────────────────────────────────────────── */
export function tampEligible(p) {
    if (p.mode === 'retiring') return { eligible: false, category: 'retiree', label: TAMP_CATEGORIES.retiree.label, note: TAMP_CATEGORIES.retiree.note };
    const c = TAMP_CATEGORIES[p.tampType] || TAMP_CATEGORIES.voluntary;
    return { eligible: !!c.eligible, category: p.tampType, label: c.label, note: c.note || (c.eligible ? '' : 'Voluntary end-of-contract separations are not on the TAMP list in 10 USC 1145. TRICARE ends at 11:59 p.m. on your last duty day.') };
}

export function vaEligibility(p) {
    const r = p.ratingNum;
    // Ten calendar years from discharge (statute), not 3,653 days.
    const sd = new Date(p.sep); const windowEnd = Date.UTC(sd.getUTCFullYear() + WINDOWS.vaCombatEnrollYears, sd.getUTCMonth(), sd.getUTCDate());
    if (r != null && r > 0) {
        const g = VA.groupByRating(r);
        const copays = r >= VA.noMedCopayAt ? 'none' : 'meds';
        return { status: 'yes', group: g, copays, reason: `A ${r}% service-connected rating puts you in Priority Group ${g}: ${copays === 'none' ? 'no copays for care or medications' : 'no copays for inpatient or outpatient care; medication copays apply for non-service-connected prescriptions'}.` };
    }
    if (p.combat === 'yes') return { status: 'yes', group: 6, copays: 'combat-free', reason: `Combat or toxic-exposure service enrolls you directly (PACT Act): Priority Group 6, no copays for care related to that service; combat veterans get enhanced eligibility until ${fmtDate(windowEnd)}.`, windowEnd };
    if (p.combat === 'unsure') return { status: 'likely', group: 6, copays: 'combat-free', reason: 'If you deployed to a combat zone after Nov 11, 1998, served in the Gulf War or post-9/11 designated locations, or were exposed to burn pits, radiation, or other hazards, you can enroll directly under the PACT Act. Check the list before assuming you can\'t.', windowEnd };
    if (p.mode === 'retiring' || p.chapter61) return { status: 'likely', group: null, copays: 'some', reason: 'Retirees are rated in most cases; once the rating posts you enroll on that basis. Until then you have retiree TRICARE.' };
    // Income-tested (Priority Group 5/7/8). A 0% noncompensable rating is tested the same way as no rating.
    const hh = household(p);
    const limit = hh.dependents > 0 ? VA.incomeLimit2026.oneDependent : VA.incomeLimit2026.single;
    const who = r === 0 ? 'A 0% (noncompensable) rating' : 'With no rating and no combat or exposure eligibility';
    if (p.income > 0) {
        if (p.income <= limit) return { status: 'likely', group: 5, copays: 'some', reason: `${who}${r === 0 ? ' doesn\'t guarantee enrollment; it\'s' : ', enrollment is'} income-tested. Your ${fmt$(p.income)} is under the 2026 national limit for your household (${fmt$(limit)}${hh.dependents > 1 ? ', higher with more dependents' : ''}), so you can enroll (Priority Group 5; copays may apply for non-service-connected care).` };
        if (p.income <= limit * (1 + VA.pg8Tolerance)) return { status: 'likely', group: 8, copays: 'some', reason: `Income-tested: your ${fmt$(p.income)} is within 10% of the 2026 national limit (${fmt$(limit)}), which still enrolls (Priority Group 8b/8d). A compensable rating (10% or higher) removes the test.` };
        return { status: 'blocked', group: 8, copays: 'some', reason: `Income-tested: your ${fmt$(p.income)} is more than 10% over the 2026 national limit for your household (${fmt$(limit)}), so Priority Group 8e/8g enrollment is closed unless your county's geographic limit is higher. File the claim: any compensable rating (10% or higher) enrolls you.` };
    }
    return { status: 'check', group: 8, copays: 'some', reason: `${r === 0 ? 'A 0% (noncompensable) rating doesn\'t guarantee enrollment; it\'s income-tested. ' : ''}${VA.pg8Bar} The 2026 national limit is ${fmt$(limit)} for your household size. Enter your income in the drawer for a read, and file your claim now: a compensable rating (10% or higher) removes the test.` };
}
const fmt$ = n => '$' + Math.round(n).toLocaleString('en-US');

export function champvaEligible(p) {
    if (p.rating !== 'pt') return { eligible: false, reason: 'CHAMPVA requires a 100% Permanent & Total rating (or TDIU with P&T).' };
    if (p.mode === 'retiring') return { eligible: false, reason: 'Retirees and their families are TRICARE-eligible, which bars CHAMPVA (38 CFR 17.271).' };
    if (p.mode === 'reserve' && (p.selres || p.grayArea)) return { eligible: false, gray: true, reason: 'At 100% P&T your family would normally qualify for CHAMPVA, but a Selected Reserve or gray-area family is TRICARE-eligible (TRS/TRR), and TRICARE eligibility bars CHAMPVA under 38 CFR 17.271. This is a genuine gray area; the CHAMPVA tool\'s Reserve fork walks it.' };
    return { eligible: true, reason: 'At 100% P&T your spouse and children qualify for CHAMPVA: $0 premium, $3,000 family cap.' };
}

/* ── key dates and clocks ──────────────────────────────────────────────── */
export function keyDates(p, tamp) {
    // TAMP: 180 days beginning on the separation date, so the last covered day is sep+179 and the first uncovered day is sep+180.
    const tampEnd = tamp.eligible ? addDays(p.sep, WINDOWS.tampDays - 1) : null;
    const lossOfCoverage = p.mode === 'retiring' ? null : (tamp.eligible ? addDays(p.sep, WINDOWS.tampDays) : addDays(p.sep, 1));
    const lossIdx = p.mode === 'retiring' ? null : (tamp.eligible ? WINDOWS.tampDays : 1);
    return { sep: p.sep, tampEnd, lossOfCoverage, lossIdx, today: p.today, daysToSep: daysBetween(p.today, p.sep), daysSinceSep: daysBetween(p.sep, p.today), sepIsMonthEnd: isLastDayOfMonth(p.sep) };
}

function clock(id, label, date, p, why, form, extra = {}) {
    const days = daysBetween(p.today, date);
    let status = days < 0 ? 'missed' : days <= 30 ? 'closing' : 'open';
    if (extra.opensAt != null && p.today < extra.opensAt) status = 'future';
    return { id, label, date, days, status, why, form, ...extra };
}
export function chcbpWindowDays(p, tamp) { return (p.mode === 'reserve' && !tamp.eligible && !p.selres) ? WINDOWS.chcbpElectAfterTrsDays : WINDOWS.chcbpElectDays; }

export function clocks(p, tamp, va, champva, dates) {
    const out = [];
    const loss = dates.lossOfCoverage;
    if (p.mode !== 'out' && p.mode !== 'retiring') {
        const open = addDays(p.sep, -WINDOWS.bddWindowOpenDays), close = addDays(p.sep, -WINDOWS.bddWindowCloseDays);
        if (p.ratingNum == null && p.rating !== 'pending') out.push(clock('bdd', 'BDD claim window (180 to 90 days before separation)', close, p, 'Filing before you leave means a rating decision soon after separation, which is what unlocks VA care, copay-free care, and CHAMPVA at P&T. Missed the window? File day one with an Intent to File.', FORMS.bdd, { opensAt: open }));
    }
    if (tamp.eligible) out.push(clock('tamp', 'Last day of TAMP (180 days from separation)', dates.tampEnd, p, `Premium-free TRICARE for the whole family ends here. Every clock below runs from this date. ${p.mode === 'reserve' ? 'Guard and Reserve members keep military dental clinic care and ADDP through TAMP, and the family can buy the TRICARE Dental Program at any time.' : 'Family dental does not ride along: the TRICARE Dental Program ends on the separation date.'}`, FORMS.tamp));
    if (loss != null) {
        const cw = chcbpWindowDays(p, tamp);
        out.push(clock('chcbp', `CHCBP election window (${cw} days after coverage ends)`, addDays(loss, cw), p, `Miss it and CHCBP is gone. It's expensive and sold in 90-day blocks, but it is the only continuation that starts the day TRICARE${tamp.eligible ? '/TAMP' : ''} ends with no first-of-the-month wait.${cw === 30 ? ' Loss of TRICARE Reserve Select gets 30 days, not 60.' : ''}`, FORMS.chcbp));
        out.push(clock('market', 'Marketplace special enrollment (60 days after coverage ends)', addDays(loss, WINDOWS.marketplaceSepDays), p, `Loss of coverage is a qualifying event, and you can apply up to 60 days before. Coverage starts the first of the month after coverage ends${dates.sepIsMonthEnd || (tamp.eligible && new Date(loss).getUTCDate() === 1) ? ', which for you is the very next day' : ', so a mid-month loss leaves a gap until the 1st'}.`, FORMS.market, { opensAt: addDays(loss, -WINDOWS.marketplaceSepBeforeDays) }));
        if (p.spousePlan) out.push(clock('spouse', "Spouse's employer plan special enrollment (30 days)", addDays(loss, WINDOWS.hipaaSpecialEnrollDays), p, 'HIPAA gives you 30 days, not 60, to add the family to a spouse\'s group plan, and coverage starts the first of the month after the plan receives the request. Ask HR whether they backdate to the loss date; many do.', FORMS.spouse));
    }
    if (p.next === 'job' && p.jobStart) out.push(clock('employer', `Employer plan starts (${p.waitDays === 0 ? 'no waiting period' : p.waitDays + '-day waiting period assumed'})`, addDays(p.jobStart, p.waitDays), p, 'The law caps waiting periods at 90 days. Ask HR for the exact effective date and whether it\'s first-of-month-after.', FORMS.employer));
    if (p.next === 'school' && p.jobStart) out.push(clock('ship', `Student health plan enrollment or waiver (term starts ${fmtDate(p.jobStart)})`, p.jobStart, p, 'Most four-year and nearly all private universities offer a Student Health Insurance Plan, often mandatory unless you waive it with proof of other coverage; community colleges and most online schools don\'t. It runs on the academic year, so the months before the term still need a bridge. Whether the GI Bill pays the fee depends on how the school bills it (ask the certifying official); VA health care usually satisfies the waiver.', FORMS.ship, { soft: true }));
    if (p.next === 'gs' && p.jobStart) out.push(clock('fehb', 'FEHB election window (60 days from hire)', addDays(p.jobStart, WINDOWS.fehbNewHireDays), p, 'Elect in your first week; coverage starts the first pay period after your election, so there\'s no 90-day wait.', FORMS.fehb));
    if (p.mode === 'retiring') {
        out.push(clock('retiree', 'Enroll in retiree TRICARE Prime or Select (90 days after retirement)', addDays(p.sep, WINDOWS.retireeEnrollDays), p, 'Retiree coverage is not automatic. Enroll within 90 days of the retirement date or you fall back to space-available care at military hospitals until open season.', FORMS.retiree));
        out.push(clock('fedvip', 'FEDVIP dental/vision (31 days before to 60 days after retirement)', addDays(p.sep, WINDOWS.fedvipRetireeDays), p, 'The TRICARE Dental Program ends at retirement and FEDVIP cannot be backdated, so enroll BEFORE the retirement date if you want no dental gap. Retirement itself is not a FEDVIP life event later.', FORMS.fedvip, { opensAt: addDays(p.sep, -WINDOWS.fedvipRetireeBeforeDays) }));
    } else out.push(clock('dental', 'VA one-time dental treatment (180 days after discharge)', addDays(p.sep, WINDOWS.vaDentalClassIIDays), p, 'One-time VA dental care if your DD-214 doesn\'t certify a complete exam and all treatment in the 90 days before discharge (38 CFR 17.161). Dental otherwise ends on day one, TAMP or not.', FORMS.vaDental));
    if (champva.eligible) out.push(clock('champva', 'CHAMPVA application (no deadline; apply now)', addDays(p.sep, WINDOWS.champvaProcessingDays), p, 'No statutory deadline, but processing takes weeks. Apply the day you have the P&T letter so the family is covered from the start.', FORMS.champva, { soft: true }));
    if (va.windowEnd) out.push(clock('vawindow', 'VA combat-veteran enhanced enrollment (10 years after discharge)', va.windowEnd, p, 'Enroll any time in this window with no means test and no copays for combat-related care. Sooner is better: enrollment is also the front door for everything else, and you can apply as soon as you have separation orders.', FORMS.va1010, { soft: true }));
    out.push(clock('vgli', 'SGLI to VGLI, no health questions (240 days after separation)', addDays(p.sep, WINDOWS.vgliNoHealthDays), p, 'Not health coverage, but every transitioning veteran asks. After 240 days you can still convert for up to 1 year 120 days, with health questions.', FORMS.vgli, { courtesy: true }));
    return out.sort((a, b) => a.date - b.date);
}

/* ── costs ─────────────────────────────────────────────────────────────── */
export function marketplacePremium(p, tier, hh) {
    if (p.marketMonthly != null) return { monthly: p.marketMonthly, estimated: false, subsidized: null };
    const bf = benchmarkFull(p, hh, tier, p.familyPlanIncludesVet !== false);
    const bench = bf.monthly;
    const basis = bf.basis;
    if (!p.income) return { monthly: bench, estimated: true, subsidized: false, basis, bf, note: basis === 'state' ? 'No income entered: unsubsidized state benchmark used. Enter income for a subsidy estimate.' : 'No income or state entered: national average benchmark used. Enter both for a real estimate.' };
    const fpl = fplFor(p, hh);
    const ratio = p.income / fpl;
    const sched = ACA.enhanced ? ACA.scheduleEnhanced : ACA.schedule;
    if (!ACA.enhanced && ratio > 4) return { monthly: bench, estimated: true, subsidized: false, ratio, basis, bf, note: 'Household income above 400% of the poverty line: no premium tax credit under the standard schedule.' };
    if (ratio < 1) return { monthly: bench, estimated: true, subsidized: false, ratio, basis, bf, note: 'Below 100% of the poverty line: marketplace credits don\'t apply; check Medicaid/CHIP for the household.' };
    let pct = sched[sched.length - 1][2], lo = 1.0;
    for (const [upTo, a, b] of sched) {
        if (ratio <= upTo) { const t = upTo === lo ? 0 : (ratio - lo) / (upTo - lo); pct = a + (b - a) * t; break; }
        lo = upTo;
    }
    const expected = (p.income * pct) / 12;
    return { monthly: Math.min(bench, Math.max(0, expected)), estimated: true, subsidized: expected < bench, ratio, pct, basis, bf, full: bench };
}

export function premiumFor(program, tier, p, hh) {
    if (program === 'marketplace') return marketplacePremium(p, tier, hh).monthly;
    if (program === 'spouse' && p.spousePlanMonthly != null) return p.spousePlanMonthly;
    if (program === 'employer' && p.employerMonthly != null) return p.employerMonthly;
    if (program === 'ship') return p.shipMonthly ?? ACA.benchmarkPremiumMonthly[tier];
    if (program === 'retireeSelect' && p.retireeGroup === 'B') return PROGRAMS.retireeFeesB.select[tier] / 12;
    if (program === 'retireePrime' && p.retireeGroup === 'B') return PROGRAMS.retireeFeesB.prime[tier] / 12;
    const pr = PROGRAMS[program].premium[tier];
    return pr == null ? 0 : pr;
}

export function costShare(program, tier, allowed, p = null) {
    const pl = PROGRAMS[program];
    if (program === 'va') return 0;
    if (program === 'uninsured') return allowed;
    const ded = Math.min(allowed, pl.deductible[tier] || 0);
    const coins = Math.max(0, allowed - ded) * (pl.coinsurance ?? 0);
    const cap = (p && p.retireeGroup === 'B' && (program === 'retireeSelect' || program === 'retireePrime')) ? PROGRAMS.retireeCapB : (pl.oopMax[tier] ?? Infinity);
    return Math.min(ded + coins, cap);
}

export function allowedFor(p, hh, tier) {
    const u = USAGE[p.usage];
    let a = u[tier];
    if (p.pregnant) a += USAGE.pregnancyAdd;
    if (p.treatment && p.usage !== 'heavy') a = Math.max(a, USAGE.heavy[tier] / 2);
    return a;
}

/* Cost of one row's segments over `days` starting at `offset`. CHCBP is sold
 * in 90-day blocks, so its premium is charged per block started. */
export function rowCost(segments, tier, p, hh, days = 365, offset = 0) {
    const allowed = allowedFor(p, hh, tier);
    let premiums = 0, oop = 0;
    for (const s of segments) {
        const a = Math.max(s.start, offset), b = Math.min(s.end, offset + days);
        if (b <= a) continue;
        const frac = (b - a) / 365;
        if (s.program === 'chcbp') premiums += premiumFor('chcbp', tier, p, hh) * 3 * Math.ceil((b - a) / 90);
        else premiums += premiumFor(s.program, tier, p, hh) * ((b - a) / 30.4375);
        oop += costShare(s.program, tier, allowed * frac, p);
    }
    return { premiums, oop, total: premiums + oop };
}

/* ── paths ─────────────────────────────────────────────────────────────── */
function seg(program, start, end) { return end > start ? [{ program, start, end }] : []; }
function gapDays(segments, horizon = HORIZON_DAYS) {
    let covered = 0;
    for (const s of segments) if (s.program !== 'uninsured') covered += Math.max(0, Math.min(s.end, horizon) - Math.max(s.start, 0));
    return Math.max(0, horizon - covered);
}
function fill(segments, horizon = HORIZON_DAYS) {
    const out = []; let cursor = 0;
    for (const s of [...segments].sort((a, b) => a.start - b.start)) {
        if (s.start > cursor) out.push({ program: 'uninsured', start: cursor, end: s.start });
        if (s.end > cursor) out.push({ ...s, start: Math.max(s.start, cursor) });
        cursor = Math.max(cursor, s.end);
    }
    if (cursor < horizon) out.push({ program: 'uninsured', start: cursor, end: horizon });
    return out.map(s => ({ ...s, end: Math.min(s.end, horizon) })).filter(s => s.end > s.start);
}

export function buildPaths(p, hh, tamp, va, champva, dates) {
    const H = HORIZON_DAYS;
    // Timeline origin: the separation date, or TODAY when the user is already out
    // (a timeline that starts years ago tells them nothing).
    const origin = p.mode === 'out' ? p.today : p.sep;
    const idx = ms => daysBetween(origin, ms);
    const realLossMs = dates.lossOfCoverage ?? addDays(p.sep, 1);
    const loss = Math.max(0, idx(realLossMs));              // first uncovered day index on this timeline
    const lossMs = addDays(origin, loss);
    const sinceLoss = daysBetween(realLossMs, p.today);      // >0 once the loss is in the past
    const jobDay = p.jobStart ? idx(p.jobStart) : null;
    const employerDay = jobDay != null && p.next === 'job' ? Math.max(loss, jobDay + p.waitDays) : null;
    const fehbDay = jobDay != null && p.next === 'gs' ? Math.max(loss, jobDay + 14) : null;
    const shipDay = jobDay != null && p.next === 'school' ? Math.max(loss, jobDay) : null;
    const anchorDay = employerDay ?? fehbDay ?? shipDay;
    const anchorProg = employerDay != null ? 'employer' : fehbDay != null ? 'fehb' : shipDay != null ? 'ship' : null;
    const anchorName = { employer: 'employer plan', fehb: 'FEHB', ship: 'student health plan' }[anchorProg] || '';
    const vetOnVA = va.status === 'yes' || va.status === 'likely';
    // Month-rule start for marketplace / spouse plan: first of the month on or after the loss (or after today, if already out).
    const monthStart = idx(firstOfMonthOnOrAfter(lossMs));
    let marketStart = monthStart, marketNote = null;
    if (sinceLoss > WINDOWS.marketplaceSepDays) { marketStart = idx(nextJan1After(p.today)); marketNote = 'The 60-day special enrollment window has passed; the next marketplace start is January 1 through open enrollment, unless another life event (a birth, a move, a job loss) opens a new window.'; }
    // Coverage already in place at the origin: TAMP (or the last duty day itself).
    const prefixSeg = loss > 0 ? seg(tamp.eligible ? 'tamp' : 'tricare', 0, loss) : [];
    const paths = [];

    const finish = (id, label, familySegs, opts = {}) => {
        if (opts.requires && !familySegs.some(s => s.program === opts.requires)) return; // primary program never appears: redundant path
        const family = fill([...prefixSeg, ...familySegs]);
        // The veteran rides VA on every real path (they should enroll regardless); "do nothing" means nobody enrolled in anything.
        // Family households: the veteran rides VA on every real path (they should enroll regardless). Single veterans: VA is its own path.
        const vetSegs = (opts.vetOnVA ?? (vetOnVA && hh.hasFamilyRow && p.mode !== 'retiring' && id !== 'wait')) ? fill([...prefixSeg, ...seg('va', loss, H)]) : family;
        const costRow = hh.hasFamilyRow ? family : vetSegs;
        const costTier = hh.hasFamilyRow ? 'family' : 'individual';
        const c12 = rowCost(costRow, costTier, p, hh, 365, 0), c24b = rowCost(costRow, costTier, p, hh, 365, 365);
        const gaps = gapDays(hh.hasFamilyRow ? family : vetSegs);
        paths.push({ id, label, segments: { veteran: vetSegs, family: hh.hasFamilyRow ? family : null }, cost12: c12.total, premiums12: c12.premiums, oop12: c12.oop, cost24: c12.total + c24b.total, gapDays: gaps, feasible: opts.feasible !== false, infeasibleWhy: opts.infeasibleWhy || null, blockedKind: opts.feasible === false ? (opts.blockedKind || 'window') : null, notes: opts.notes || [], primary: opts.primary || (familySegs[0]?.program ?? 'uninsured'), tier: costTier });
    };

    if (p.mode === 'retiring') {
        finish('retireeSelect', 'Retiree TRICARE Select', seg('retireeSelect', 1, H), { primary: 'retireeSelect', notes: ['Enroll within 90 days of retirement or you fall to space-available care until open season.'] });
        finish('retireePrime', 'Retiree TRICARE Prime', seg('retireePrime', 1, H), { primary: 'retireePrime', notes: ['Requires living in a Prime Service Area; lower cost shares, less choice.'] });
        if (anchorProg && anchorProg !== 'ship') finish('anchorRetiree', `Retiree TRICARE Select, then ${anchorProg === 'fehb' ? 'FEHB' : 'the employer plan'} as primary`, [...seg('retireeSelect', 1, anchorDay), ...seg(anchorProg, anchorDay, H)], { primary: anchorProg, notes: ['Many retirees keep TRICARE and skip the employer plan entirely; compare the two rows.'] });
        return paths;
    }

    // Baseline: do nothing until the anchor (or ever). Nobody on VA, nobody on a plan.
    const waitGapless = anchorDay != null && anchorDay <= loss;
    finish('wait', waitGapless ? `${anchorName[0].toUpperCase() + anchorName.slice(1)} from day one (no bridge needed)` : anchorProg ? `Wait for the ${anchorName} (uninsured gap)` : 'Do nothing (uninsured)', anchorDay != null ? seg(anchorProg, anchorDay, H) : [], { primary: waitGapless ? anchorProg : 'uninsured', vetOnVA: false, notes: [waitGapless ? 'The new plan starts before coverage ends. Enroll in VA health care anyway; it costs nothing and covers service-connected care for life.' : 'Every day in red is a day one ER visit or one delivery becomes a bill you pay in full.'] });

    const until = anchorDay ?? H;
    const after = anchorDay != null ? seg(anchorProg, anchorDay, H) : [];

    // Single veteran: VA health care is a path of its own (it's the one most eligible single veterans should take).
    if (!hh.hasFamilyRow && !vetOnVA && p.mode !== 'retiring' && (va.status === 'check' || va.status === 'blocked')) finish('va', va.status === 'blocked' ? 'VA health care (closed at your income; file a claim)' : 'VA health care (income-tested; enter income to check)', seg('va', loss, H), { primary: 'va', requires: 'va', vetOnVA: false, feasible: false, infeasibleWhy: va.reason, blockedKind: 'eligibility', notes: [] });
    if (!hh.hasFamilyRow && vetOnVA) finish('va', va.status === 'yes' ? 'VA health care (enroll)' : 'VA health care (enroll; confirm eligibility)', seg('va', loss, H), { primary: 'va', requires: 'va', vetOnVA: false, notes: [...(anchorProg ? ['VA care doesn\'t end when the job starts; the employer plan on top is optional (useful for care outside the VA network).'] : []), va.windowEnd ? `Combat-veteran enhanced enrollment is open until ${fmtDate(va.windowEnd)}. Apply with VA Form 10-10EZ; care for conditions related to that service is copay-free.` : 'Apply with VA Form 10-10EZ. No premiums; copays depend on your priority group.', 'VA care is not an insurance plan: no network outside VA and community care, and it never covers a spouse or child you add later.', ...(p.next === 'school' ? ['Going to school on the GI Bill? Waive the student health plan with your VA enrollment. If the school bills the fee as waivable, the GI Bill generally won\'t pay it and waiving saves your own money; if it\'s billed as mandatory at a private school, it counts against the GI Bill\'s annual cap, so waiving keeps that room for tuition. Confirm with the school certifying official.'] : [])] });

    const med = medicaidEligibility(p, hh);
    if (med.available && !med.unknown && med.household && p.mode !== 'retiring') finish('medicaid', hh.hasFamilyRow ? `Medicaid for the household (${med.state.name})` : `Medicaid (${med.state.name})`, seg('medicaid', loss, H), { primary: 'medicaid', notes: [`At about ${Math.round(med.ratio)}% of the poverty line your household is under ${med.state.name}\'s ${p.children > 0 ? 'parent' : 'adult'} limit (${med.adultLimit}% FPL)${p.children > 0 ? ` and the kids are under the CHIP limit (${med.kidsLimit}% FPL)` : ''}. No enrollment window: apply the month coverage ends; coverage can be retroactive up to 3 months. Report income changes; a new job usually ends it.`] });
    if (champva.eligible) finish('champva', 'CHAMPVA for the family + VA for you', [...seg('champva', loss, H)], { primary: 'champva', notes: ['$0 premium. Apply with VA Form 10-10d the day you have the P&T letter. Processing takes weeks, but coverage is retroactive to the eligibility date, so claims from the first weeks are reimbursed after approval.'] });

    if (p.mode === 'reserve' && p.selres) finish('trs', 'TRICARE Reserve Select', [...seg('trs', loss, until), ...after], { primary: 'trs', requires: 'trs', notes: ['Requires staying in the Selected Reserve. Not available while you\'re eligible for FEHB (that bar lifts Jan 1, 2030).'] });
    if (p.mode === 'reserve' && p.grayArea) finish('trr', 'TRICARE Retired Reserve (gray area)', [...seg('trr', loss, until), ...after], { primary: 'trr', requires: 'trr', notes: ['Full-cost premium; often beaten by a spouse\'s plan or the marketplace.'] });

    if (p.spousePlan) {
        const late = sinceLoss > WINDOWS.hipaaSpecialEnrollDays;
        finish('spouse', "Spouse's employer plan", [...seg('spouse', monthStart, until), ...after], { primary: 'spouse', requires: 'spouse', feasible: !late, infeasibleWhy: late ? 'The 30-day HIPAA special-enrollment window has passed; the next chance is the plan\'s open enrollment or another life event.' : null, notes: [monthStart > loss ? `Coverage starts the 1st of the month after the request (${fmtDate(addDays(origin, monthStart))}); ask HR whether they backdate to the loss date, which closes the ${monthStart - loss}-day gap.` : 'Request enrollment the day TRICARE ends; 30-day HIPAA window.'] });
    }

    const cw = chcbpWindowDays(p, tamp);
    const chcbpLate = sinceLoss > cw;
    const chcbpEnd = Math.min(loss + Math.round(WINDOWS.chcbpMonthsMember * 30.4375), until);
    finish('chcbp', anchorDay != null ? 'CHCBP until the new plan starts' : 'CHCBP (18 months) then the marketplace', [...seg('chcbp', loss, chcbpEnd), ...(anchorDay == null ? seg('marketplace', Math.max(chcbpEnd, marketStart), H) : []), ...after], { primary: 'chcbp', requires: 'chcbp', feasible: !chcbpLate, infeasibleWhy: chcbpLate ? `The ${cw}-day CHCBP election window has passed.` : null, notes: [`Starts the day coverage ends, no first-of-the-month wait. Elect within ${cw} days (DD Form 2837); sold in 90-day blocks, paid up front.`] });

    finish('marketplace', anchorDay != null ? 'Marketplace plan until the new plan starts' : 'Marketplace plan', [...seg('marketplace', marketStart, until), ...after], { primary: 'marketplace', requires: 'marketplace', notes: [marketNote || (marketStart > loss ? `Coverage starts the 1st of the month after coverage ends (${fmtDate(addDays(origin, marketStart))}), leaving ${marketStart - loss} uninsured days.${p.mode === 'out' ? '' : ' A last-day-of-the-month separation date erases that.'}` : 'Apply up to 60 days before coverage ends; with a month-end separation the plan starts the very next day.')] });

    return paths;
}

export function bestPath(paths) {
    const feasible = paths.filter(x => x.feasible);
    // "Do nothing" is the risk baseline; it can only be "best" when nothing else is possible.
    const candidates = feasible.filter(x => x.id !== 'wait').length ? feasible.filter(x => x.id !== 'wait') : feasible;
    const gapless = candidates.filter(x => x.gapDays === 0);
    const pool = gapless.length ? gapless : candidates;
    const best = [...pool].sort((a, b) => a.cost12 - b.cost12)[0] || null;
    // "Do nothing" is the risk baseline, not a recommendation, so it never surfaces as the cheaper alternative.
    const cheapestAny = [...feasible].filter(x => x.id !== 'wait').sort((a, b) => a.cost12 - b.cost12)[0] || null;
    const worst = [...feasible].sort((a, b) => b.cost12 - a.cost12)[0] || null;
    return { best, worst, cheapestAny: cheapestAny && best && cheapestAny.id !== best.id ? cheapestAny : null, gaplessExists: gapless.length > 0, spread: best && worst ? worst.cost12 - best.cost12 : 0 };
}

/* ── actions ───────────────────────────────────────────────────────────── */
export function actions(p, hh, tamp, va, champva, dates, cl, best) {
    const A = [];
    const push = (date, title, why, form, urgency = 'normal', extra = {}) => A.push({ date, title, why, form, urgency, ...extra });
    const pre = p.mode !== 'out' && dates.daysToSep > 0;
    if (pre) {
        push(addDays(p.sep, -90), 'Get every procedure, refill, and dental visit done while you\'re still in', 'TRICARE is $0 today. The MRI, the surgery consult, the crown, the 90-day refills: do them before your last day. This is the single biggest dollar lever most people skip.', FORMS.shpe, 'high', { kind: 'start', checklist: [
            'Schedule the Separation History and Physical Exam (DD 2807-1 / DD 2808) 90 to 180 days out. Report every symptom; this is the record your claim is built on.',
            'Dental: get the exam and finish the work now. Know the trade: if your DD-214 certifies a complete exam and all treatment within 90 days of discharge, you lose the VA one-time dental window after separation. Finished treatment in hand beats a window you may not use.',
            '90-day refills of every prescription, and a printed list of each drug, dose, and prescriber for the next doctor.',
            'Specialist referrals, imaging, physical therapy, hearing and vision tests: finish them. Each one is a claim exhibit and a deductible you never pay.',
            'Mental health: get the visits and the diagnosis on the record now. It counts for the claim, and it is far harder to establish later.',
            'Request your complete service treatment records and the DD-214 member 4 copy. Keep digital copies; every plan and the VA will ask.',
            ...(hh.hasFamilyRow ? ['Family: kids\' well-child visits and vaccines, your spouse\'s annual exam, and any OB visits, all scheduled inside the TRICARE window.'] : []),
        ] });
        if (p.ratingNum == null && p.rating !== 'pending') push(addDays(p.sep, -120), 'File your BDD claim (or an Intent to File if the window passed)', 'A rating is the key that unlocks VA care, copay-free care, and at P&T, CHAMPVA for the family.', FORMS.bdd, 'high', { deadline: addDays(p.sep, -WINDOWS.bddWindowCloseDays) });
        if (p.mode === 'retiring') push(addDays(p.sep, -30), 'Update DEERS with your retirement and confirm retiree status shows', 'Retiree TRICARE enrollment keys off DEERS. Fix any error at the ID card office before your last day.', FORMS.deers, 'high');
        else push(addDays(p.sep, -30), 'Update DEERS and confirm what shows for TAMP', tamp.eligible ? 'Your TAMP eligibility should already appear in milConnect. If it doesn\'t, fix it before your last day at the ID card office.' : 'Confirm your separation type in DEERS. If you believe you qualify for TAMP (involuntary or VSI/VSP, Guard/Reserve contingency release after more than 30 days, Title 32 disaster release, stop-loss or a contingency extension, sole survivorship, or a Selected Reserve agreement), get it corrected now, not after.', FORMS.deers, 'high');
        if (p.spousePlan) push(addDays(p.sep, -30), "Tell your spouse's HR the date TRICARE ends", 'Loss of coverage opens a 30-day special enrollment on their plan. Have the DD-214 or a TRICARE termination letter ready as proof, and ask whether coverage can start on the loss date rather than the 1st.', FORMS.spouse, 'high');
    }
    if (p.mode === 'retiring') {
        if (pre) push(addDays(p.sep, -31), 'Enroll in FEDVIP dental (and vision if wanted) BEFORE your retirement date', 'The TRICARE Dental Program ends at retirement and FEDVIP cannot be backdated. The window opens 31 days before and closes 60 days after.', FORMS.fedvip, 'high');
        push(addDays(p.sep, 1), 'Enroll in retiree TRICARE Select or Prime', 'Retiree coverage is not automatic. You have 90 days from the retirement date; enroll on day one so nothing lapses.', FORMS.retiree, 'high');
        if (!pre) push(addDays(p.sep, 30), 'Enroll in FEDVIP dental (and vision if wanted)', 'Window closes 60 days after retirement; coverage starts on enrollment, not retroactively.', FORMS.fedvip, 'normal');
        if (va.status !== 'check' && va.status !== 'blocked') push(addDays(p.sep, 7), 'Apply for VA health care', 'Even with TRICARE, enrolling gives you VA care for service-connected conditions at no cost and locks in your priority group.', FORMS.va1010, 'normal');
        return A.map(a => ({ ...a, date: Math.max(a.date, p.today), overdue: a.date < p.today && a.kind !== 'start', startNow: a.date < p.today && a.kind === 'start' })).sort((a, b) => a.date - b.date);
    }
    push(pre ? addDays(p.sep, -14) : p.sep, pre ? 'Apply for VA health care as soon as you have separation orders (you, not the family)' : 'Apply for VA health care (you, not the family)', va.reason + (pre ? ' You can apply before your date; enrollment takes effect after separation.' : ''), FORMS.va1010, va.status === 'check' || va.status === 'blocked' ? 'normal' : 'high');
    if (champva.eligible) push(p.sep, 'Apply for CHAMPVA for your spouse and children', champva.reason + ' Processing takes weeks; bridge with TAMP or a short marketplace plan if needed.', FORMS.champva, 'high');
    const loss = dates.lossOfCoverage;
    if (best) {
        const map = {
            spouse: [addDays(loss, 0), "Add the family to your spouse's plan", '30-day HIPAA window from the day TRICARE/TAMP ends. Request it the same day; coverage starts the 1st of the following month unless HR backdates.', FORMS.spouse],
            chcbp: [addDays(loss, 1), 'Elect CHCBP', `Within ${chcbpWindowDays(p, tamp)} days of losing coverage; first 90-day block due with the application. Coverage is effective the day TRICARE ended.`, FORMS.chcbp],
            marketplace: [addDays(loss, -45), 'Apply on the marketplace so the plan starts the 1st of the month after coverage ends', 'You can apply up to 60 days before the loss. Pick the plan before your last day; coverage starts the first of the following month.', FORMS.market],
            trs: [addDays(loss, -30), 'Enroll in TRICARE Reserve Select', 'Enroll before TAMP ends so TRS starts the next day.', FORMS.trs],
            trr: [addDays(loss, -30), 'Enroll in TRICARE Retired Reserve', 'Purchase before TAMP ends to avoid a gap.', FORMS.trr],
            employer: [p.jobStart || loss, 'Enroll in your employer plan on day one', 'Waiting periods are capped at 90 days; ask for the effective date in writing.', FORMS.employer],
            fehb: [p.jobStart || loss, 'Elect FEHB in your first week', 'Coverage starts the first pay period after election.', FORMS.fehb],
            ship: [addDays(p.jobStart || loss, -14), 'Enroll in the student health plan, or waive it if the VA covers you', 'Ask the student health center whether the school offers one and what the enrollment deadline is (usually add/drop). Budget the premium: the GI Bill generally doesn\'t pay it.', FORMS.ship],
            uninsured: [loss, 'You have no plan for the family after this date', 'Pick one of the paths above. The marketplace is the fallback that always exists inside 60 days.', FORMS.market],
        }[best.primary];
        if (map && best.primary !== 'champva') push(map[0], map[1], map[2], map[3], 'high');
        if ((best.primary === 'chcbp' || best.primary === 'marketplace' || best.primary === 'spouse') && (p.next === 'job' || p.next === 'gs' || p.next === 'school') && p.jobStart) push(addDays(p.jobStart, p.next === 'school' ? -14 : 1), p.next === 'gs' ? 'Elect FEHB in your first week' : p.next === 'school' ? 'Enroll in the student health plan (or waive it with VA coverage)' : 'Enroll in the employer plan the day you\'re eligible', 'Then drop the bridge plan the day the new one is effective; don\'t pay for two.', p.next === 'gs' ? FORMS.fehb : p.next === 'school' ? FORMS.ship : FORMS.employer, 'normal');
    }
    if (p.next === 'school' && p.jobStart) push(addDays(p.jobStart, -14), (va.status === 'yes' || va.status === 'likely') ? 'Waive the student health plan with your VA enrollment (or enroll if you want the campus network)' : 'Enroll in the student health plan by the add/drop deadline', 'Ask the student health center whether the school offers a plan, the fee, and the waiver deadline, and ask the school certifying official whether the GI Bill will pay it. With VA coverage you can usually waive it and keep the money.', FORMS.ship, 'normal');
    push(addDays(p.sep, 30), 'Use the one-time VA dental window', 'Within 180 days of discharge, if your DD-214 doesn\'t certify pre-discharge dental care.', FORMS.vaDental, 'normal');
    { const m = medicaidEligibility(p, hh);
      if (m.available && !m.unknown && m.household) push(addDays(loss, -14), `Apply for Medicaid in ${m.state.name}`, `Your household is under the state\'s limit (${m.adultLimit}% of the poverty line). There is no enrollment window and coverage can be retroactive up to 3 months. Report income changes.`, FORMS.medicaid, 'high');
      else if (m.available && !m.unknown && m.kids) push(addDays(loss, -14), `Apply for CHIP for the kids in ${m.state.name}`, `The kids are under ${m.state.name}\'s children\'s limit (${m.kidsLimit}% of the poverty line) even though the adults are not under the Medicaid limit. No enrollment window.`, FORMS.chip, 'high');
      else if (p.children > 0 && p.income > 0 && p.income < fplFor(p, hh) * 2.5) push(addDays(loss, -14), 'Check CHIP for the kids', m.available ? `At about ${Math.round(m.ratio)}% of the poverty line the kids are over ${m.state.name}\'s CHIP limit (${m.kidsLimit}% FPL) on this income; check again if income drops.` : 'A low transition-year income often qualifies children for CHIP even when the parents don\'t qualify for Medicaid. Enter your state in the drawer for the exact limit.', FORMS.chip, 'normal');
      else if (p.children > 0 && !p.income) push(addDays(loss, -14), 'Check CHIP for the kids', 'Enter your transition-year income and state in the drawer: a low year often qualifies children for CHIP even when the parents don\'t qualify for Medicaid.', FORMS.chip, 'normal'); }
    if (p.ratingNum == null) push(addDays(p.sep, 1), 'Lock your effective date with an Intent to File', 'One click on va.gov. Back pay runs from this date once the rating comes through.', FORMS.itf, 'normal');
    push(addDays(p.sep, 60), 'Decide on VGLI before day 240', 'Courtesy reminder: not health coverage, but it\'s the other clock everyone forgets.', FORMS.vgli, 'low');
    // Anything dated in the past becomes "today" (a to-do list never says "31 days ago"); once out, items whose window has closed are dropped.
    const closed = (p.mode === 'out' || dates.daysToSep < 0) ? new Set(cl.filter(c => c.status === 'missed').map(c => c.form?.id)) : new Set();
    return A.filter(a => !(a.form && closed.has(a.form.id)))
        .map(a => ({ ...a, date: Math.max(a.date, p.today), overdue: a.date < p.today && a.kind !== 'start' && !(a.deadline && a.deadline >= p.today), startNow: a.date < p.today && a.kind === 'start' }))
        .sort((a, b) => a.date - b.date);
}

/* ── rating ladder: what each rung changes for the household ───────────── */
export function ratingLadder(p, hh, tamp) {
    const rungs = [['none', 'No rating / pending'], ...(p.ratingNum === 0 ? [['0', '0% service-connected (noncompensable)']] : []), ['10', '10% to 40%'], ['50', '50% to 100% (not P&T)'], ['pt', '100% P&T']];
    return rungs.map(([r, label]) => {
        const q = normalize({ ...p, rating: r, sepDate: iso(p.sep), today: iso(p.today), jobStart: p.jobStart ? iso(p.jobStart) : null });
        const v = vaEligibility(q), c = champvaEligible(q), d = keyDates(q, tamp);
        const paths = buildPaths(q, hh, tamp, v, c, d);
        const b = bestPath(paths).best;
        const current = p.rating === r || (r === 'none' && p.rating === 'pending') || (r === '10' && p.ratingNum != null && p.ratingNum > 0 && p.ratingNum < 50) || (r === '50' && p.ratingNum != null && p.ratingNum >= 50 && p.rating !== 'pt');
        return { r, label, current, va: v, champva: c, bestCost12: b ? b.cost12 : null, bestLabel: b ? b.label : null };
    });
}

/* ── traps ─────────────────────────────────────────────────────────────── */
export function traps(p, hh, tamp, va, dates, paths = []) {
    const T = [];
    if (p.mode === 'retiring') {
        T.push(['Retiree TRICARE is not automatic.', 'Enroll in Prime or Select within 90 days of the retirement date or you fall back to space-available care at military hospitals until the next open season or a qualifying life event. Late enrollment can be made retroactive for up to 12 months, but claims in the gap are your problem until it is.']);
        T.push(['FEDVIP dental cannot be backdated.', 'The TRICARE Dental Program ends at retirement. The FEDVIP window opens 31 days before your date; enroll before it, not after, or the family goes without dental until it starts.']);
        T.push(['Prime vs. Select is locked until open season.', 'Outside a qualifying life event you can\'t switch mid-year. Prime is cheaper if you live in a Prime Service Area and accept a primary care manager; Select buys choice.']);
        T.push(['Medicare Part B is mandatory once you have Part A (usually at 65).', 'TRICARE For Life requires Part A and B. Skip Part B and TRICARE ends; enroll late and the surcharge lasts as long as you have Part B.']);
        T.push(['Enroll in VA health care anyway.', 'Service-connected care at the VA is free at any rating and doesn\'t touch your TRICARE. A rating also drives everything else in the benefits stack.']);
        return T;
    }
    if (!tamp.eligible && p.tampType === 'reserveNone') T.push(['No TAMP without a qualifying activation.', 'The 180 transitional days come only after more than 30 consecutive days of contingency or disaster orders. Leaving the Selected Reserve on drilling status ends TRS with your membership, and the CHCBP window after TRS is 30 days, not 60.']);
    else if (!tamp.eligible && p.mode !== 'retiring') T.push(['TAMP is not for voluntary separations.', 'Only involuntary, VSI/VSP, contingency, stop-loss, sole-survivor, disaster-release, and Selected-Reserve-agreement separations get 180 days. Everyone else\'s coverage ends at 11:59 p.m. on the last duty day.']);
    const monthGap = paths.some(x => x.feasible && x.id !== 'wait' && (x.primary === 'marketplace' || x.primary === 'spouse') && x.gapDays > 0);
    if (monthGap && dates.daysToSep > 0) {
        if (tamp.eligible) T.push([`TAMP ends mid-month (${fmtDate(dates.lossOfCoverage)}), and the marketplace can\'t start until the 1st.`, 'A marketplace plan or a spouse\'s plan starts the 1st of the month after coverage ends. Bridge those days with CHCBP (effective day one) or TRS, or pick a separation date whose 180th day lands on a month end.']);
        else T.push(['Separate on the last day of the month if you can.', `A marketplace plan or a spouse's plan starts the 1st of the month after coverage ends. A mid-month date leaves a gap until the 1st; a month-end date makes the new plan start the very next day.`]);
    }
    T.push([`CHCBP's ${chcbpWindowDays(p, tamp)}-day window starts when coverage ends, not when you notice.`, 'It\'s the only continuation that is effective the day TRICARE ends, and it\'s expensive: sold in 90-day blocks, paid up front.']);
    if (!hh.hasFamilyRow) T.push(['VA health care never covers a spouse or kids.', 'If that changes, the only VA family coverage is CHAMPVA, and it requires 100% P&T.']);
    if (p.spouse && !p.spousePlan) T.push(['Your spouse\'s employer plan gives you 30 days, not 60.', 'HIPAA special enrollment for loss of coverage is 30 days, and coverage starts the 1st of the month after the request unless the employer backdates it. Ask before you separate.']);
    if (hh.hasFamilyRow) { /* the dependents card carries the dental line */ }
    else if (p.mode === 'reserve') T.push(['Dental: you keep it through TAMP, the family buys it.', 'Guard and Reserve members keep military dental clinic care and ADDP for the 180 TAMP days; your family can purchase the TRICARE Dental Program at any time. After TAMP, the VA gives one-time dental within 180 days if your DD-214 doesn\'t certify pre-discharge care.']);
    else T.push(['Dental ends on day one, TAMP or not.', 'The TRICARE Dental Program for families ends on the separation date even during TAMP. The VA gives one-time dental within 180 days if your DD-214 doesn\'t certify pre-discharge care.']);
    if (dates.daysToSep > 0) T.push(['Do the surgery, the MRI, the crown, and the refills while you\'re in.', 'Every procedure you finish before your last day is a procedure you don\'t pay a deductible on.']);
    if (va.status === 'check' || va.status === 'blocked') T.push(['An unrated, non-combat veteran with a decent salary may not be able to enroll in VA care at all.', 'Priority Group 8 enrollment is closed more than 10% above the income limit. A compensable rating (10% or higher), or any qualifying deployment or exposure, fixes this. File now.']);
    if (p.next === 'school') T.push(['Not every school has a student health plan, and the GI Bill usually won\'t pay for it.', 'Four-year and private universities mostly do (often mandatory unless waived); community colleges and online schools mostly don\'t. Whether the GI Bill pays the fee depends on how the school bills it: waivable fees generally aren\'t paid; a mandatory fee at a private school counts against the annual cap. If the VA covers you, waive it and keep the money either way. Ask the school certifying official.']);
    if (p.pregnant) T.push(['A pregnancy is a pre-existing condition that no ACA or employer plan can deny.', 'But a gap month is a gap month. Line the start date up with the day TRICARE ends, and check which hospital is in the new network before the due date. A birth after separation is its own qualifying event, and marketplace coverage for the baby backdates to the birth.']);
    return T;
}

/* ── spouse-owned actions: things only the spouse can do ───────────────── */
export function spouseActions(p, hh, tamp, va, champva, dates) {
    if (!p.spouse) return [];
    const A = [];
    const loss = dates.lossOfCoverage ?? addDays(p.sep, 1);
    const push = (date, title, why, form, urgency = 'normal') => A.push({ date: Math.max(date, p.today), title, why, form, urgency });
    if (p.spousePlan) push(loss, 'Request special enrollment at YOUR HR the day TRICARE ends', 'Loss of coverage gives you 30 days under HIPAA to add the family to your employer plan. Coverage starts the 1st of the month after the request unless HR backdates it; ask them to.', FORMS.spouse, 'high');
    else push(addDays(p.sep, -45), 'Ask your own HR whether you have an employer plan the family can join', 'If you work and your employer offers coverage, it is usually the cheapest family path and the one your veteran cannot set up for you.', FORMS.spouse, 'high');
    push(addDays(p.sep, -14), 'Get the proof-of-loss documents into your hands', 'A copy of the DD-214 and a TRICARE termination letter. Every plan you apply to (your employer, the marketplace, CHAMPVA) will ask for proof that coverage ended and when.', null, 'high');
    if (champva.eligible) push(p.sep, 'Gather what CHAMPVA asks for and file the 10-10d', 'The P&T rating letter, your marriage certificate, each child\'s birth certificate, and everyone\'s Social Security numbers. Either of you can file; you are usually the one who has the paperwork.', FORMS.champva, 'high');
    if (p.pregnant) push(addDays(loss, -30), 'Confirm your OB and delivery hospital are in the new plan\'s network', 'No plan can deny a pregnancy, but a network change mid-pregnancy can. Check before the plan starts, not after.', FORMS.market, 'high');
    if (p.children > 0) push(addDays(loss, -30), 'Line up the kids\' pediatrician and prescriptions under the new plan', 'Get 90-day refills while TRICARE still pays. Ask the pediatrician which of the plans you are choosing between they take.', null, 'normal');
    if (p.children > 0 && p.income > 0 && p.income < (ACA.fpl.base + ACA.fpl.perPerson * hh.size) * 2.5) push(addDays(loss, -14), 'Apply for CHIP for the kids', 'A low transition-year income often qualifies children even when the parents don\'t qualify for Medicaid, and there is no enrollment window.', FORMS.chip, 'normal');
    push(addDays(loss, -45), 'You can do the marketplace application for the whole household', 'Apply up to 60 days before coverage ends so the plan starts the 1st of the month after the loss. List your veteran too if VA care is not certain for them yet.', FORMS.market, 'normal');
    return A.sort((a, b) => a.date - b.date);
}

/* ── per-dependent explainer ───────────────────────────────────────────── */
export function dependentNotes(p, hh, tamp, va, champva) {
    if (!hh.hasFamilyRow) return [];
    const N = [];
    if (p.mode === 'retiring') {
        if (p.spouse) N.push(['Your spouse', 'Keeps TRICARE as a retiree family member once you enroll in Prime or Select (90 days from the retirement date). Enrollment fees and cost shares change; coverage does not lapse.']);
        if (p.children > 0) N.push([p.children === 1 ? 'Your child' : 'Your children', 'Covered under your retiree TRICARE to 21 (23 as full-time students), then TRICARE Young Adult to 26 for a monthly premium.']);
        N.push(['Dental for the family', 'The TRICARE Dental Program ends at retirement. FEDVIP replaces it, and it is not retroactive: enroll before the retirement date (the window opens 31 days before) or the family has a dental gap.']);
        return N;
    }
    const past = p.mode === 'out';
    const ends = tamp.eligible ? (past ? 'when TAMP ended' : 'when TAMP ends') : 'at 11:59 p.m. on the last duty day';
    if (p.spouse) N.push(['Your spouse', `TRICARE ${past ? 'ended' : 'ends'} ${ends}. VA health care never covers a spouse. ${champva.eligible ? 'At 100% P&T, CHAMPVA covers them at $0 premium.' : 'The usual answers are their own employer plan (30-day window), the marketplace, or CHCBP as a bridge; CHAMPVA only if the rating reaches 100% P&T.'}`]);
    if (p.children > 0) N.push([p.children === 1 ? 'Your child' : 'Your children', `${p.spouse ? 'Same cliff as the spouse' : 'TRICARE ' + (past ? 'ended ' : 'ends ') + ends + ' and VA care never covers them'}, plus two things kids get that adults don\'t: CHIP in a low-income year, with no enrollment window, and the right to stay on a parent\'s plan until 26 once one exists. ${champva.eligible ? 'CHAMPVA covers them to 18, or 23 as full-time students.' : ''}`]);
    if (p.pregnant) N.push(['A baby on the way', 'No ACA or employer plan can deny a pregnancy. A birth after separation is its own qualifying event for the marketplace and for employer plans, and marketplace coverage for the newborn backdates to the birth date. Line up the delivery hospital in the new network before the due date.']);
    if (p.treatment) N.push(['Anyone in ongoing treatment', 'Pre-existing conditions cannot be excluded, but networks can change. Ask each plan you are comparing whether the current specialist is in network, and get 90-day refills while TRICARE still pays.']);
    N.push(['Dental for the family', p.mode === 'reserve' ? 'Guard and Reserve families can buy the TRICARE Dental Program at any time, TAMP or not. After that, dental has to be bought separately (employer, marketplace dental, or a standalone plan); CHAMPVA has no dental.' : 'The TRICARE Dental Program ends on the separation date, even during TAMP. Family dental has to be bought separately (employer, marketplace dental, or a standalone plan); CHAMPVA has no dental.']);
    return N;
}

/* ── solve ─────────────────────────────────────────────────────────────── */
export function solve(input) {
    const p = normalize(input);
    const hh = household(p);
    const tamp = tampEligible(p);
    const va = vaEligibility(p);
    p.familyPlanIncludesVet = !(va.status === 'yes' || va.status === 'likely') || !hh.hasFamilyRow;
    const champva = champvaEligible(p);
    const dates = keyDates(p, tamp);
    const cl = clocks(p, tamp, va, champva, dates);
    const paths = buildPaths(p, hh, tamp, va, champva, dates);
    const bp = bestPath(paths);
    const act = actions(p, hh, tamp, va, champva, dates, cl, bp.best);
    const ladder = ratingLadder(p, hh, tamp);
    const market = marketplacePremium(p, hh.tier, hh);
    const medicaid = medicaidEligibility(p, hh);
    const spouse = spouseActions(p, hh, tamp, va, champva, dates);
    const dependents = dependentNotes(p, hh, tamp, va, champva);
    return { p, hh, tamp, va, champva, dates, spouseActions: spouse, dependentNotes: dependents, medicaid, origin: p.mode === 'out' ? p.today : p.sep, clocks: cl, paths, best: bp.best, worst: bp.worst, cheapestAny: bp.cheapestAny, spread: bp.spread, gaplessExists: bp.gaplessExists, actions: act, ladder, traps: traps(p, hh, tamp, va, dates, paths), market, runwayDays: tamp.eligible ? WINDOWS.tampDays : (p.mode === 'retiring' ? Infinity : 0) };
}
