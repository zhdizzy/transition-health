// State Medicaid / CHIP / Marketplace reference for the Transition Health tool.
// Built 2026-09-03. Every number below was read from the sources listed on the row;
// nothing is estimated. Retrieval date for all sources: 2026-09-03.
//
// Table editions used (retrieved 2026-09-03)
// - KFF State Health Facts, "Medicaid Income Eligibility Limits for Adults as a Percent
//   of the Federal Poverty Level" — data as of January 2026 (parents in a family of
//   three; other non-disabled adults). MAGI-converted, includes the 5-point FPL
//   disregard, so expansion states print 138.
// - KFF, "Medicaid and CHIP Income Eligibility Limits for Children as a Percent of the
//   FPL" — data as of January 2026 (upper limit, Medicaid + separate CHIP).
// - KFF, "Medicaid and CHIP Income Eligibility Limits for Pregnant Women as a Percent of
//   the FPL" — data as of January 2026. pregnancyPctFpl below is the HIGHEST column KFF
//   prints for the state (Medicaid, CHIP, or the unborn-child/FCEP option), i.e. the
//   income at which some pregnancy coverage still exists.
// - KFF, "Status of State Action on the Medicaid Expansion Decision" — data as of
//   August 2026: 41 adopted (40 states + DC), 10 not adopted.
// - KFF, "Premiums and Enrollment Fees for Children" — data as of January 2026
//   (18 states charge; Arizona and Vermont suspended).
// - KFF / Georgetown CCF, "Medicaid and CHIP Eligibility, Enrollment, and Renewal
//   Policies as States Prepare for Major Medicaid Policy Changes" — policies as of
//   January 2026, published April 30, 2026 (DC, Iowa, Nevada changes; Georgia and
//   Wisconsin partial waivers).
// - KFF, "Tracking Implementation of the 2025 Reconciliation Law: Medicaid Work
//   Requirements" (overview + 1115/SPA status) — last updated August 3, 2026.
// - CMS CCIIO, "State-based Marketplaces" — page updated August 14, 2026 (plan year 2026:
//   21 SBEs, 3 SBE-FPs; Oregon to full SBE for PY2027, Oklahoma for PY2028).
// - HHS ASPE poverty guidelines page and Poverty Guidelines API (2025 and 2026 values);
//   ASPE "Prior HHS Poverty Guidelines and Federal Register References" (2025 FR
//   published 2025-01-17; 2026 FR document 2026-00755 published 2026-01-15).
// - HealthCare.gov FPL glossary and CRS R44425: plan year 2026 premium tax credits use
//   the 2025 guidelines; Medicaid/CHIP use the current-year (2026) guidelines.
//
// Field notes
// - adultPctFpl / parentsPctFpl / chipUpperPctFpl / pregnancyPctFpl are integers, % of
//   the federal poverty level, as printed by KFF. null = figure not published.
// - exchange is 'federal' when the resident enrolls on HealthCare.gov. That includes the
//   SBE-FP states (Arkansas, Oregon, Oklahoma) that run their own marketplace entity but
//   use the federal enrollment site. 'state' means a state-run enrollment site.
// - Oregon carries a nextPlanYear object: for 2027 coverage (open enrollment from
//   November 1, 2026) Oregonians move to ExploreHealthOR.gov.
// - Work requirement: H.R. 1 (2025) requires expansion adults 19-64 to show 80 hours/
//   month of work, school, or volunteering (or $580/month income) from 1/1/2027, with
//   exemptions. Early implementers per KFF (8/3/2026): Nebraska 5/1/2026, Montana and
//   Arkansas 7/1/2026 (Arkansas soft launch, no disenrollment before 1/1/2027), Iowa
//   12/1/2026. Georgia already runs a work requirement under its Pathways waiver.

export const STATE_MEDICAID_STAMP = '2026-09-03';

// 2025 HHS poverty guidelines (Federal Register, published 2025-01-17; confirmed via the
// ASPE Poverty Guidelines API 2026-09-03). These govern plan year 2026 Marketplace
// premium tax credit determinations.
export const FPL_2025 = {
  base48: 15650,
  perPerson48: 5500,
  AK: { base: 19550, perPerson: 6880 },
  HI: { base: 17990, perPerson: 6325 },
};

// 2026 HHS poverty guidelines (Federal Register document 2026-00755, published
// 2026-01-15; confirmed via the ASPE API 2026-09-03). Medicaid and CHIP agencies use
// these for 2026 determinations (Wisconsin, for example, applied them 2/1/2026), and
// they will govern plan year 2027 Marketplace subsidies.
export const FPL_2026 = {
  base48: 15960,
  perPerson48: 5680,
  AK: { base: 19950, perPerson: 7100 },
  HI: { base: 18360, perPerson: 6530 },
};

// Which guideline year applies where, for 2026.
export const FPL_YEAR_RULES = {
  marketplace2026: 2025,
  medicaidChip2026: 2026,
  marketplace2027: 2026,
  sources: [
    'https://www.healthcare.gov/glossary/federal-poverty-level-fpl/',
    'https://www.congress.gov/crs-product/R44425',
    'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines',
  ],
};

const KFF_ADULTS = 'https://www.kff.org/affordable-care-act/state-indicator/medicaid-income-eligibility-limits-for-adults-as-a-percent-of-the-federal-poverty-level/';
const KFF_CHILDREN = 'https://www.kff.org/affordable-care-act/state-indicator/medicaid-and-chip-income-eligibility-limits-for-children-as-a-percent-of-the-federal-poverty-level/';
const KFF_PREGNANCY = 'https://www.kff.org/affordable-care-act/state-indicator/medicaid-and-chip-income-eligibility-limits-for-pregnant-women-as-a-percent-of-the-federal-poverty-level/';
const KFF_EXPANSION = 'https://www.kff.org/affordable-care-act/state-indicator/state-activity-around-expanding-medicaid-under-the-affordable-care-act/';
const KFF_PREMIUMS = 'https://www.kff.org/medicaid/state-indicator/premiums-enrollment-fees-for-children/';
const KFF_SURVEY_2026 = 'https://www.kff.org/medicaid/medicaid-and-chip-eligibility-enrollment-and-renewal-policies-as-states-prepare-for-major-medicaid-policy-changes/';
const KFF_WORK_REQ = 'https://www.kff.org/medicaid/medicaid-work-requirements-tracker-overview/';
const KFF_WORK_REQ_STATUS = 'https://www.kff.org/medicaid/medicaid-work-requirements-tracker-1115-waivers/';
const CMS_SBE = 'https://www.cms.gov/cciio/resources/fact-sheets-and-faqs/state-marketplaces';
const HCG = 'https://www.healthcare.gov/';
const HCG_STATE = 'https://www.healthcare.gov/marketplace-in-your-state/';
const GA_PATHWAYS = 'https://pathways.georgia.gov/eligibility';
const GA_PATHWAYS_EXT = 'https://dch.georgia.gov/announcement/2025-10-01/pathways-updates-oct12025';
const OK_OID = 'https://www.oid.ok.gov/special-notice-06-2026/';
const WI_FPL = 'https://www.dhs.wisconsin.gov/badgercareplus/fpl.htm';
const WI_WORK = 'https://www.dhs.wisconsin.gov/medicaid/work.htm';

const KFF = [KFF_ADULTS, KFF_CHILDREN, KFF_PREGNANCY, KFF_EXPANSION];

const HR1 = 'H.R. 1 (2025) work requirement for expansion adults 19-64 takes effect 1/1/2027 (80 hrs/month or $580/month income, with exemptions).';
const GAP = 'Non-expansion. Adults without dependent children are ineligible at any income (coverage gap below 100% FPL, where marketplace subsidies start).';
const CHIP_PREMIUM = 'CHIP charges monthly premiums for children above a state income threshold (KFF, Jan 2026).';

export const STATE_MEDICAID = {
  AL: { name: 'Alabama', expansion: false, adultPctFpl: 0, childlessAdultsCovered: false, parentsPctFpl: 18, chipUpperPctFpl: 317, pregnancyPctFpl: 317, exchange: 'federal', exchangeUrl: HCG,
    notes: GAP + ' Parents cut off at 18% FPL. Pregnancy: Medicaid to 146% FPL, CHIP (unborn-child option) to 317%. ALL Kids (CHIP) charges an annual enrollment fee.', sources: [...KFF, KFF_PREMIUMS] },
  AK: { name: 'Alaska', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 208, pregnancyPctFpl: 230, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state. Alaska uses its own higher poverty guideline (FPL_2025.AK / FPL_2026.AK). ' + HR1, sources: [...KFF, KFF_WORK_REQ] },
  AZ: { name: 'Arizona', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 230, pregnancyPctFpl: 161, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (AHCCCS). KidsCare (CHIP) premiums are suspended indefinitely. ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  AR: { name: 'Arkansas', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 216, pregnancyPctFpl: 214, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (ARHOME premium-assistance model). State-based exchange on the federal platform (My Arkansas Health Insurance Marketplace), so enrollment happens on HealthCare.gov. Work requirement soft launch 7/1/2026 via state plan amendment, no disenrollment before 1/1/2027.', sources: [...KFF, CMS_SBE, KFF_WORK_REQ_STATUS] },
  CA: { name: 'California', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 266, pregnancyPctFpl: 322, exchange: 'state', exchangeUrl: 'https://www.coveredca.com/',
    notes: 'Expansion state (Medi-Cal). Pregnancy: Medicaid to 213% FPL, CHIP to 322%. Covered California is the marketplace. ' + HR1, sources: [...KFF, CMS_SBE, KFF_WORK_REQ] },
  CO: { name: 'Colorado', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 265, pregnancyPctFpl: 265, exchange: 'state', exchangeUrl: 'https://connectforhealthco.com/',
    notes: 'Expansion state (Health First Colorado). Pregnancy: Medicaid to 195% FPL, CHIP to 260%, unborn-child option to 265%. Connect for Health Colorado is the marketplace. ' + HR1, sources: [...KFF, CMS_SBE, KFF_WORK_REQ] },
  CT: { name: 'Connecticut', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 323, pregnancyPctFpl: 263, exchange: 'state', exchangeUrl: 'https://www.accesshealthct.com/',
    notes: 'Expansion state (HUSKY). Access Health CT is the marketplace. ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  DE: { name: 'Delaware', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 217, pregnancyPctFpl: 217, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state. No CHIP premiums. ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  DC: { name: 'District of Columbia', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 324, pregnancyPctFpl: 324, exchange: 'state', exchangeUrl: 'https://www.dchealthlink.com/',
    notes: 'Expansion jurisdiction. In 2026 DC lowered parent and adult Medicaid limits from 221%/215% to 138% FPL and launched a Basic Health Program for 138-200% FPL. DC Health Link is the marketplace. ' + HR1, sources: [...KFF, KFF_SURVEY_2026, CMS_SBE, KFF_WORK_REQ] },
  FL: { name: 'Florida', expansion: false, adultPctFpl: 0, childlessAdultsCovered: false, parentsPctFpl: 26, chipUpperPctFpl: 215, pregnancyPctFpl: 196, exchange: 'federal', exchangeUrl: HCG,
    notes: GAP + ' Parents cut off at 26% FPL. ' + CHIP_PREMIUM, sources: [...KFF, KFF_PREMIUMS] },
  GA: { name: 'Georgia', expansion: false, adultPctFpl: 100, childlessAdultsCovered: true, parentsPctFpl: 100, chipUpperPctFpl: 252, pregnancyPctFpl: 225, exchange: 'state', exchangeUrl: 'https://georgiaaccess.gov/',
    notes: 'Not an ACA expansion state. Georgia Pathways to Coverage (Section 1115 waiver) covers adults 19-64 to 100% FPL only if they complete 80 hours/month of qualifying activities (work, school, volunteering; parents of Medicaid-enrolled children under six qualify since 10/1/2025); reporting is now at application and annual renewal. CMS extended Pathways through 12/31/2026 and the state says eligibility rules change 1/1/2027 to align with H.R. 1. KFF lists 100% for both parents and other adults on that basis; adults 100-138% FPL rely on marketplace subsidies. ' + CHIP_PREMIUM + ' Georgia Access is the state marketplace (state-run since plan year 2025).', sources: [...KFF, GA_PATHWAYS, GA_PATHWAYS_EXT, KFF_WORK_REQ_STATUS, KFF_PREMIUMS, CMS_SBE] },
  HI: { name: 'Hawaii', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 313, pregnancyPctFpl: 196, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (Med-QUEST). Hawaii uses its own higher poverty guideline (FPL_2025.HI / FPL_2026.HI). ' + HR1, sources: [...KFF, KFF_WORK_REQ] },
  ID: { name: 'Idaho', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 190, pregnancyPctFpl: 138, exchange: 'state', exchangeUrl: 'https://www.yourhealthidaho.org/',
    notes: 'Expansion state. Pregnancy limit 138% FPL is the lowest tier nationally. ' + CHIP_PREMIUM + ' Your Health Idaho is the marketplace. ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  IL: { name: 'Illinois', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 318, pregnancyPctFpl: 213, exchange: 'state', exchangeUrl: 'https://getcovered.illinois.gov/',
    notes: 'Expansion state. Get Covered Illinois is a fully state-run marketplace as of plan year 2026 (previously on the federal platform). ' + HR1, sources: [...KFF, CMS_SBE, KFF_WORK_REQ] },
  IN: { name: 'Indiana', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 255, pregnancyPctFpl: 213, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (Healthy Indiana Plan, with POWER account contributions). ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  IA: { name: 'Iowa', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 307, pregnancyPctFpl: 220, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state. Iowa cut its pregnancy limit from 375% to 215% FPL in 2026 (KFF prints 220% with the 5-point disregard). Hawki (CHIP) charges premiums. Work requirement implementation announced for 12/1/2026 via state plan amendment.', sources: [...KFF, KFF_SURVEY_2026, KFF_PREMIUMS, KFF_WORK_REQ_STATUS] },
  KS: { name: 'Kansas', expansion: false, adultPctFpl: 0, childlessAdultsCovered: false, parentsPctFpl: 38, chipUpperPctFpl: 255, pregnancyPctFpl: 171, exchange: 'federal', exchangeUrl: HCG,
    notes: GAP + ' Parents cut off at 38% FPL. ' + CHIP_PREMIUM, sources: [...KFF, KFF_PREMIUMS] },
  KY: { name: 'Kentucky', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 218, pregnancyPctFpl: 218, exchange: 'state', exchangeUrl: 'https://kynect.ky.gov/',
    notes: 'Expansion state. Pregnancy: Medicaid to 195% FPL, CHIP to 218%. kynect is the state marketplace. No CHIP premiums. ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  LA: { name: 'Louisiana', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 255, pregnancyPctFpl: 214, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state. Pregnancy: Medicaid to 138% FPL, CHIP to 214%. ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  ME: { name: 'Maine', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 305, pregnancyPctFpl: 214, exchange: 'state', exchangeUrl: 'https://www.coverme.gov/',
    notes: 'Expansion state. CoverME.gov is the marketplace. ' + HR1, sources: [...KFF, CMS_SBE, KFF_WORK_REQ] },
  MD: { name: 'Maryland', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 322, pregnancyPctFpl: 264, exchange: 'state', exchangeUrl: 'https://www.marylandhealthconnection.gov/',
    notes: 'Expansion state. Maryland Health Connection is the marketplace. ' + HR1, sources: [...KFF, CMS_SBE, KFF_WORK_REQ] },
  MA: { name: 'Massachusetts', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 305, pregnancyPctFpl: 205, exchange: 'state', exchangeUrl: 'https://www.mahealthconnector.org/',
    notes: 'Expansion state (MassHealth). Massachusetts Health Connector is the marketplace. ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  MI: { name: 'Michigan', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 217, pregnancyPctFpl: 200, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (Healthy Michigan Plan). No CHIP premiums. ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  MN: { name: 'Minnesota', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 288, pregnancyPctFpl: 283, exchange: 'state', exchangeUrl: 'https://www.mnsure.org/',
    notes: 'Expansion state (Medical Assistance); MinnesotaCare Basic Health Program sits above Medicaid. MNsure is the marketplace (CMS lists mn.gov/hix, which is the same exchange). ' + HR1, sources: [...KFF, CMS_SBE, KFF_WORK_REQ] },
  MS: { name: 'Mississippi', expansion: false, adultPctFpl: 0, childlessAdultsCovered: false, parentsPctFpl: 21, chipUpperPctFpl: 214, pregnancyPctFpl: 199, exchange: 'federal', exchangeUrl: HCG,
    notes: GAP + ' Parents cut off at 21% FPL. No CHIP premiums.', sources: [...KFF, KFF_PREMIUMS] },
  MO: { name: 'Missouri', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 305, pregnancyPctFpl: 305, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (2021 constitutional amendment). Pregnancy: Medicaid to 196% FPL, CHIP/unborn-child option to 305%. ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  MT: { name: 'Montana', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 266, pregnancyPctFpl: 162, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state. Implementing the H.R. 1 work requirement early, effective 7/1/2026, via state plan amendment (enrollee notices went out April 2026).', sources: [...KFF, KFF_WORK_REQ_STATUS] },
  NE: { name: 'Nebraska', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 218, pregnancyPctFpl: 202, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (2018 ballot initiative). Pregnancy: Medicaid to 199% FPL, CHIP to 202%. First state to enforce the H.R. 1 work requirement early, effective 5/1/2026, via state plan amendment.', sources: [...KFF, KFF_WORK_REQ_STATUS] },
  NV: { name: 'Nevada', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 205, pregnancyPctFpl: 205, exchange: 'state', exchangeUrl: 'https://www.nevadahealthlink.com/',
    notes: 'Expansion state. Pregnancy limit raised from 190% to 205% FPL effective July 2025. Nevada Health Link is the marketplace. Nevada Check Up (CHIP) charges quarterly premiums. ' + HR1, sources: [...KFF, KFF_SURVEY_2026, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  NH: { name: 'New Hampshire', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 323, pregnancyPctFpl: 201, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (Granite Advantage). No CHIP premiums. ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  NJ: { name: 'New Jersey', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 355, pregnancyPctFpl: 205, exchange: 'state', exchangeUrl: 'https://nj.gov/getcoverednj/',
    notes: 'Expansion state (NJ FamilyCare). Pregnancy: Medicaid to 194% FPL, CHIP to 205%. Get Covered New Jersey is the marketplace. ' + HR1, sources: [...KFF, CMS_SBE, KFF_WORK_REQ] },
  NM: { name: 'New Mexico', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 305, pregnancyPctFpl: 255, exchange: 'state', exchangeUrl: 'https://bewellnm.com/',
    notes: 'Expansion state. BeWellNM is the marketplace. No CHIP premiums. ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  NY: { name: 'New York', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 405, pregnancyPctFpl: 223, exchange: 'state', exchangeUrl: 'https://nystateofhealth.ny.gov/',
    notes: 'Expansion state. Child Health Plus reaches 405% FPL, the highest in the country; the Essential Plan (Basic Health Program) covers adults above Medicaid. NY State of Health is the marketplace. ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  NC: { name: 'North Carolina', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 216, pregnancyPctFpl: 201, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (expanded 12/1/2023). ' + HR1, sources: [...KFF, KFF_WORK_REQ] },
  ND: { name: 'North Dakota', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 205, pregnancyPctFpl: 175, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state. ' + HR1, sources: [...KFF, KFF_WORK_REQ] },
  OH: { name: 'Ohio', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 211, pregnancyPctFpl: 205, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state. No CHIP premiums. ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  OK: { name: 'Oklahoma', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 210, pregnancyPctFpl: 210, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (2020 ballot initiative; SoonerCare). Became a state-based exchange on the federal platform 5/1/2026 (run by the Oklahoma Insurance Department); residents keep enrolling on HealthCare.gov for plan years 2026 and 2027, with a full state exchange planned for the 2028 open enrollment. ' + HR1, sources: [...KFF, CMS_SBE, OK_OID, KFF_WORK_REQ] },
  OR: { name: 'Oregon', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 305, pregnancyPctFpl: 190, exchange: 'federal', exchangeUrl: HCG,
    nextPlanYear: { planYear: 2027, exchange: 'state', exchangeUrl: 'https://www.explorehealthor.gov/', from: '2026-11-01' },
    notes: 'Expansion state (Oregon Health Plan); OHP Bridge Basic Health Program covers 138-200% FPL. For 2026 coverage Oregon is a state-based exchange on the federal platform (enroll on HealthCare.gov). Starting 11/1/2026, 2027 coverage is enrolled at the new state-run ExploreHealthOR.gov (per HealthCare.gov and the CMS transition list). ' + HR1, sources: [...KFF, CMS_SBE, HCG_STATE, KFF_WORK_REQ] },
  PA: { name: 'Pennsylvania', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 319, pregnancyPctFpl: 220, exchange: 'state', exchangeUrl: 'https://pennie.com/',
    notes: 'Expansion state. Pennie is the marketplace. ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  RI: { name: 'Rhode Island', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 266, pregnancyPctFpl: 258, exchange: 'state', exchangeUrl: 'https://healthsourceri.com/',
    notes: 'Expansion state. Pregnancy: Medicaid to 190% FPL, CHIP/unborn-child option to 258%. HealthSource RI is the marketplace. ' + HR1, sources: [...KFF, CMS_SBE, KFF_WORK_REQ] },
  SC: { name: 'South Carolina', expansion: false, adultPctFpl: 0, childlessAdultsCovered: false, parentsPctFpl: 67, chipUpperPctFpl: 213, pregnancyPctFpl: 199, exchange: 'federal', exchangeUrl: HCG,
    notes: GAP + ' Parents cut off at 67% FPL. No CHIP premiums.', sources: [...KFF, KFF_PREMIUMS] },
  SD: { name: 'South Dakota', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 209, pregnancyPctFpl: 138, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (expanded 7/1/2023 by constitutional amendment). Pregnancy limit 138% FPL. ' + HR1, sources: [...KFF, KFF_WORK_REQ] },
  TN: { name: 'Tennessee', expansion: false, adultPctFpl: 0, childlessAdultsCovered: false, parentsPctFpl: 105, chipUpperPctFpl: 255, pregnancyPctFpl: 255, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Non-expansion. Adults without dependent children are ineligible; parents/caretakers covered to 105% FPL (TennCare), the highest parent limit among non-expansion states. KFF lists TennCare 1115 enrollees as subject to the H.R. 1 work requirement from 1/1/2027. No CHIP premiums.', sources: [...KFF, KFF_WORK_REQ, KFF_PREMIUMS] },
  TX: { name: 'Texas', expansion: false, adultPctFpl: 0, childlessAdultsCovered: false, parentsPctFpl: 15, chipUpperPctFpl: 206, pregnancyPctFpl: 207, exchange: 'federal', exchangeUrl: HCG,
    notes: GAP + ' Parents cut off at 15% FPL, the lowest in the country. Pregnancy: Medicaid to 203% FPL, CHIP perinatal to 207%. Texas CHIP charges an annual enrollment fee above 151% FPL.', sources: [...KFF, KFF_PREMIUMS] },
  UT: { name: 'Utah', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 205, pregnancyPctFpl: 144, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state (2018 ballot initiative). No CHIP premiums. ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  VT: { name: 'Vermont', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 317, pregnancyPctFpl: 213, exchange: 'state', exchangeUrl: 'https://healthconnect.vermont.gov/',
    notes: 'Expansion state. Vermont Health Connect is the marketplace. Dr. Dynasaur (CHIP) premiums suspended indefinitely. ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  VA: { name: 'Virginia', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 205, pregnancyPctFpl: 205, exchange: 'state', exchangeUrl: 'https://www.marketplace.virginia.gov/',
    notes: "Expansion state. Pregnancy: Medicaid to 143% FPL, FAMIS (CHIP) to 205%. Virginia's Insurance Marketplace (marketplace.virginia.gov) is the state-run exchange. No CHIP premiums. " + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  WA: { name: 'Washington', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 317, pregnancyPctFpl: 215, exchange: 'state', exchangeUrl: 'https://www.wahealthplanfinder.org/',
    notes: 'Expansion state (Apple Health). Washington Healthplanfinder is the marketplace. ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, CMS_SBE, KFF_PREMIUMS, KFF_WORK_REQ] },
  WV: { name: 'West Virginia', expansion: true, adultPctFpl: 138, childlessAdultsCovered: true, parentsPctFpl: 138, chipUpperPctFpl: 305, pregnancyPctFpl: 305, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Expansion state. Pregnancy: Medicaid to 185% FPL, CHIP to 305%. ' + CHIP_PREMIUM + ' ' + HR1, sources: [...KFF, KFF_PREMIUMS, KFF_WORK_REQ] },
  WI: { name: 'Wisconsin', expansion: false, adultPctFpl: 100, childlessAdultsCovered: true, parentsPctFpl: 100, chipUpperPctFpl: 306, pregnancyPctFpl: 306, exchange: 'federal', exchangeUrl: HCG,
    notes: 'Not an ACA expansion state, but BadgerCare Plus covers parents and childless adults to 100% FPL under a Section 1115 waiver (approved through 12/31/2029), so there is no coverage gap; adults 100-138% FPL use marketplace subsidies. State income limits effective 2/1/2026 already use the 2026 FPL. ' + CHIP_PREMIUM + ' Wisconsin DHS: the H.R. 1 work requirement applies to childless BadgerCare Plus adults 19-64 for new applicants from 1/1/2027 and for most current members at renewal from March 2027.', sources: [...KFF, WI_FPL, WI_WORK, KFF_SURVEY_2026, KFF_PREMIUMS] },
  WY: { name: 'Wyoming', expansion: false, adultPctFpl: 0, childlessAdultsCovered: false, parentsPctFpl: 43, chipUpperPctFpl: 205, pregnancyPctFpl: 159, exchange: 'federal', exchangeUrl: HCG,
    notes: GAP + ' Parents cut off at 43% FPL. No CHIP premiums.', sources: [...KFF, KFF_PREMIUMS] },
};

export const EXPANSION_STATE_COUNT = Object.values(STATE_MEDICAID).filter((s) => s.expansion).length;
