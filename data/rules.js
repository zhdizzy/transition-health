/**
 * Transition Health Coverage Bridge — rules + benchmarks.
 *
 * Every constant carries a source. `verified: 'YYYY-MM-DD'` means the 9/2/26
 * source pull (transition-health-sources-2026-09.md) confirmed it; `verify: true`
 * means the pull did NOT cover it and the UI labels it as an assumption.
 * Correct figures here, nowhere else. The engine imports only this file.
 */

export const DATA_STAMP = '2026-09-02';

/* Windows and durations, in days unless noted. */
export const WINDOWS = {
    tampDays: 180,                 // 10 USC 1145(a)(4): 180 days beginning on the separation date (verified 9/2/26)
    chcbpElectDays: 60,            // CHCBP: within 60 days of losing regular TRICARE or TAMP (tricare.mil CHCBP, 1/26/2026)
    chcbpElectAfterTrsDays: 30,    // ...but only 30 days after losing TRICARE Reserve Select
    chcbpMonthsMember: 18,         // former active duty, TAMP, TRS/TRR leavers + families: 18 months
    chcbpMonthsOther: 36,          // dependents who lose eligibility, unremarried former spouses: up to 36 months
    marketplaceSepDays: 60,        // 45 CFR 155.420: 60 days after loss of coverage (verified)
    marketplaceSepBeforeDays: 60,  // ...and up to 60 days before a known future loss
    hipaaSpecialEnrollDays: 30,    // 29 CFR 2590.701-6: 30 days to request enrollment in a spouse's group plan; coverage starts the 1st of the month after the request
    employerWaitMaxDays: 90,       // PHS Act 2708: 90-day maximum waiting period
    vaDentalClassIIDays: 180,      // 38 CFR 17.161(b): one-time dental within 180 days of discharge (90+ days Gulf War era service, or 180+ otherwise)
    vaDentalPreDischargeCertDays: 90, // ...unless the DD-214 certifies a complete exam + all treatment within 90 days before discharge
    vaCombatEnrollYears: 10,       // va.gov: combat theater after 11/11/1998 + discharged on/after 10/1/2013 → 10 years enhanced eligibility (PG6)
    retireeEnrollDays: 90,         // tricare.mil Retiring (7/31/2026): enroll in Prime/Select within 90 days after the retirement date
    fedvipRetireeBeforeDays: 31,   // BENEFEDS: FEDVIP window runs 31 days before to 60 days after retirement; enroll BEFORE retirement to avoid a dental gap (not retroactive)
    fedvipRetireeDays: 60,
    fehbNewHireDays: 60,           // OPM: 60 days from hire to elect FEHB; effective first pay period after election
    vgliNoHealthDays: 240,         // SGLI→VGLI with no health questions: 240 days after separation (courtesy item; not health coverage)
    bddWindowOpenDays: 180,        // BDD claim window: 180 to 90 days before separation
    bddWindowCloseDays: 90,
    vaProcessingDays: 30,          // planning assumption for a VA enrollment decision after applying (not a rule)
    champvaProcessingDays: 45,     // planning assumption for CHAMPVA (10-10d) processing (not a rule)
    trsFehbBarEnds: '2030-01-01',  // 10 USC 1076d(a)(2): the FEHB-eligible bar on TRS lifts 1/1/2030
    verified: '2026-09-02',
};

/* TAMP eligibility categories, tricare.mil TAMP page (5/15/2025) + 10 USC
 * 1145(a)(2). Voluntary end-of-contract separation is NOT on this list,
 * which is the single most common misread. */
export const TAMP_CATEGORIES = {
    involuntary:   { label: 'Involuntarily separated under honorable conditions (incl. denied reenlistment, force shaping)', eligible: true },
    vsi:           { label: 'Took voluntary separation incentive / pay (VSI/VSP) and cannot draw retired pay', eligible: true },
    contingency:   { label: 'Guard/Reserve released from more than 30 consecutive days of active duty for a contingency or preplanned mission', eligible: true },
    title32:       { label: 'National Guard released from Title 32 502(f) duty after a declared disaster or emergency', eligible: true },
    stoploss:      { label: 'Separated after stop-loss, or after volunteering to stay under a year for a contingency', eligible: true },
    solesurvivor:  { label: 'Sole survivorship discharge', eligible: true },
    selres:        { label: 'Separating from active duty and agreeing to join the Selected Reserve', eligible: true },
    medsep:        { label: 'Medical separation with severance (DoD rating under 30%)', eligible: true, note: 'tricare.mil says under-30% separatees "may apply" for TAMP; service TAP matrices treat disability separations as TAMP-conveying. Usually yes: confirm in milConnect before your last day.' },
    voluntary:     { label: 'Voluntary separation at end of contract / resignation', eligible: false },
    reserveNone:   { label: 'Not coming off qualifying orders (drilling status, or leaving the Selected Reserve)', eligible: false, note: 'No TAMP without a contingency or disaster activation of more than 30 consecutive days. If you leave the Selected Reserve, TRS ends with membership and the CHCBP window is 30 days.' },
    retiree:       { label: 'Retiring (20-year or Chapter 61 medical)', eligible: false, note: 'Not TAMP. Retiree TRICARE continues if you enroll within 90 days.' },
    verified: '2026-09-02',
};

/* Programs and their household cost shape. premiums are MONTHLY.
 * deductible/oopMax describe a plan year. `individual` vs `family` picks by
 * household size. `verify` marks figures awaiting the source pull. */
export const PROGRAMS = {
    tricare: {
        label: 'TRICARE (active duty family)', color: '#2b6cb0',
        premium: { individual: 0, family: 0 }, deductible: { individual: 0, family: 0 }, oopMax: { individual: 1000, family: 1000 }, coinsurance: 0,
        source: 'tricare.mil 2026: active duty family members, Prime/Select. Cat cap $1,000 Group A / $1,324 Group B (never binds here: no deductible or cost share modeled).', verified: '2026-09-02',
    },
    tamp: {
        label: 'TAMP (180 days, premium-free)', color: '#3182ce',
        premium: { individual: 0, family: 0 }, deductible: { individual: 0, family: 0 }, oopMax: { individual: 1000, family: 1000 }, coinsurance: 0,
        source: '10 USC 1145; tricare.mil TAMP (5/15/2025). Prime/Select at active-duty-family cost shares. Family TRICARE Dental ends on the separation date even under TAMP; sponsor gets space-available clinic care only.', verified: '2026-09-02',
    },
    chcbp: {
        label: 'CHCBP (premium continuation)', color: '#805ad5',
        // CY2026: $2,103/qtr individual, $5,339/qtr family (tricare.mil Costs/CHCBP, 12/30/2025; Humana Military matches)
        premium: { individual: 2103 / 3, family: 5339 / 3 },
        deductible: { individual: 198, family: 397 }, oopMax: { individual: 4635, family: 4635 }, coinsurance: 0.20,
        source: 'tricare.mil CHCBP costs, CY2026: $2,103 per quarter individual ($8,412/yr), $5,339 per quarter family ($21,356/yr). Same benefit as TRICARE Select; Group B cost shares. Minimum essential coverage.', verified: '2026-09-02',
    },
    va: {
        label: 'VA health care (veteran only)', color: '#276749',
        premium: { individual: 0, family: 0 }, deductible: { individual: 0, family: 0 }, oopMax: { individual: 0, family: 0 }, coinsurance: 0,
        source: 'va.gov copay rates (12/29/2025): no premiums; 10%+ rating removes inpatient/outpatient copays; 50%+ (PG1) removes medication copays too; combat-related care in PG6 is copay-free. Never covers dependents.', verified: '2026-09-02',
    },
    champva: {
        label: 'CHAMPVA (family, at 100% P&T)', color: '#38a169',
        premium: { individual: 0, family: 0 }, deductible: { individual: 50, family: 100 }, oopMax: { individual: 3000, family: 3000 }, coinsurance: 0.25,
        source: '38 CFR 17.270–278: $50/person outpatient deductible ($100 family), 25% cost share, $3,000 family catastrophic cap.',
    },
    marketplace: {
        label: 'ACA marketplace plan', color: '#d69e2e',
        premium: { individual: null, family: null },           // user-entered or estimated (see ACA below)
        deductible: { individual: 3000, family: 6000 }, oopMax: { individual: 10600, family: 21200 }, coinsurance: 0.20,
        source: 'HHS 2026 cost-sharing limits ($10,600 / $21,200); typical silver design deductible ("edit yours").', verify: true,
    },
    employer: {
        label: 'Employer plan', color: '#dd6b20',
        premium: { individual: 1440 / 12, family: 6850 / 12 },   // KFF 2025 worker contribution: $1,440 single, $6,850 family (verified)
        deductible: { individual: 1800, family: 3500 }, oopMax: { individual: 6000, family: 12000 }, coinsurance: 0.20,
        source: 'KFF 2025 Employer Health Benefits Survey: worker contribution $1,440/yr single, $6,850/yr family (total premiums $9,325 / $26,993); plan design is typical, edit yours.', verified: '2026-09-02',
    },
    spouse: {
        label: "Spouse's employer plan", color: '#c05621',
        premium: { individual: 1440 / 12, family: 6850 / 12 },
        deductible: { individual: 1800, family: 3500 }, oopMax: { individual: 6000, family: 12000 }, coinsurance: 0.20,
        source: 'Same KFF 2025 benchmarks as employer plan; enter the real premium if you know it. Coverage starts the 1st of the month after the request (29 CFR 2590.701-6).', verified: '2026-09-02',
    },
    ship: {
        label: 'Student health plan (SHIP)', color: '#6b46c1',
        premium: { individual: null, family: null },           // user-entered; proxy = ACA benchmark (student plans are often cheaper)
        deductible: { individual: 500, family: 1000 }, oopMax: { individual: 10600, family: 21200 }, coinsurance: 0.20,
        source: 'Student Health Insurance Plans are ACA-compliant individual coverage (45 CFR 147.145). Offered by most four-year and nearly all private universities, often mandatory unless waived with proof of other coverage; community colleges and most for-profit/online schools do not offer one. Billed with tuition on the academic year. Whether the GI Bill pays the fee depends on how the school bills it: a fee that is mandatory for the student can be paid (and at a private school counts against the annual cap); a waivable fee generally is not (VERIFY with the school certifying official). VA health care usually satisfies the waiver.', verify: true,
    },
    fehb: {
        label: 'FEHB (federal employee)', color: '#b7791f',
        premium: { individual: 1440 / 12, family: 6850 / 12 },   // placeholder: OPM 2026 average employee share VERIFY
        deductible: { individual: 1500, family: 3000 }, oopMax: { individual: 6000, family: 12000 }, coinsurance: 0.15,
        source: 'OPM FEHB: government pays ~72% of the program-wide average premium. Employee share modeled at the KFF employer benchmark pending OPM 2026 figures.', verify: true,
    },
    trs: {
        label: 'TRICARE Reserve Select', color: '#2c7a7b',
        premium: { individual: 57.88, family: 286.66 },
        deductible: { individual: 198, family: 397 }, oopMax: { individual: 1324, family: 1324 }, coinsurance: 0.20,
        source: 'TRICARE 2026 Costs & Fees sheet (May 2026): TRS $57.88 / $286.66 per month; Group B cost shares; cat cap $1,324 per family (CY2026). Not available while FEHB-eligible (bar lifts 1/1/2030).', verified: '2026-09-02',
    },
    trr: {
        label: 'TRICARE Retired Reserve', color: '#285e61',
        premium: { individual: 645.90, family: 1548.30 },
        deductible: { individual: 198, family: 397 }, oopMax: { individual: 4635, family: 4635 }, coinsurance: 0.20,
        source: 'TRICARE 2026 Costs & Fees sheet: TRR $645.90 / $1,548.30 per month; Group B cost shares; cat cap $4,635.', verified: '2026-09-02',
    },
    retireeSelect: {
        label: 'TRICARE Select (retiree)', color: '#b83280',
        premium: { individual: 186.96 / 12, family: 375 / 12 },   // Group A enrollment fee; Group B $594.96 / $1,191 (engine swaps by group)
        deductible: { individual: 150, family: 300 }, oopMax: { individual: 4381, family: 4381 }, coinsurance: 0.20,
        source: 'TRICARE 2026 Costs & Fees sheet: retiree Select enrollment Group A $186.96 / $375 per year, Group B $594.96 / $1,191; cat cap $4,381 (A) / $4,635 (B). Enroll within 90 days of retirement.', verified: '2026-09-02',
    },
    retireePrime: {
        label: 'TRICARE Prime (retiree)', color: '#0987a0',
        premium: { individual: 381.96 / 12, family: 765 / 12 },   // Group A; Group B $462.96 / $927 (engine swaps by group)
        deductible: { individual: 0, family: 0 }, oopMax: { individual: 3000, family: 3000 }, coinsurance: 0,
        source: 'TRICARE 2026 Costs & Fees sheet: retiree Prime enrollment Group A $381.96 / $765 per year, Group B $462.96 / $927; cat cap $3,000 (A) / $4,635 (B).', verified: '2026-09-02',
    },
    retireeFeesB: { select: { individual: 594.96, family: 1191 }, prime: { individual: 462.96, family: 927 } },
    retireeCapB: 4635,   // Group B retirees: $4,635 catastrophic cap for Prime and Select alike (2026)
    medicaid: {
        label: 'Medicaid (state, $0)', color: '#975a16',
        premium: { individual: 0, family: 0 }, deductible: { individual: 0, family: 0 }, oopMax: { individual: 0, family: 0 }, coinsurance: 0,
        source: 'Medicaid.gov / KFF eligibility tables (see state-medicaid-2026.js). No premiums in most states; nominal copays at most. Apply any month; coverage can be retroactive up to 3 months; report income changes.', verify: true,
    },
    uninsured: {
        label: 'No coverage', color: '#e53e3e',
        premium: { individual: 0, family: 0 }, deductible: { individual: 0, family: 0 }, oopMax: { individual: Infinity, family: Infinity }, coinsurance: 1,
        source: 'You pay 100% of billed charges with no cap.',
    },
};

/* Usage scenarios: household ALLOWED charges for a 12-month period, used
 * with each plan's cost-share shape. Editable assumptions, not survey
 * point estimates (same approach as the CHAMPVA tool). */
export const USAGE = {
    light:   { label: 'Light (a few visits, one prescription)', individual: 1500, family: 3000 },
    typical: { label: 'Typical (checkups, a couple of urgent-care visits, ongoing meds)', individual: 3500, family: 9000 },
    heavy:   { label: 'Heavy (a delivery, a surgery, or ongoing treatment)', individual: 25000, family: 45000 },
    pregnancyAdd: 20000,   // added to the household's allowed charges when a delivery is expected (assumption; edit)
    verify: true,
};

/* VA enrollment: priority group by rating, copay rule, and the PG8 bar. */
export const VA = {
    groupByRating: r => r >= 50 ? 1 : r >= 30 ? 2 : r >= 10 ? 3 : null,   // 0% noncompensable is income-tested (PG5/8), not PG6; compensable 0% (rare, SMC-K) is PG6
    noCareCopayAt: 10,             // 10%+ service-connected: no inpatient/outpatient copays (va.gov copay rates 12/29/2025)
    noMedCopayAt: 50,              // 50%+ (PG1): medication copays gone too
    pactDirectEnrollDate: '2024-03-05',   // toxic-exposed / Gulf War / post-9/11 designated-location veterans enroll without a claim (va.gov)
    combatWindowYears: 10,         // combat theater after 11/11/1998 AND discharged on/after 10/1/2013
    // 2026 national income thresholds, reused from the VA Healthcare Navigator (va.gov income limits are JS-rendered; link users to the lookup).
    // PG8 subgroups b/d may enroll within 10% over the limit; 8e/8g (more than 10% over, not previously enrolled) may not.
    incomeLimit2026: { single: 43335, oneDependent: 52000 },
    pg8Tolerance: 0.10,
    pg8Bar: 'With no service-connected rating and no combat or toxic-exposure eligibility, enrollment is income-tested: more than 10% over the VA national income limit (Priority Group 8e/8g) is not accepted.',
    incomeThresholdNote: 'The limit rises with each dependent and is higher in high-cost counties (geographic means test); check va.gov/health-care/income-limits.',
    source: 'va.gov priority groups + copay rates (12/29/2025); 38 CFR 17.36; PACT Act (Pub. L. 117-168).', verified: '2026-09-02',
};

/* ACA subsidy: expected-contribution schedule. The enhanced (ARPA/IRA)
 * credits expired 12/31/2025 and had not been restored as of the latest
 * source found (KFF, 5/19/2026); re-check at launch. `enhanced: false`
 * uses the statutory schedule (2%–9.96% indexed; 400% FPL cliff). */
export const ACA = {
    enhanced: false,
    enhancedNote: 'Enhanced premium tax credits expired Dec 31, 2025 and were not renewed as of the last check (KFF, May 2026). Estimates use the standard schedule with the 400% cliff.',
    fpl: { base: 15650, perPerson: 5500, year: 2025 },      // 2025 HHS guideline: the correct year for plan-year 2026 premium credits
    // applicable percentage by FPL band [upTo%, pct at band start, pct at band end]
    // 2026 applicable percentages, IRS Rev. Proc. 2025-25 §3.01 (read 9/3/26): <133% 2.10; 133–150 3.14→4.19; 150–200 4.19→6.60; 200–250 6.60→8.44; 250–300 8.44→9.96; 300–400 9.96
    schedule: [
        [1.33, 0.0210, 0.0210], [1.50, 0.0314, 0.0419], [2.00, 0.0419, 0.0660], [2.50, 0.0660, 0.0844], [3.00, 0.0844, 0.0996], [4.00, 0.0996, 0.0996],
    ],
    scheduleEnhanced: [
        [1.50, 0, 0], [2.00, 0, 0.02], [2.50, 0.02, 0.04], [3.00, 0.04, 0.06], [4.00, 0.06, 0.085], [99, 0.085, 0.085],
    ],
    benchmarkPremiumMonthly: { individual: 600, family: 1700 },   // unsubsidized benchmark silver placeholder (VERIFY; user should enter real quote)
    source: 'IRS Rev. Proc. 2025-25 applicable percentages (verified 9/3/26); 2025 HHS poverty guidelines; healthcare.gov. Benchmark premiums are placeholders; enter a real quote.', verify: true,
};

export const FORMS = {
    shpe:     { id: 'DD 2807-1 / DD 2808', label: 'Separation History and Physical Exam (schedule it 90 to 180 days out)', where: 'Your military treatment facility / TAP', url: 'https://www.tricare.mil/LifeEvents/Separating' },
    deers:    { id: 'DEERS', label: 'Update DEERS with your separation and mailing address', where: 'milConnect', url: 'https://milconnect.dmdc.osd.mil/' },
    tamp:     { id: 'milConnect', label: 'Confirm your TAMP eligibility shows in DEERS', where: 'milConnect / ID card office', url: 'https://www.tricare.mil/Plans/SpecialPrograms/TAMP' },
    chcbp:    { id: 'DD Form 2837', label: 'Apply for CHCBP', where: 'Humana Military (mail/online)', url: 'https://www.tricare.mil/Plans/SpecialPrograms/CHCBP' },
    va1010:   { id: 'VA Form 10-10EZ', label: 'Apply for VA health care', where: 'va.gov/health-care/apply', url: 'https://www.va.gov/health-care/apply-for-health-care-form-10-10ez/' },
    champva:  { id: 'VA Form 10-10d', label: 'Apply for CHAMPVA for your family', where: 'VHA Office of Integrated Veteran Care', url: 'https://www.va.gov/health-care/family-caregiver-benefits/champva/' },
    trs:      { id: 'milConnect (BWE)', label: 'Enroll in TRICARE Reserve Select', where: 'Beneficiary Web Enrollment', url: 'https://www.tricare.mil/Plans/HealthPlans/TRS' },
    trr:      { id: 'milConnect (BWE)', label: 'Enroll in TRICARE Retired Reserve', where: 'Beneficiary Web Enrollment', url: 'https://www.tricare.mil/Plans/HealthPlans/TRR' },
    retiree:  { id: 'milConnect / regional contractor', label: 'Enroll in retiree TRICARE Select or Prime', where: 'East/West regional contractor', url: 'https://www.tricare.mil/LifeEvents/Retiring' },
    fedvip:   { id: 'BENEFEDS', label: 'Enroll in FEDVIP dental/vision (before your retirement date)', where: 'benefeds.gov', url: 'https://www.benefeds.gov/' },
    market:   { id: 'healthcare.gov', label: 'Apply through the marketplace (loss-of-coverage SEP)', where: 'healthcare.gov or your state exchange', url: 'https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/' },
    spouse:   { id: 'HR benefits form', label: "Add the family to your spouse's employer plan", where: "Spouse's HR / benefits portal", url: '' },
    employer: { id: 'HR benefits enrollment', label: 'Enroll in your new employer plan', where: 'New employer HR', url: '' },
    fehb:     { id: 'SF 2809', label: 'Elect FEHB', where: 'Agency HR / Employee Express', url: 'https://www.opm.gov/healthcare-insurance/healthcare/' },
    ship:     { id: 'Student health plan enrollment / waiver', label: 'Enroll in (or waive) the student health plan by the add/drop deadline', where: "Your school's student health center or bursar", url: '' },
    vaDental: { id: 'VA Form 10-10EZ + dental clinic', label: 'Request one-time VA dental treatment', where: 'VA medical center dental clinic', url: 'https://www.va.gov/health-care/about-va-health-benefits/dental-care/' },
    bdd:      { id: 'VA Form 21-526EZ (BDD)', label: 'File a Benefits Delivery at Discharge claim', where: 'va.gov', url: 'https://www.va.gov/disability/how-to-file-claim/when-to-file/pre-discharge-claim/' },
    itf:      { id: 'Intent to File', label: 'Lock your effective date with an Intent to File', where: 'va.gov', url: 'https://www.va.gov/resources/your-intent-to-file-a-va-claim/' },
    vgli:     { id: 'SGLV 8714', label: 'Convert SGLI to VGLI (no health questions within 240 days)', where: 'Prudential OSGLI', url: 'https://www.va.gov/life-insurance/options-eligibility/vgli/' },
    medicaid: { id: 'State Medicaid application', label: 'Apply for Medicaid for the household', where: 'Your state Medicaid agency (healthcare.gov routes you)', url: 'https://www.healthcare.gov/medicaid-chip/' },
    chip:     { id: 'State Medicaid/CHIP', label: 'Check Medicaid/CHIP for the kids in a low-income transition year', where: 'Your state Medicaid agency', url: 'https://www.healthcare.gov/medicaid-chip/' },
};

/* Official enrollment portals and free help only. Government or program-
 * administrator pages; never a carrier, broker, or lead-gen site (TBV is not
 * a licensed agent and takes no referral fees). `when` lists the program ids
 * or modes that make a link relevant. */
export const OFFICIAL_LINKS = [
    { label: 'Apply for VA health care (VA Form 10-10EZ)', url: 'https://www.va.gov/health-care/apply-for-health-care-form-10-10ez/', when: ['va', 'always'] },
    { label: 'Find a free accredited VSO or representative', url: 'https://www.va.gov/get-help-from-accredited-representative/find-rep/', when: ['always'] },
    { label: 'Marketplace: see plans and prices', url: 'https://www.healthcare.gov/see-plans/', when: ['marketplace'] },
    { label: 'Marketplace: free local help (certified assisters)', url: 'https://localhelp.healthcare.gov/', when: ['marketplace'] },
    { label: 'Medicaid and CHIP for the kids', url: 'https://www.healthcare.gov/medicaid-chip/', when: ['kids', 'medicaid'] },
    { label: 'CHCBP: how to purchase (DD Form 2837)', url: 'https://www.tricare.mil/Plans/SpecialPrograms/CHCBP/PurchaseCHCBP', when: ['chcbp'] },
    { label: 'TAMP: check your eligibility in milConnect', url: 'https://www.tricare.mil/Plans/SpecialPrograms/TAMP', when: ['tamp'] },
    { label: 'TRICARE Reserve Select: enroll', url: 'https://www.tricare.mil/Plans/HealthPlans/TRS', when: ['trs'] },
    { label: 'TRICARE Retired Reserve: enroll', url: 'https://www.tricare.mil/Plans/HealthPlans/TRR', when: ['trr'] },
    { label: 'Retiring: enroll in Prime or Select', url: 'https://www.tricare.mil/LifeEvents/Retiring', when: ['retireeSelect', 'retireePrime'] },
    { label: 'FEDVIP dental and vision (BENEFEDS)', url: 'https://www.benefeds.gov/', when: ['retireeSelect', 'retireePrime'] },
    { label: 'CHAMPVA: apply for the family (VA Form 10-10d)', url: 'https://www.va.gov/health-care/family-caregiver-benefits/champva/', when: ['champva'] },
    { label: 'VA dental care and VADIP (dental insurance for veterans and CHAMPVA families)', url: 'https://www.va.gov/health-care/about-va-health-benefits/dental-care/', when: ['always'] },
    { label: 'FEHB for federal employees (OPM)', url: 'https://www.opm.gov/healthcare-insurance/healthcare/', when: ['fehb'] },
];
