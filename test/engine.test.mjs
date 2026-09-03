/**
 * Transition Health Coverage Bridge engine tests.  node transition-health/test/engine.test.mjs  (from tbv-tools/)
 */
import process from 'node:process';
import { WINDOWS, PROGRAMS, TAMP_CATEGORIES } from '../data/rules.js';
import { BENCHMARK_40_2026 as BENCH } from '../data/marketplace-benchmarks-2026.js';
import { STATE_MEDICAID as SM } from '../data/state-medicaid-2026.js';
import { solve, normalize, parseDate, addDays, daysBetween, iso, tampEligible, vaEligibility, champvaEligible, costShare, marketplacePremium, household, HORIZON_DAYS } from '../data/engine.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL  ' + msg); } };
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const TODAY = '2026-09-02';
const base = { today: TODAY, sepDate: '2026-12-01', spouse: true, children: 1, combat: 'no', rating: 'none', next: 'job', jobStart: '2027-01-15' };

// --- dates ---------------------------------------------------------------
ok(iso(parseDate('2026-12-01')) === '2026-12-01', 'parse/iso round trip');
ok(daysBetween(parseDate('2026-12-01'), addDays(parseDate('2026-12-01'), 180)) === 180, 'addDays/daysBetween');
ok(parseDate('garbage') === null, 'bad date → null');

// --- TAMP ----------------------------------------------------------------
ok(tampEligible(normalize({ mode: 'voluntary' })).eligible === false, 'voluntary ETS: no TAMP');
ok(tampEligible(normalize({ mode: 'involuntary' })).eligible === true, 'involuntary: TAMP');
ok(tampEligible(normalize({ mode: 'reserve' })).eligible === true, 'reserve off contingency orders: TAMP');
ok(tampEligible(normalize({ mode: 'retiring' })).eligible === false, 'retiring: not TAMP');
ok(tampEligible(normalize({ mode: 'voluntary', tampType: 'selres' })).eligible === true, 'voluntary + Selected Reserve agreement: TAMP');
ok(tampEligible(normalize({ mode: 'voluntary', tampType: 'bogus' })).eligible === false, 'unknown tampType falls back to mode default');
ok(TAMP_CATEGORIES.voluntary.eligible === false && TAMP_CATEGORIES.retiree.eligible === false, 'rules: voluntary + retiree not eligible');

// --- VA ------------------------------------------------------------------
ok(vaEligibility(normalize({ rating: '70' })).group === 1 && vaEligibility(normalize({ rating: '70' })).copays === 'none', '70% → PG1, no copays');
ok(vaEligibility(normalize({ rating: '30' })).group === 2 && vaEligibility(normalize({ rating: '30' })).copays === 'meds', '30% → PG2, no care copays, meds copays remain');
ok(vaEligibility(normalize({ rating: 'none', combat: 'no', spouse: true, income: 50000 })).status === 'likely', 'unrated non-combat, $50K w/ spouse: under $52K limit → likely');
ok(vaEligibility(normalize({ rating: 'none', combat: 'no', spouse: true, income: 56000 })).status === 'likely' && vaEligibility(normalize({ rating: 'none', combat: 'no', spouse: true, income: 56000 })).group === 8, 'within 10% over the limit → PG8b/d, still enrolls');
ok(vaEligibility(normalize({ rating: 'none', combat: 'no', spouse: false, income: 60000 })).status === 'blocked', 'single, $60K, unrated, non-combat → PG 8e/8g closed');
ok(vaEligibility(normalize({ rating: '10' })).group === 3, '10% → PG3');
ok(vaEligibility(normalize({ rating: '0', combat: 'no' })).status === 'check' && /noncompensable/.test(vaEligibility(normalize({ rating: '0', combat: 'no' })).reason), '0% noncompensable is income-tested, not PG6 (audit A1)');
ok(vaEligibility(normalize({ rating: '0', combat: 'no', income: 30000 })).group === 5, '0% under the limit → PG5');
ok(vaEligibility(normalize({ rating: 'none', combat: 'no', spouse: true, income: 50000 })).group === 5, 'under the national limit → PG5, not PG7 (audit A2)');
ok(vaEligibility(normalize({ rating: '0', combat: 'yes' })).status === 'yes' && vaEligibility(normalize({ rating: '0', combat: 'yes' })).group === 6, '0% + combat → PG6 via combat, not via the rating');
ok(costShare('retireeSelect', 'family', 1000000, normalize({ retireeGroup: 'B' })) === PROGRAMS.retireeCapB && costShare('retireeSelect', 'family', 1000000, normalize({ retireeGroup: 'A' })) === PROGRAMS.retireeSelect.oopMax.family, 'Group B retiree cap $4,635 swaps in (audit A6)');
ok(PROGRAMS.trs.oopMax.family === 1324, 'TRS cat cap is the 2026 figure (audit A4)');
ok(/2807/.test(FORMS_SHPE_ID()), 'SHPE form is DD 2807-1 / DD 2808, not DD 2796 (audit A7)');
function FORMS_SHPE_ID() { return solve({ ...base }).actions.find(a => /procedure/.test(a.title)).form.id; }
ok(vaEligibility(normalize({ rating: 'pt' })).group === 1, 'P&T → PG1');
ok(vaEligibility(normalize({ rating: 'none', combat: 'yes' })).status === 'yes' && vaEligibility(normalize({ rating: 'none', combat: 'yes' })).windowEnd != null, 'combat, unrated → yes with 10-yr window');
ok(vaEligibility(normalize({ rating: 'none', combat: 'unsure' })).status === 'likely', 'unsure combat → likely');
ok(vaEligibility(normalize({ rating: 'none', combat: 'no' })).status === 'check' && vaEligibility(normalize({ rating: 'none', combat: 'no' })).group === 8, 'no rating, no combat → PG8 check');
ok(vaEligibility(normalize({ rating: 'pending', combat: 'no' })).status === 'check', 'pending rating treated like none for enrollment');
{
    const v = vaEligibility(normalize({ ...base, combat: 'yes' }));
    ok(iso(v.windowEnd) === '2036-12-01', 'combat window = exactly 10 calendar years from separation');
    ok(iso(vaEligibility(normalize({ sepDate: '2018-06-18', combat: 'yes' })).windowEnd) === '2028-06-18', 'Zak: window closes June 18, 2028');
}

// --- CHAMPVA -------------------------------------------------------------
ok(champvaEligible(normalize({ rating: 'pt' })).eligible === true, 'P&T → CHAMPVA');
ok(champvaEligible(normalize({ rating: '100' })).eligible === false, '100% schedular (not P&T) → no CHAMPVA');
ok(champvaEligible(normalize({ rating: 'pt', mode: 'retiring' })).eligible === false, 'retiree P&T → TRICARE bar');

// --- household ------------------------------------------------------------
ok(household(normalize({ spouse: false, children: 0 })).tier === 'individual', 'single → individual tier');
ok(household(normalize({ spouse: true, children: 2 })).size === 4 && household(normalize({ spouse: true, children: 2 })).tier === 'family', 'family of 4');

// --- cost share ------------------------------------------------------------
ok(costShare('uninsured', 'family', 20000) === 20000, 'uninsured pays all');
ok(costShare('va', 'individual', 20000) === 0, 'VA modeled at $0 cost share');
ok(costShare('champva', 'family', 100000) === 3000, 'CHAMPVA family cap $3,000');
ok(costShare('marketplace', 'family', 1000000) === PROGRAMS.marketplace.oopMax.family, 'ACA family OOP max binds');
ok(near(costShare('employer', 'family', 5000), 3500 + 0.2 * 1500), 'employer: deductible + 20%');

// --- marketplace subsidy ---------------------------------------------------
{
    const hh = household(normalize({ spouse: true, children: 1 }));
    const noInc = marketplacePremium(normalize({}), 'family', hh);
    ok(noInc.estimated && noInc.subsidized === false, 'no income → unsubsidized benchmark');
    const mid = marketplacePremium(normalize({ spouse: true, children: 1, income: 50000 }), 'family', hh);
    ok(mid.subsidized === true && mid.monthly < noInc.monthly, '$50K family of 3 → subsidized below benchmark');
    const rich = marketplacePremium(normalize({ spouse: true, children: 1, income: 200000 }), 'family', hh);
    ok(rich.subsidized === false, '$200K → above 400% FPL, no credit (standard schedule)');
    const manual = marketplacePremium(normalize({ marketMonthly: 812 }), 'family', hh);
    ok(manual.monthly === 812 && manual.estimated === false, 'entered premium wins');
}

// --- solve: voluntary ETS, spouse + child, job in 6 weeks -----------------
{
    const r = solve({ ...base, mode: 'voluntary' });
    ok(r.tamp.eligible === false, 'voluntary: no TAMP');
    ok(r.runwayDays === 0, 'runway 0 days');
    ok(r.dates.lossOfCoverage === addDays(r.p.sep, 1) && r.dates.lossIdx === 1, 'first uncovered day = day after the last duty day');
    ok(r.dates.sepIsMonthEnd === false, 'Dec 1 is not month-end');
    const ids = r.paths.map(x => x.id);
    ok(ids.includes('wait') && ids.includes('chcbp') && ids.includes('marketplace'), 'baseline + CHCBP + marketplace paths');
    ok(!ids.includes('spouse'), 'no spouse-plan path without the toggle');
    ok(!ids.includes('champva') && !ids.includes('trs') && !ids.includes('retireeSelect'), 'no CHAMPVA/TRS/retiree paths in this profile');
    const wait = r.paths.find(x => x.id === 'wait');
    ok(wait.gapDays === daysBetween(r.p.sep, addDays(r.p.jobStart, 30)) - 1, 'wait path gap = uncovered days until employer plan starts (30-day wait)');
    ok(wait.segments.family[0].program === 'tricare' && wait.segments.family.some(s => s.program === 'uninsured') && wait.segments.family.some(s => s.program === 'employer'), 'wait path: last duty day, uninsured, then employer');
    const chcbp = r.paths.find(x => x.id === 'chcbp'), market = r.paths.find(x => x.id === 'marketplace');
    ok(chcbp.gapDays === 0, 'CHCBP is gapless (effective the day coverage ends)');
    ok(market.gapDays === 30, 'mid-month separation: marketplace starts Jan 1 → 30 uninsured days');
    ok(market.segments.family.find(s => s.program === 'marketplace').start === 31, 'marketplace segment starts at day 31 (Jan 1)');
    {
        const empIdx = daysBetween(r.p.sep, addDays(r.p.jobStart, 30));
        ok(near(chcbp.premiums12, PROGRAMS.chcbp.premium.family * 3 * 1 + PROGRAMS.employer.premium.family * ((365 - empIdx) / 30.4375), 2), 'CHCBP for a 74-day bridge = one 90-day block ($5,339) + employer premiums after');
    }
    ok(r.best.id === 'chcbp', 'best = cheapest GAPLESS path (CHCBP) even though marketplace is cheaper');
    ok(r.cheapestAny && r.cheapestAny.id === 'marketplace' && r.cheapestAny.cost12 < r.best.cost12, 'cheapestAny surfaces the cheaper path with the gap');
    ok(r.traps.some(t => /last day of the month/.test(t[0])), 'month-end separation tip shown');
    ok(r.clocks.find(c => c.id === 'chcbp').days === daysBetween(r.p.today, addDays(r.p.sep, 61)), 'CHCBP clock = day after separation + 60');
    ok(r.clocks.find(c => c.id === 'market').opensAt === addDays(r.p.sep, 1 - 60), 'marketplace SEP opens 60 days before the loss');
    ok(!r.clocks.find(c => c.id === 'spouse'), 'no spouse clock without spouse plan');
    ok(r.clocks.find(c => c.id === 'dental').days === daysBetween(r.p.today, addDays(r.p.sep, 180)), 'VA dental clock = sep + 180');
    ok(r.clocks.find(c => c.id === 'bdd').status === 'closing' && r.clocks.find(c => c.id === 'bdd').days === 0, 'BDD window closes today (sep is exactly 90 days out)');
    ok(r.va.status === 'check', 'unrated non-combat: PG8 check');
    ok(r.best.segments.veteran === r.best.segments.family, 'veteran rides the family plan when VA status is check');
    ok(r.actions.some(a => /BDD/.test(a.title)) && r.actions.some(a => /procedure/.test(a.title)), 'pre-separation actions present');
    ok(r.actions.every((a, i, arr) => i === 0 || a.date >= arr[i - 1].date), 'actions sorted by date');
    ok(r.traps.some(t => /TAMP is not for voluntary/.test(t[0])), 'TAMP trap shown for voluntary');
    ok(r.ladder.length === 4 && r.ladder[3].champva.eligible === true, 'ladder: P&T rung unlocks CHAMPVA');
    ok(r.ladder[3].bestCost12 < r.ladder[0].bestCost12, 'P&T rung is cheaper for the household than no rating');
}

// --- involuntary: TAMP shifts every clock --------------------------------
{
    const r = solve({ ...base, mode: 'involuntary', jobStart: '2027-08-01' });
    ok(r.tamp.eligible && r.runwayDays === 180, 'involuntary: TAMP 180 days');
    ok(iso(r.dates.tampEnd) === '2027-05-29', 'last TAMP day = sep + 179 (180 days beginning on the separation date)');
    ok(r.dates.lossOfCoverage === addDays(r.dates.tampEnd, 1) && iso(r.dates.lossOfCoverage) === '2027-05-30', 'first uncovered day = sep + 180');
    ok(r.clocks.find(c => c.id === 'chcbp').date === addDays(r.dates.lossOfCoverage, 60), 'CHCBP window runs from the first uncovered day');
    ok(r.paths.every(x => x.segments.family[0].program === 'tamp' && x.segments.family[0].end === 180), 'every path starts with the TAMP segment');
    const wait = r.paths.find(x => x.id === 'wait');
    ok(wait.gapDays === daysBetween(r.dates.lossOfCoverage, addDays(r.p.jobStart, 30)), 'gap counted only after TAMP (from the first uncovered day)');
}

// --- spouse plan toggle + 30-day clock ------------------------------------
{
    const r = solve({ ...base, mode: 'voluntary', spousePlan: true, spousePlanMonthly: 400 });
    ok(r.paths.some(x => x.id === 'spouse'), 'spouse path present');
    const sp = r.paths.find(x => x.id === 'spouse');
    const empIdx = daysBetween(r.p.sep, addDays(r.p.jobStart, 30));
    ok(near(sp.premiums12, 400 * ((empIdx - 31) / 30.4375) + PROGRAMS.employer.premium.family * ((365 - empIdx) / 30.4375), 5), 'spouse path premiums = entered premium from Jan 1 until employer start, then employer');
    ok(sp.gapDays === 30, 'spouse plan also waits for the 1st (HIPAA first-of-month rule)');
    ok(r.clocks.find(c => c.id === 'spouse').date === addDays(r.p.sep, 31), 'spouse plan clock = 30 days after the loss');
}

// --- month-end separation: marketplace starts next day and wins ------------
{
    const r = solve({ ...base, mode: 'voluntary', sepDate: '2026-11-30', income: 60000 });
    ok(r.dates.sepIsMonthEnd === true, 'Nov 30 is month-end');
    ok(r.market.subsidized === true, '$60K family of 3 gets a premium credit');
    const market = r.paths.find(x => x.id === 'marketplace');
    ok(market.gapDays === 0 && market.segments.family.find(s => s.program === 'marketplace').start === 1, 'marketplace starts Dec 1, no gap');
    ok(r.best.id === 'marketplace', 'marketplace is the recommended path with a month-end date');
    ok(r.cheapestAny === null, 'no cheaper-with-gap alternative');
    ok(!r.traps.some(t => /last day of the month/.test(t[0])), 'no month-end tip when already month-end');
}

// --- P&T: CHAMPVA wins ----------------------------------------------------
{
    const r = solve({ ...base, mode: 'voluntary', rating: 'pt' });
    ok(r.champva.eligible, 'P&T CHAMPVA eligible');
    ok(r.best.id === 'champva', 'CHAMPVA is the best path at P&T');
    ok(r.best.premiums12 === 0, 'CHAMPVA premiums $0');
    ok(r.best.segments.veteran.some(s => s.program === 'va'), 'veteran on VA');
    ok(r.best.segments.family.some(s => s.program === 'champva'), 'family on CHAMPVA');
}

// --- single veteran, no dependents ----------------------------------------
{
    const r = solve({ ...base, spouse: false, children: 0, rating: '60', mode: 'voluntary' });
    ok(r.hh.hasFamilyRow === false, 'no family row');
    ok(r.best.segments.family === null, 'family segments null');
    ok(r.paths.some(x => x.id === 'va'), 'single rated veteran gets an explicit VA path');
    ok(r.best.id === 'va' && r.best.gapDays === 0 && r.best.cost12 === 0, 'VA path is best: gapless, $0');
    const wait = r.paths.find(x => x.id === 'wait');
    ok(wait.gapDays > 0 && wait.segments.veteran.some(s => s.program === 'uninsured'), '"do nothing" means uninsured, never silently on VA');
    const mk = r.paths.find(x => x.id === 'marketplace');
    ok(mk.segments.veteran.some(s => s.program === 'marketplace'), 'single veteran: marketplace path shows HIM on the marketplace, not VA');
    const fam = solve({ ...base, mode: 'voluntary', rating: '60' });
    ok(!fam.paths.some(x => x.id === 'va'), 'family household: no standalone VA path (VA never covers the family)');
    ok(fam.paths.find(x => x.id === 'wait').segments.veteran.every(s => s.program !== 'va'), 'family "do nothing": veteran not on VA either');
    ok(fam.paths.find(x => x.id === 'chcbp').segments.veteran.some(s => s.program === 'va'), 'family real path: veteran rides VA');
}

// --- Zak's case: single combat vet, no rating, out since 2018 ----------------
{
    const r = solve({ today: TODAY, mode: 'out', sepDate: '2018-06-20', spouse: false, children: 0, combat: 'yes', rating: 'none', next: 'unsure' });
    ok(r.origin === r.p.today, 'out mode: timeline starts today');
    ok(r.va.status === 'yes' && r.va.windowEnd != null && r.va.windowEnd > r.p.today, 'combat window still open (until 2028)');
    ok(r.best.id === 'va', 'best = enroll in VA health care');
    ok(r.best.segments.veteran[0].program === 'va' && r.best.segments.veteran[0].start === 0, 'VA starts today on the timeline');
    const wait = r.paths.find(x => x.id === 'wait');
    ok(wait.gapDays === HORIZON_DAYS && wait.cost12 > 0, 'do nothing = 730 uninsured days with real exposure');
    ok(r.paths.find(x => x.id === 'chcbp').feasible === false, 'CHCBP closed');
    const mk = r.paths.find(x => x.id === 'marketplace');
    ok(mk.segments.veteran.find(s => s.program === 'marketplace').start === daysBetween(r.p.today, parseDate('2027-01-01')), 'marketplace restarts Jan 1 (SEP long gone)');
    ok(r.clocks.find(c => c.id === 'vawindow').status === 'open', 'VA window clock open');
}

// --- reserve --------------------------------------------------------------
{
    const r = solve({ ...base, mode: 'reserve', next: 'gap', jobStart: null });
    ok(r.tamp.eligible, 'reserve contingency: TAMP');
    ok(r.paths.some(x => x.id === 'trs'), 'TRS path present while in Selected Reserve');
    const trs = r.paths.find(x => x.id === 'trs');
    ok(near(trs.premiums12, PROGRAMS.trs.premium.family * ((365 - 180) / 30.4375), 2), 'TRS premiums start after TAMP');
    const r2 = solve({ ...base, mode: 'reserve', selres: false, grayArea: true, next: 'gap' });
    ok(!r2.paths.some(x => x.id === 'trs') && r2.paths.some(x => x.id === 'trr'), 'leaving SelRes + gray area → TRR not TRS');
    const r3 = solve({ ...base, mode: 'reserve', selres: false, tampType: 'voluntary', next: 'gap' });
    ok(r3.tamp.eligible === false && /30 days/.test(r3.clocks.find(c => c.id === 'chcbp').label), 'leaving SelRes without TAMP: CHCBP window is 30 days');
}

// --- retiring: enrollment + FEDVIP clocks ------------------------------------
{
    const r = solve({ ...base, mode: 'retiring', next: 'gap' });
    const ret = r.clocks.find(c => c.id === 'retiree'), fed = r.clocks.find(c => c.id === 'fedvip');
    ok(ret && ret.date === addDays(r.p.sep, 90), 'retiree enrollment clock = 90 days');
    ok(fed && fed.opensAt === addDays(r.p.sep, -31) && fed.date === addDays(r.p.sep, 60), 'FEDVIP window: 31 before to 60 after');
    ok(r.actions.some(a => /FEDVIP.*BEFORE/.test(a.title)), 'pre-retirement FEDVIP action');
    const b = solve({ ...base, mode: 'retiring', next: 'gap', retireeGroup: 'B' });
    ok(b.paths.find(x => x.id === 'retireeSelect').premiums12 > r.paths.find(x => x.id === 'retireeSelect').premiums12, 'Group B retiree Select fee is higher');
}

// --- retiring -------------------------------------------------------------
{
    const r = solve({ ...base, mode: 'retiring', next: 'gap' });
    ok(r.runwayDays === Infinity, 'retiree: no gap');
    ok(r.paths.every(x => x.gapDays === 0), 'retiree paths gapless');
    ok(r.paths.some(x => x.id === 'retireeSelect') && r.paths.some(x => x.id === 'retireePrime'), 'Select + Prime paths');
    ok(r.clocks.some(c => c.id === 'fedvip') && !r.clocks.some(c => c.id === 'dental'), 'retiree: FEDVIP clock, no VA one-time dental');
    ok(!r.paths.some(x => x.id === 'chcbp'), 'no CHCBP for retirees');
}

// --- already out ------------------------------------------------------------
{
    const r = solve({ ...base, mode: 'out', sepDate: '2026-06-01', next: 'gap', jobStart: null });
    ok(r.dates.daysSinceSep === 93, '93 days since separation');
    ok(r.clocks.find(c => c.id === 'chcbp').status === 'missed', 'CHCBP window missed at day 93');
    ok(r.clocks.find(c => c.id === 'dental').status === 'open', 'VA dental still open at day 93');
    ok(!r.clocks.some(c => c.id === 'bdd'), 'no BDD clock when already out');
    ok(r.paths.find(x => x.id === 'chcbp').feasible === false, 'CHCBP path marked infeasible after the window');
    const mk = r.paths.find(x => x.id === 'marketplace');
    ok(mk.segments.veteran.find(s => s.program === 'marketplace').start === daysBetween(r.p.today, parseDate('2027-01-01')), 'marketplace restarts Jan 1 after a missed SEP (indexed from today)');
    ok(r.best.id !== 'chcbp', 'best path never picks a closed window');
    const sp = solve({ ...base, mode: 'out', sepDate: '2026-06-01', spousePlan: true, next: 'gap', jobStart: null });
    ok(sp.paths.find(x => x.id === 'spouse').feasible === false, 'spouse plan infeasible after 30 days');
}

// --- GS route -------------------------------------------------------------
{
    const r = solve({ ...base, mode: 'voluntary', next: 'gs', jobStart: '2027-01-04' });
    ok(r.paths.some(x => x.segments.family.some(s => s.program === 'fehb')), 'FEHB appears in paths for the GS route');
    ok(r.clocks.some(c => c.id === 'fehb'), 'FEHB election clock');
}

// --- school route: student health plan anchors the path ----------------------
{
    const r = solve({ ...base, mode: 'voluntary', spouse: false, children: 0, combat: 'no', rating: 'none', next: 'school', jobStart: '2027-01-11', shipMonthly: 200 });
    const wait = r.paths.find(x => x.id === 'wait');
    ok(/student health plan/.test(wait.label), 'wait path names the student plan');
    ok(wait.segments.veteran.some(s => s.program === 'ship' && s.start === daysBetween(r.p.sep, r.p.jobStart)), 'student plan starts on the term start date');
    ok(wait.gapDays === daysBetween(r.p.sep, r.p.jobStart) - 1, 'uninsured until the term starts');
    const mk = r.paths.find(x => x.id === 'marketplace');
    ok(mk.segments.veteran.some(s => s.program === 'ship'), 'bridge paths hand off to the student plan');
    ok(near(wait.premiums12, 200 * ((365 - daysBetween(r.p.sep, r.p.jobStart)) / 30.4375), 2), 'entered SHIP premium used');
    ok(r.clocks.some(c => c.id === 'ship'), 'student plan clock present');
    ok(r.traps.some(t => /student health plan/.test(t[0])), 'school trap present');
    const zak = solve({ today: TODAY, mode: 'voluntary', sepDate: '2026-12-01', spouse: false, children: 0, combat: 'yes', rating: 'none', next: 'school', jobStart: '2027-01-11' });
    ok(zak.best.id === 'va', 'combat vet going to school: VA (waive the SHIP) beats paying for the student plan');
}

// --- spouse-owned actions + per-dependent notes --------------------------------
{
    const r = solve({ ...base, mode: 'voluntary', spousePlan: true, pregnant: true, income: 45000 });
    ok(r.spouseActions.length >= 4, 'spouse actions present for a married household');
    ok(r.spouseActions.some(a => /YOUR HR/.test(a.title)), 'HIPAA request at the spouse\'s own HR');
    ok(r.spouseActions.some(a => /proof-of-loss/.test(a.title)), 'proof-of-loss documents');
    ok(r.spouseActions.some(a => /OB and delivery hospital/.test(a.title)), 'pregnancy network check');
    ok(r.spouseActions.some(a => /CHIP/.test(a.title)), 'CHIP for kids at $45K');
    ok(r.spouseActions.every((a, i, arr) => i === 0 || a.date >= arr[i - 1].date) && r.spouseActions.every(a => a.date >= r.p.today), 'spouse actions sorted and never in the past');
    ok(r.dependentNotes.some(([w]) => w === 'Your spouse') && r.dependentNotes.some(([w]) => w === 'Your child') && r.dependentNotes.some(([w]) => /baby/.test(w)) && r.dependentNotes.some(([w]) => /Dental/.test(w)), 'dependent notes: spouse, child, baby, dental');
    const single = solve({ ...base, spouse: false, children: 0 });
    ok(single.spouseActions.length === 0 && single.dependentNotes.length === 0, 'single veteran: no spouse actions, no dependent notes');
    const pt = solve({ ...base, rating: 'pt' });
    ok(pt.spouseActions.some(a => /10-10d/.test(a.title)), 'P&T: spouse gathers CHAMPVA paperwork');
    ok(pt.dependentNotes.find(([w]) => w === 'Your spouse')[1].includes('CHAMPVA covers them'), 'P&T: spouse note says CHAMPVA');
}

// --- fuzz-derived invariants (9/3/26 audit) ------------------------------------
{
    // "Do nothing" is never the recommendation when any other path is possible
    const r = solve({ today: TODAY, mode: 'out', sepDate: '2025-03-10', spouse: false, children: 0, combat: 'no', rating: 'none', next: 'unsure' });
    ok(r.best.id !== 'wait', 'out mode, everything closed: best is the marketplace (Jan 1), not "do nothing"');
    ok(r.best.id === 'marketplace' && r.best.gapDays > 0 && r.gaplessExists === false, 'best carries a gap and gaplessExists is false');
    ok(r.paths.some(x => x.id === 'va' && x.feasible === false && /income-tested/.test(x.label)), 'unrated non-combat single vet sees a VA row marked income-tested, not recommended');
    const b = solve({ today: TODAY, mode: 'out', sepDate: '2025-03-10', spouse: false, children: 0, combat: 'no', rating: 'none', next: 'unsure', income: 150000 });
    ok(b.paths.some(x => x.id === 'va' && x.feasible === false && /closed at your income/.test(x.label)), 'blocked income: VA row labeled closed');
    // CHAMPVA gray area for Selected Reserve families
    const g = solve({ ...base, mode: 'reserve', rating: 'pt', selres: true, next: 'gap' });
    ok(g.champva.eligible === false && g.champva.gray === true, 'SelRes P&T family: CHAMPVA flagged as gray area, not asserted');
    ok(!g.paths.some(x => x.id === 'champva') && g.best.id === 'trs', 'no CHAMPVA path; TRS recommended');
    const v = solve({ ...base, mode: 'voluntary', rating: 'pt' });
    ok(v.champva.eligible === true && v.best.id === 'champva', 'voluntary P&T family: CHAMPVA still eligible and best');
    // 0% rung
    const z = solve({ ...base, rating: '0', spouse: false, children: 0 });
    ok(z.ladder.filter(l => l.current).length === 1 && z.ladder.find(l => l.current).r === '0', '0% SC gets its own ladder rung marked current');
    ok(solve({ ...base, rating: '30' }).ladder.length === 4 && solve({ ...base, rating: '30' }).ladder.filter(l => l.current).length === 1, 'non-zero ratings: 4 rungs, exactly one current');
}

// --- scenario-audit invariants (9/3/26, nine rendered scenarios) ---------------
{
    // waiting period 0 is honored
    const w0 = solve({ ...base, waitDays: 0, jobStart: '2027-01-15' }), w30 = solve({ ...base, waitDays: 30, jobStart: '2027-01-15' });
    ok(w0.p.waitDays === 0 && w30.p.waitDays === 30, 'waitDays 0 is not treated as "unset"');
    ok(w0.paths.find(x => x.id === 'wait').gapDays < w30.paths.find(x => x.id === 'wait').gapDays, 'zero waiting period shortens the gap');
    // no action is ever dated in the past
    for (const inp of [{ ...base, mode: 'voluntary', sepDate: '2026-10-01' }, { ...base, mode: 'reserve', sepDate: '2026-09-20' }, { ...base, mode: 'retiring', sepDate: '2026-09-30' }]) {
        const r = solve(inp);
        ok(r.actions.every(a => a.date >= r.p.today), `no past-dated actions (${inp.mode})`);
        ok(r.actions.some(a => a.overdue), `overdue flag set when the ideal date has passed (${inp.mode})`);
    }
    // retiring: no TAMP action, retiree-specific dependents + traps
    const ret = solve({ ...base, mode: 'retiring', children: 1, next: 'gap' });
    ok(!ret.actions.some(a => /TAMP/.test(a.title)), 'retiree: no TAMP action');
    ok(ret.dependentNotes.some(([w, t]) => w === 'Your spouse' && /retiree family member/.test(t)), 'retiree: spouse note says TRICARE continues');
    ok(ret.dependentNotes.some(([w, t]) => /child/.test(w) && /Young Adult/.test(t)), 'retiree: child note mentions TYA');
    ok(ret.traps.some(t => /Part B/.test(t[0])) && !ret.traps.some(t => /CHCBP/.test(t[0])), 'retiree traps: Part B present, CHCBP absent');
    // reserve: "not coming off qualifying orders" means no TAMP
    const rn = solve({ ...base, mode: 'reserve', tampType: 'reserveNone', selres: false, grayArea: true, next: 'gap' });
    ok(rn.tamp.eligible === false, 'reserveNone: no TAMP');
    ok(/30 days/.test(rn.clocks.find(c => c.id === 'chcbp').label), 'reserveNone leaving SelRes: 30-day CHCBP window');
    // ladder label for 100% schedular
    const s100 = solve({ ...base, rating: '100' });
    ok(s100.ladder.find(l => l.current).label === '50% to 100% (not P&T)', '100% schedular sits in the 50–100 (not P&T) rung');
    // month-end tip only when a month-rule gap actually exists; TAMP wording when TAMP
    ok(!solve({ ...base, mode: 'voluntary', next: 'gs', jobStart: '2026-11-15' }).traps.some(t => /last day of the month/.test(t[0])), 'no month-end tip when FEHB starts before separation');
    const tampTip = solve({ ...base, mode: 'involuntary', sepDate: '2026-10-15', next: 'gap' }).traps.find(t => /TAMP ends mid-month/.test(t[0]));
    ok(!!tampTip, 'TAMP case: tip is about the TAMP end date');
    // children-without-spouse wording
    const kidsOnly = solve({ ...base, spouse: false, children: 2 });
    ok(!/Same cliff as the spouse/.test(kidsOnly.dependentNotes.find(([w]) => /child/.test(w))[1]), 'kids-only household: no reference to a spouse');
}

// --- marketplace pricing from the state benchmark + federal age curve (9/3/26) ---
{
    const hh2 = household(normalize({ spouse: true, children: 0 }));
    const tx = marketplacePremium(normalize({ state: 'TX', spouse: true, children: 0, vetAge: 40, spouseAge: 40 }), 'family', hh2);
    ok(tx.basis === 'state' && near(tx.monthly, 2 * BENCH.TX, 1), 'TX couple both 40: 2 × state benchmark');
    const older = marketplacePremium(normalize({ state: 'TX', spouse: true, children: 0, vetAge: 60, spouseAge: 60 }), 'family', hh2);
    ok(older.monthly > tx.monthly * 1.8, 'age 60 costs far more than 40 (federal curve)');
    const hh4 = household(normalize({ spouse: true, children: 5 }));
    const kids5 = marketplacePremium(normalize({ state: 'TX', spouse: true, children: 5, vetAge: 40, spouseAge: 40 }), 'family', hh4);
    const kids3 = marketplacePremium(normalize({ state: 'TX', spouse: true, children: 3, vetAge: 40, spouseAge: 40 }), 'family', household(normalize({ spouse: true, children: 3 })));
    ok(near(kids5.monthly, kids3.monthly, 0.01), 'only three children are charged');
    const ny40 = marketplacePremium(normalize({ state: 'NY', vetAge: 40 }), 'individual', household(normalize({})));
    const ny60 = marketplacePremium(normalize({ state: 'NY', vetAge: 60 }), 'individual', household(normalize({})));
    ok(near(ny40.monthly, ny60.monthly, 0.01) && ny40.bf.noAge === true, 'NY: no age rating, same price at 40 and 60');
    const none = marketplacePremium(normalize({ vetAge: 40 }), 'individual', household(normalize({})));
    ok(none.basis === 'national', 'no state → national average benchmark, labeled');
    const quote = marketplacePremium(normalize({ state: 'TX', marketMonthly: 500 }), 'individual', household(normalize({})));
    ok(quote.monthly === 500 && quote.estimated === false, 'entered quote overrides the benchmark');
    // VA-covered veteran is left off the family plan when pricing it
    const r = solve({ ...base, state: 'TX', rating: '60', vetAge: 35, spouseAge: 35 });
    ok(r.p.familyPlanIncludesVet === false && r.market.bf.members === 2, 'rated veteran on VA: family marketplace plan priced for spouse + child only');
    const r2 = solve({ ...base, state: 'TX', rating: 'none', combat: 'no', vetAge: 35, spouseAge: 35 });
    ok(r2.p.familyPlanIncludesVet === true && r2.market.bf.members === 3, 'unrated veteran: priced for all three');
}

// --- Medicaid / CHIP from the state table (9/3/26) ---------------------------
{
    const exp = Object.entries(SM).find(([k, v]) => v.expansion && v.parentsPctFpl === 138 && v.chipUpperPctFpl >= 200)?.[0];
    const non = Object.entries(SM).find(([k, v]) => !v.expansion && v.parentsPctFpl != null && v.parentsPctFpl < 60 && v.chipUpperPctFpl >= 150)?.[0];
    ok(!!exp && !!non, `found an expansion state (${exp}) and a non-expansion state (${non}) in the table`);
    // family of 3 at ~90% FPL
    const fpl3 = 15650 + 5500 * 2;
    const lowInc = Math.round(fpl3 * 0.9);
    const e = solve({ ...base, state: exp, income: lowInc, combat: 'no' });
    ok(e.medicaid.available && e.medicaid.household === true, `${exp}: family of 3 at 90% FPL qualifies for Medicaid`);
    ok(e.paths.some(x => x.id === 'medicaid') && e.best.id === 'medicaid' && e.best.cost12 === 0 && e.best.gapDays === 0, `${exp}: Medicaid is the recommended $0 gapless path`);
    ok(e.actions.some(a => /Apply for Medicaid/.test(a.title)), `${exp}: Medicaid action present`);
    const n = solve({ ...base, state: non, income: lowInc, combat: 'no' });
    ok(n.medicaid.available && n.medicaid.household === false && n.medicaid.kids === true, `${non}: parents over the state limit, kids under CHIP`);
    ok(!n.paths.some(x => x.id === 'medicaid') && n.actions.some(a => /Apply for CHIP for the kids/.test(a.title)), `${non}: no Medicaid path, CHIP action for the kids`);
    const rich = solve({ ...base, state: exp, income: 150000 });
    ok(rich.medicaid.household === false && !rich.paths.some(x => x.id === 'medicaid') && !rich.actions.some(a => /CHIP/.test(a.title)), `${exp}: high income → no Medicaid, no CHIP action`);
    const single = solve({ ...base, state: non, spouse: false, children: 0, income: 12000, combat: 'no' });
    ok(single.medicaid.household === false, `${non}: childless adult not covered in a non-expansion state`);
    const noState = solve({ ...base, income: lowInc });
    ok(noState.medicaid.available === false && !noState.paths.some(x => x.id === 'medicaid'), 'no state → no Medicaid read, graceful');
    const ret = solve({ ...base, mode: 'retiring', state: exp, income: lowInc, next: 'gap' });
    ok(!ret.paths.some(x => x.id === 'medicaid'), 'retiree: no Medicaid path (TRICARE continues)');
    if (SM.WI) ok(SM.WI.expansion === false && SM.WI.adultPctFpl >= 95, 'WI: childless adults covered to ~100% without formal expansion');
    ok(Object.keys(SM).length >= 51, '51+ jurisdictions in the Medicaid table');
}

// --- usage + pregnancy raise OOP but never premiums -------------------------
{
    const a = solve({ ...base, mode: 'voluntary' }), b = solve({ ...base, mode: 'voluntary', pregnant: true });
    const pa = a.paths.find(x => x.id === 'marketplace'), pb = b.paths.find(x => x.id === 'marketplace');
    ok(near(pa.premiums12, pb.premiums12, 0.01) && pb.oop12 > pa.oop12, 'pregnancy raises OOP only');
    const wa = a.paths.find(x => x.id === 'wait'), wb = b.paths.find(x => x.id === 'wait');
    ok(wb.oop12 > wa.oop12, 'uninsured gap costs more when a delivery is expected');
}

// --- horizon & segment integrity ---------------------------------------------
{
    const r = solve({ ...base, mode: 'involuntary' });
    for (const x of r.paths) for (const row of ['veteran', 'family']) {
        const segs = x.segments[row]; if (!segs) continue;
        ok(segs[0].start === 0 && segs[segs.length - 1].end === HORIZON_DAYS, `${x.id}/${row} spans the horizon`);
        ok(segs.every((s, i) => i === 0 || s.start === segs[i - 1].end), `${x.id}/${row} segments contiguous`);
    }
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
