// ACA Marketplace premium benchmarks and the federal age curve, plan year 2026.
// Lets the Transition Health tool estimate an UNSUBSIDIZED marketplace premium for a
// household from the state and each member's age:
//   member premium  = BENCHMARK_40_2026[state] / AGE_CURVE[40] * AGE_CURVE[memberAge]
//   family premium  = sum of member premiums, counting only the three oldest children under 21
// States in AGE_RATING_EXCEPTIONS do not price by the federal default curve; the tool should
// label those estimates as approximate (or, for NY and VT, charge the same adult rate at every age).
//
// SOURCES (all retrieved 2026-09-03)
//  [1] KFF State Health Facts, "Marketplace Average Monthly Benchmark Premiums", plan year 2026.
//      https://www.kff.org/affordable-care-act/state-indicator/marketplace-average-benchmark-premiums/
//      Note on the table: "Premiums were analyzed using the second-lowest cost silver (benchmark)
//      premium for a 40-year-old in each county and weighted by county plan selections, and may
//      include premiums for non-Essential Health Benefits." Source line: "KFF analysis of data from
//      Healthcare.gov, state rate review websites, state plan finder tools, and state provided data."
//  [2] CMS CCIIO, "State Specific Age Curve Variations" (2018 plan year onward), PDF dated 5/31/2017.
//      https://www.cms.gov/CCIIO/Programs-and-Initiatives/Health-Insurance-Market-Reforms/Downloads/StateSpecAgeCrv053117.pdf
//      Columns: Default Premium Ratio, Alabama (Individual), District of Columbia, Massachusetts,
//      Minnesota, Mississippi, New Jersey (Small Group), Oregon, Utah.
//  [3] CMS CCIIO, "Final Guidance Regarding Age Curves and State Reporting", December 16, 2016
//      (publishes the revised federal default standard age curve effective plan year 2018).
//      https://www.cms.gov/CCIIO/Resources/Regulations-and-Guidance/Downloads/Final-Guidance-Regarding-Age-Curves-and-State-Reporting-12-16-16.pdf
//      Every default value in AGE_CURVE below was checked against BOTH [2] and [3]; they agree.
//  [4] CMS CCIIO, "Market Rating Reforms" state table (table updated December 10, 2021;
//      page last modified 09/10/2024). Source for which states use community rating or a
//      state-established age curve, and the links to [2].
//      https://www.cms.gov/cciio/programs-and-initiatives/health-insurance-market-reforms/state-rating
//  [5] 45 CFR 147.102 (Cornell LII mirror; ecfr.gov redirected to a bot-check page on retrieval).
//      https://www.law.cornell.edu/cfr/text/45/147.102
//      (a)(1)(iii): rates "may not vary by more than 3:1 for like individuals of different age who
//      are age 21 and older". (d): uniform age bands are a single band for 0-14, one-year bands for
//      15-63, and a single band for 64 and older. (c)(1): quoted in CHILD_RULE below.
//
// REFRESH: KFF posts the next plan year's table in the fall (rates approved ~October). The federal
// default age curve has not changed since plan year 2018; re-check [4] each fall for new state curves.

export const BENCHMARK_STAMP = '2026-09-03';

// Second-lowest-cost silver ("benchmark") monthly premium for a 40-year-old non-smoker,
// plan year 2026, state average (county benchmarks weighted by county plan selections). Source [1].
// The KFF table is plan year 2026, so no fallback year was needed.
export const BENCHMARK_40_2026 = {
  AL: 645,
  AK: 1032,
  AZ: 532,
  AR: 774,
  CA: 570,
  CO: 557,
  CT: 870,
  DE: 691,
  DC: 610,
  FL: 683,
  GA: 615,
  HI: 541,
  ID: 490,
  IL: 646,
  IN: 474,
  IA: 501,
  KS: 670,
  KY: 590,
  LA: 646,
  ME: 709,
  MD: 414,
  MA: 494,
  MI: 523,
  MN: 448,
  MS: 662,
  MO: 605,
  MT: 692,
  NE: 710,
  NV: 497,
  NH: 401,
  NJ: 545,
  NM: 623,
  NY: 817,
  NC: 638,
  ND: 570,
  OH: 513,
  OK: 604,
  OR: 543,
  PA: 572,
  RI: 506,
  SC: 564,
  SD: 655,
  TN: 711,
  TX: 661,
  UT: 640,
  VT: 1299,
  VA: 455,
  WA: 612,
  WV: 1073,
  WI: 611,
  WY: 1090,
};

// US average from the same KFF table (plan year 2026).
export const BENCHMARK_40_2026_US = 625;

export const BENCHMARK_YEAR = 2026;

export const BENCHMARK_SOURCE =
  'KFF State Health Facts, "Marketplace Average Monthly Benchmark Premiums", plan year 2026 ' +
  '(second-lowest-cost silver premium for a 40-year-old, county benchmarks weighted by plan selections; ' +
  'may include non-EHB premium). https://www.kff.org/affordable-care-act/state-indicator/marketplace-average-benchmark-premiums/ ' +
  'Retrieved 2026-09-03.';

// CMS federal default standard age curve (45 CFR 147.102(a)(1)(iii); premium ratio relative to age 21),
// in effect since plan year 2018 and unchanged for 2026. Transcribed from the "Default Premium Ratio"
// column of source [2] and verified against source [3]. Ages 0-14 share one band; 64 is "64 and older".
export const AGE_CURVE = {
  0: 0.765,
  1: 0.765,
  2: 0.765,
  3: 0.765,
  4: 0.765,
  5: 0.765,
  6: 0.765,
  7: 0.765,
  8: 0.765,
  9: 0.765,
  10: 0.765,
  11: 0.765,
  12: 0.765,
  13: 0.765,
  14: 0.765,
  15: 0.833,
  16: 0.859,
  17: 0.885,
  18: 0.913,
  19: 0.941,
  20: 0.970,
  21: 1.000,
  22: 1.000,
  23: 1.000,
  24: 1.000,
  25: 1.004,
  26: 1.024,
  27: 1.048,
  28: 1.087,
  29: 1.119,
  30: 1.135,
  31: 1.159,
  32: 1.183,
  33: 1.198,
  34: 1.214,
  35: 1.222,
  36: 1.230,
  37: 1.238,
  38: 1.246,
  39: 1.262,
  40: 1.278,
  41: 1.302,
  42: 1.325,
  43: 1.357,
  44: 1.397,
  45: 1.444,
  46: 1.500,
  47: 1.563,
  48: 1.635,
  49: 1.706,
  50: 1.786,
  51: 1.865,
  52: 1.952,
  53: 2.040,
  54: 2.135,
  55: 2.230,
  56: 2.333,
  57: 2.437,
  58: 2.548,
  59: 2.603,
  60: 2.714,
  61: 2.810,
  62: 2.873,
  63: 2.952,
  64: 3.000,
};

export const AGE_CURVE_SOURCE =
  'CMS CCIIO, "State Specific Age Curve Variations" (Default Premium Ratio column), PDF dated 5/31/2017: ' +
  'https://www.cms.gov/CCIIO/Programs-and-Initiatives/Health-Insurance-Market-Reforms/Downloads/StateSpecAgeCrv053117.pdf ' +
  '; cross-checked against CMS "Final Guidance Regarding Age Curves and State Reporting" (Dec. 16, 2016): ' +
  'https://www.cms.gov/CCIIO/Resources/Regulations-and-Guidance/Downloads/Final-Guidance-Regarding-Age-Curves-and-State-Reporting-12-16-16.pdf ' +
  '. Retrieved 2026-09-03.';

// States whose individual market does NOT price by the federal default curve. Verified against the
// CMS "Market Rating Reforms" state table [4] and the per-state columns in [2]. Ratios quoted are
// each state's own curve at ages 0-14 / 21 / 40 / 64+ from [2], for labeling and sanity checks.
// New Jersey also appears in [2], but only for its SMALL GROUP market; NJ's individual market uses the
// federal default curve, so it is deliberately not listed here.
export const AGE_RATING_EXCEPTIONS = {
  NY: 'no age rating (pure community rating, 1:1); every adult pays the same premium; uniform family tiers',
  VT: 'no age rating (community rating, 1:1); uniform family tiers',
  MA: 'state curve, 2:1 age ratio (0-14: 0.751, 21: 1.183, 40: 1.393, 64+: 2.365 vs federal 3.000)',
  MN: 'state curve; matches federal default for adults but children 0-20 are rated at 0.890 (federal 0.765-0.970)',
  AL: 'state curve (individual market); matches federal default for adults but all children 0-20 are rated at 0.635',
  DC: 'state curve, flatter than federal (0-14: 0.654, 21: 0.727, 40: 0.975, 64+: 2.181)',
  MS: 'state curve; matches federal default for adults but all children 0-20 are rated at 0.635',
  OR: 'state curve; matches federal default for adults but all children 0-20 are rated at 0.635',
  UT: 'state curve, steeper than federal at younger ages (0-14: 0.793, 21: 1.000, 40: 1.479, reaches 3.000 at age 59)',
};

// Verbatim from 45 CFR 147.102(c)(1) [5]: "With respect to family members under the age of 21, the
// premiums for no more than the three oldest covered children must be taken into account in
// determining the total family premium."
export const CHILD_RULE =
  'Only the three oldest covered children under age 21 are charged in a family premium (45 CFR 147.102(c)(1)).';

export const CHILD_RULE_SOURCE = 'https://www.law.cornell.edu/cfr/text/45/147.102';
