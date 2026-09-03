/**
 * transition-health headless smoke test — funnel + tour lifecycle + engine wiring.
 *
 *   node transition-health/test/smoke.mjs        # from tbv-tools/
 *
 * Same harness as va-affordability/test/smoke.mjs: built-in static server +
 * installed Chrome via --dump-dom. Assertions check RENDERED OUTPUT.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import process from 'node:process';

const execFileP = promisify(execFile);
const PORT = 8913;
const BASE = `http://localhost:${PORT}/transition-health/`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SHARE = '?mode=voluntary&sep=2026-12-01&sp=yes&ch=1&cb=no&r=none&nx=job&js=2027-01-15&spp=no&us=typical&inc=60000';
const INVOL = '?mode=involuntary&sep=2026-12-01&sp=yes&ch=2&cb=yes&r=pending&nx=gap&tt=involuntary';
const PT = '?mode=voluntary&sep=2026-11-15&sp=yes&ch=1&cb=yes&r=pt&nx=unsure';
const RET = '?mode=retiring&sep=2026-12-31&sp=yes&ch=0&r=70&nx=job&js=2027-02-01';
const OUT = '?mode=out&sep=2026-06-01&sp=no&ch=0&cb=no&r=none&nx=gap';

let failures = 0;
function check(ok, label, extra = '') { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`); }

async function dumpDom(url) {
  const { stdout } = await execFileP(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=7000', '--dump-dom', url], { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(PORT, r));
process.on('exit', () => server.close());

const text = (html, id) => { const m = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<\\/(?:div|p|span|td|h3)>`)); return m ? m[1].replace(/<[^>]+>/g, ' ') : ''; };

try {
  // --- First visit ------------------------------------------------------
  const first = await dumpDom(BASE);
  check(/id="mode-briefing"[^>]*>[^<]{20,}/.test(first), 'mode briefing filled (module executed)');
  check(/id="hero-verdict"[^>]*style="display:\s*none/.test(first), 'results GATED on first load');
  check(/id="tour-root"(?![^>]*hidden)/.test(first), 'input tour auto-starts');
  check(/Step 1 of 7/.test(first), 'input tour has 7 steps');
  check(/id="about-this-tool"/.test(first) && /id="how-it-works"/.test(first), 'GEO intro + methodology present');
  check(/"@type":\s*"FAQPage"/.test(first) && /"@type":\s*"WebApplication"/.test(first), 'JSON-LD present');
  check((first.match(/class="faq-item"/g) || []).length === 5, 'visible FAQ mirrors JSON-LD (5)');
  check(/class="req-tag"/.test(first) && /class="req-legend"/.test(first), 'required tag + legend present');
  check(/Required to run:/.test(text(first, 'live-strip')), 'live strip names the requirement while unmet');
  check(/G-HG7N8F337G/.test(first) && first.indexOf('gtag') < first.indexOf('<meta charset'), 'GA4 first in head');
  check(/id="field-tamp-type"(?![^>]*hidden)/.test(first) && /Voluntary separation at end of contract/.test(first), 'voluntary mode shows separation-type field with voluntary default');
  check(/TAMP: no\./.test(first), 'voluntary default: TAMP no hint');

  // --- Share link: voluntary, spouse + child, job in 6 weeks ------------
  const shared = await dumpDom(BASE + SHARE);
  check(/id="hero-verdict"[^>]*style="display:\s*block/.test(shared), 'share link reveals results');
  check(/id="tour-root"[^>]*hidden/.test(shared), 'tours suppressed for share arrival');
  check(/id="hero-capture"[^>]*style="display:\s*block/.test(shared), 'result-moment capture shown');
  check(/TRICARE ends Dec 1, 2026/.test(shared), 'hero names the separation date');
  check(/class="nc-amount">0 days</.test(shared), 'runway tile = 0 days for voluntary');
  check(/uninsured days<\/span>/.test(shared) && /gap-bad/.test(shared), 'do-nothing tile shows uninsured days in red');
  check(/Do this first/.test(shared), 'first-move chip present');
  check((shared.match(/class="tl-row"/g) || []).length === 2, 'timeline has two rows (you + family)');
  check(/tl-seg uninsured/.test(shared) === false || /path-tab active/.test(shared), 'best path drawn first');
  check(/class="path-tab active"[^>]*>(?!Wait)/.test(shared), 'active tab is not the wait path');
  check(/Recommended<\/span>/.test(shared), 'path table marks the recommended row');
  check(/CHCBP election window/.test(shared) && /Marketplace special enrollment/.test(shared), 'CHCBP + marketplace clocks');
  check(!/Spouse's employer plan special enrollment/.test(shared), 'no spouse clock without spouse plan');
  check(/VA one-time dental treatment/.test(shared), 'VA dental clock');
  check(/Employer plan starts \(30-day waiting period assumed\)/.test(shared), 'employer clock uses waiting period');
  check(/Income-tested/.test(shared), 'ladder: unrated non-combat shows income-tested');
  check(/CHAMPVA, \$0 premium/.test(shared), 'ladder: P&T rung unlocks CHAMPVA');
  check(/after a premium tax credit/.test(shared), 'marketplace subsidy note with income entered');
  check(/TAMP is not for voluntary separations/.test(shared), 'voluntary trap present');
  check(/File your BDD claim/.test(shared), 'BDD action present');
  check(/class="act-sub"/.test(shared) && /DD 2807-1 \/ DD 2808/.test(shared) && /one-time dental window/.test(shared), 'pre-separation checklist renders with the dental trade-off');
  check(/id="state"/.test(shared) && /<option value="TX">Texas<\/option>/.test(shared), 'state select populated');
  const priced = await dumpDom(BASE + SHARE + '&st=TX&va=28&sa=27');
  check(/Priced from Texas's 2026 benchmark silver plan/.test(priced), 'marketplace priced from the state benchmark when a state is chosen');
  check(/national average benchmark/.test(shared), 'no state: national average benchmark, labeled');
  const medi = await dumpDom(BASE + '?mode=voluntary&sep=2026-12-01&sp=yes&ch=1&cb=no&r=none&nx=gap&st=CA&inc=24000');
  check(/Medicaid for the household \(California\).*Recommended/.test(medi.replace(/\n/g, ' ')), 'CA family at ~90% FPL: Medicaid recommended');
  check(/Apply for Medicaid in California/.test(medi), 'Medicaid action names the state');
  const chip = await dumpDom(BASE + '?mode=voluntary&sep=2026-12-01&sp=yes&ch=1&cb=no&r=none&nx=gap&st=TX&inc=24000');
  check(!/Medicaid for the household/.test(chip) && /Apply for CHIP for the kids in Texas/.test(chip), 'TX family at ~90% FPL: no Medicaid path, CHIP action for the kids');
  check(/Official places to enroll and get free help/.test(shared) && /healthcare\.gov\/see-plans/.test(shared) && /localhelp\.healthcare\.gov/.test(shared) && /find-rep/.test(shared), 'official links panel: marketplace, local help, VSO finder');
  check(/id="action-bar"[^>]*style="display:\s*flex/.test(shared), 'action bar shown');

  // --- Involuntary: TAMP -------------------------------------------------
  const inv = await dumpDom(BASE + INVOL);
  check(/class="nc-amount">180 days</.test(inv), 'involuntary: runway 180 days');
  check(/TAMP through May 29, 2027/.test(inv), 'TAMP last covered day = May 29, 2027 (180 days beginning on the separation date)');
  check(/Last day of TAMP \(180 days from separation\)/.test(inv), 'TAMP clock present');
  check(/id="reserve-fields"[^>]*hidden/.test(inv), 'reserve-only fields hidden outside reserve mode');
  check(/data-label="TAMP ends"/.test(inv), 'timeline marker for TAMP end');
  check(/Combat or toxic-exposure service enrolls you directly/.test(inv), 'combat: VA direct enrollment reason');
  check(/VA combat-veteran enhanced enrollment/.test(inv), '10-year window clock');
  check(!/TAMP is not for voluntary/.test(inv), 'no voluntary trap for involuntary');

  // --- P&T: CHAMPVA wins ---------------------------------------------------
  const pt = await dumpDom(BASE + PT);
  check(/CHAMPVA for the family \+ VA for you.*Recommended/.test(pt.replace(/\n/g, ' ')), 'P&T: CHAMPVA recommended');
  check(/CHAMPVA application \(no deadline; apply now\)/.test(pt), 'CHAMPVA soft clock');
  check(/Run the CHAMPVA tool/.test(pt), 'hero cross-links CHAMPVA');

  // --- Retiring ------------------------------------------------------------
  const ret = await dumpDom(BASE + RET);
  check(/No gap\. Here's what changes\./.test(ret), 'retiring hero');
  check(/Retiree TRICARE Select/.test(ret) && /Retiree TRICARE Prime/.test(ret), 'retiree Select + Prime paths');
  check(/FEDVIP dental\/vision \(31 days before to 60 days after retirement\)/.test(ret) && !/VA one-time dental treatment \(180 days after discharge\)/.test(ret), 'retiree: FEDVIP clock, no VA one-time dental clock');
  check(/Enroll in retiree TRICARE Prime or Select \(90 days after retirement\)/.test(ret), 'retiree 90-day enrollment clock');
  check(/id="field-retiree-group"(?![^>]*hidden)/.test(ret), 'retiree group field visible');
  check(/Show My Retiree Coverage Plan/.test(ret), 'gate button relabels per mode');
  check(!/see-plans/.test(ret), 'retiree: no marketplace link');
  check(/benefeds\.gov/.test(ret) && /LifeEvents\/Retiring/.test(ret), 'retiree: FEDVIP + retiree enrollment links');

  // --- Already out ---------------------------------------------------------
  const out = await dumpDom(BASE + OUT);
  check(/days out\. Here's what's still open\./.test(out), 'out-mode hero');
  check(/windows? closed, \d+ still open/.test(out), 'out-mode hero counts closed and open windows');
  check(/\(starting today\)/.test(out), 'out-mode timeline starts today');
  const ZAK = '?mode=out&sep=2018-06-20&sp=no&ch=0&cb=yes&r=none&nx=unsure';
  const zak = await dumpDom(BASE + ZAK);
  check(/VA health care \(enroll\).*Recommended/.test(zak.replace(/\n/g, ' ')), 'single combat vet out since 2018: VA enrollment recommended');
  check(/class="nc-amount">730 uninsured days</.test(zak), 'do-nothing tile = 730 uninsured days');
  check(/class="clock missed/.test(out), 'closed windows rendered as missed');
  check(/class="clock open/.test(out), 'some windows still open');

  // --- Spouse view + dependents block ----------------------------------------
  check(/id="viewer-toggle"[^>]*aria-pressed="false"/.test(first), 'viewer toggle present and OFF by default');
  check(/What separation does to each person in the house/.test(shared) && /Your spouse\./.test(shared), 'dependents block renders for a family household');
  check(/id="spouse-panel"[^>]*style="display:\s*none/.test(shared), 'spouse card hidden in member view');
  check(/Copy a link to the spouse view/.test(shared), 'member view offers the spouse-view link');
  const spouseView = await dumpDom(BASE + SHARE.replace('spp=no', 'spp=yes') + '&who=spouse');
  check(/aria-pressed="true"/.test(spouseView) && /Spouse view on/.test(spouseView), 'who=spouse turns the toggle on');
  check(/Your veteran and your household/.test(spouseView) && /Do YOU have an employer plan/.test(spouseView), 'spouse view re-labels the form');
  check(/Things only you can do/.test(spouseView) && /Request special enrollment at YOUR HR/.test(spouseView), 'spouse card renders with HIPAA item');
  check(/class="tl-label">Your veteran</.test(spouseView) && /class="tl-label">You \+ kids</.test(spouseView), 'timeline rows re-voiced');
  check(/chip chip-navy">Your veteran</.test(spouseView), 'hero chip re-voiced');
  check(!/What separation does to each person/.test(out), 'no dependents block for a single veteran');

  // --- Mode-only link stays gated ---------------------------------------
  const modeOnly = await dumpDom(BASE + '?mode=reserve');
  check(/id="hero-verdict"[^>]*style="display:\s*none/.test(modeOnly), 'mode-only link stays gated');
  check(/id="reserve-fields"(?![^>]*hidden)/.test(modeOnly), 'reserve mode shows reserve fields');
} catch (e) {
  failures++;
  console.log('FAIL  harness error —', e.message);
}
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
process.exit(failures ? 1 : 0);
