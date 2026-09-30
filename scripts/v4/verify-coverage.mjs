// @ts-check
// What composes (the 4.4 adoption fixes), in Chromium, WebKit and Firefox,
// against the published 4.3.1 in the same page. Each case is composed at
// 320 px in 18px Georgia by 4.3.1, by the candidate with coverage:
// 'extended' (opt-in) and by the candidate with coverage: 'core' (the
// default; the language and inline cases are also composed with no coverage
// option and must match 'core'), and text identity is checked after each.
//  - Language tags in other spellings (B): en_US, en_US.UTF-8 (CMS and PHP
//    templates), "english" and "Deutsch" compose exactly as the tag they spell.
//    4.3.1 left every such block native:language.
//  - Declared languages (C): pt, pt-BR, it, nl, pl, sv, tr, vi, fil, sw, ht,
//    sr-Latn and an unreadable tag compose with neutral preferences under
//    'extended' and stay native:language under coverage: 'core'; ar, he, ja,
//    zh, th, hi, ko, el and sr (Cyrillic) stay native:language under both.
//  - Descendants in another Latin-script language (C) are part of their
//    paragraph; a Japanese phrase still leaves it native:mixed-language.
//  - Greek and Cyrillic letters in Latin text (B): up to three in a row (5 μg,
//    α-synuclein, ΔG) compose under both coverages, and "5 μg" is kept
//    together; a Greek sentence or a longer Greek or Cyrillic word does not.
//  - Inline markup (C): a matrix of the markup the adoption review found in
//    real paragraphs. Under 'core' every case's outcome and markup equal
//    4.3.1's; under 'extended' time, dfn, kbd, ins, sup, sub, raised text and
//    visually hidden text compose, with no break inside hidden text, and
//    everything else (br, img, svg, a visible aria-hidden icon, ::after
//    icons, q, bdi, soft hyphens) is left as 4.3.1 left it.
//  - Smart quotes: 'en-declared' educates only declared English.
//  - Headings: headings: false leaves h1-h6 and role=heading untouched in
//    mount() and typesetAll(); typeset() composes the element it is given.
import { readFile, writeFile } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { artifacts } from './candidate.mjs';
import { releaseIdentity } from './release-evidence.mjs';

const watchdog = setTimeout(() => { console.error('verify-coverage: watchdog after 170 s'); process.exit(3); }, 170_000);
watchdog.unref();
const subject = await readFile(artifacts.bundle, 'utf8');
const published = await readFile('public/releases/4.3.1/typeset.global.js', 'utf8');
const report = { ...await releaseIdentity(), baseline: 'public/releases/4.3.1/typeset.global.js', checks: /** @type {any[]} */ ([]), errors: /** @type {any[]} */ ([]), browsers: /** @type {Record<string, string>} */ ({}), tables: /** @type {Record<string, unknown>} */ ({}) };

const PROSE = 'The clinic on Market Street offers free testing on Saturdays, and results arrive by text message within two days. Bring a photo ID and arrive a few minutes before your appointment so the front desk can check you in.';
const HEAD = 'The clinic on Market Street offers free testing on Saturdays, and results arrive by text message within two days';
const TAIL = 'Bring a photo ID and arrive a few minutes before your appointment so the front desk can check you in.';
const SR_ONLY = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
const CLIP_PATH = 'border:0;clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap';

/** Spellings of a declared language, and the tag each must compose like. */
const SPELLINGS = [['en_US', 'en-US'], ['EN_us', 'en-US'], ['en_US.UTF-8', 'en-US'], ['english', 'en'], ['English', 'en'], ['english_UK', 'en-GB'], ['en_GB', 'en-GB'], ['Deutsch', 'de'], ['francais', 'fr'], ['español', 'es']];
/** Declared languages: [tag, text, composes under coverage: 'extended']. */
const LANGUAGES = /** @type {[string, string, boolean][]} */ ([
  ['pt', 'A clínica oferece testes gratuitos aos sábados, e os resultados chegam por mensagem de texto em até dois dias. Traga um documento com foto e chegue alguns minutos antes da consulta.', true],
  ['pt-BR', 'O posto de saúde oferece vacinas gratuitas para toda a família durante a semana, e não é preciso marcar horário. Leve a carteira de vacinação e um documento com foto.', true],
  ['it', 'La clinica offre test gratuiti il sabato mattina, e i risultati arrivano con un messaggio entro due giorni. Porta un documento d’identità e arriva qualche minuto prima.', true],
  ['nl', 'De kliniek biedt op zaterdag gratis tests aan, en de uitslag komt binnen twee dagen per sms. Neem een identiteitsbewijs mee en kom een paar minuten voor je afspraak.', true],
  ['pl', 'Przychodnia oferuje bezpłatne badania w soboty, a wyniki przychodzą wiadomością tekstową w ciągu dwóch dni. Zabierz dokument ze zdjęciem i przyjdź kilka minut przed wizytą.', true],
  ['sv', 'Kliniken erbjuder gratis tester på lördagar, och resultaten kommer med sms inom två dagar. Ta med legitimation med foto och kom några minuter före din tid.', true],
  ['tr', 'Klinik cumartesi günleri ücretsiz test sunuyor ve sonuçlar iki gün içinde kısa mesajla geliyor. Fotoğraflı kimliğinizi getirin ve randevunuzdan birkaç dakika önce gelin.', true],
  ['vi', 'Phòng khám cung cấp xét nghiệm miễn phí vào thứ Bảy, và kết quả được gửi qua tin nhắn trong vòng hai ngày. Hãy mang theo giấy tờ tùy thân và đến sớm vài phút.', true],
  ['fil', 'Nag-aalok ang klinika ng libreng pagsusuri tuwing Sabado, at dumarating ang resulta sa text message sa loob ng dalawang araw. Magdala ng ID na may larawan.', true],
  ['sw', 'Kliniki inatoa vipimo vya bure kila Jumamosi, na majibu hufika kwa ujumbe mfupi ndani ya siku mbili. Leta kitambulisho chenye picha na ufike dakika chache mapema.', true],
  ['ht', 'Klinik la ofri tès gratis chak samdi, epi rezilta yo rive pa mesaj nan de jou. Pote yon pyès idantite ak foto epi vini kèk minit anvan randevou ou.', true],
  ['sr-Latn', 'Klinika nudi besplatno testiranje subotom, a rezultati stižu porukom u roku od dva dana. Ponesite ličnu kartu i dođite nekoliko minuta pre zakazanog termina.', true],
  ['{{ page.lang }}', PROSE, true],
  ['ar', 'تقدم العيادة فحوصات مجانية أيام السبت، وتصل النتائج برسالة نصية خلال يومين. أحضر بطاقة هوية بصورة.', false],
  ['he', 'המרפאה מציעה בדיקות חינם בשבת, והתוצאות מגיעות בהודעת טקסט תוך יומיים. הביאו תעודה מזהה עם תמונה.', false],
  ['ja', 'クリニックでは土曜日に無料検査を行っており、結果は二日以内にメッセージで届きます。写真付きの身分証明書をお持ちください。', false],
  ['zh', '诊所每周六提供免费检测，结果会在两天内通过短信发送。请携带带照片的身份证件，并提前几分钟到达。', false],
  ['th', 'คลินิกให้บริการตรวจฟรีทุกวันเสาร์ และผลตรวจจะส่งทางข้อความภายในสองวัน กรุณานำบัตรประจำตัวที่มีรูปถ่ายมาด้วย', false],
  ['hi', 'क्लिनिक शनिवार को मुफ्त जांच करता है, और परिणाम दो दिनों के भीतर संदेश से आते हैं। फोटो पहचान पत्र साथ लाएं।', false],
  ['ko', '클리닉은 토요일마다 무료 검사를 제공하며 결과는 이틀 안에 문자로 도착합니다. 사진이 있는 신분증을 가져오세요.', false],
  ['el', 'Η κλινική προσφέρει δωρεάν εξετάσεις κάθε Σάββατο, και τα αποτελέσματα φτάνουν με μήνυμα μέσα σε δύο ημέρες.', false],
  ['sr', 'Клиника нуди бесплатно тестирање суботом, а резултати стижу поруком у року од два дана. Понесите личну карту.', false],
  // The same Latin prose under a non-Latin tag: the tag decides, not the text.
  ['ja', PROSE, false],
]);
/** Descendants in another language: [id, host lang, html, composes under
 * coverage: 'extended', composes under core]. An en_US phrase in English is English
 * under both (a tag spelling, class B); the other phrases are coverage
 * additions (class C). */
const DESCENDANTS = /** @type {[string, string, string, boolean, boolean][]} */ ([
  ['es in en', 'en', `${HEAD}. Staff greet every visitor with <span lang="es">bienvenidos a la clínica</span> and a printed guide in both languages.`, true, false],
  ['de in en (WCAG 3.1.2)', 'en', `${HEAD}, and the sign on the door says <span lang="de">Herzlich willkommen</span> for the families who read German.`, true, false],
  ['en-GB in untagged', '', `The guide says the clinic will <span lang="en-GB">organise the queue by colour</span> on busy mornings, and staff hand out numbered cards at the door a few minutes before it opens.`, true, false],
  ['en_US in en', 'en', `${HEAD}, and the leaflet says <span lang="en_US">bring your insurance card</span> if you have one with you.`, true, true],
  ['ja in en', 'en', `The welcome sign at the clinic door reads <span lang="ja">ようこそ</span> beside the English and Spanish greetings, and the front desk keeps a printed guide in each language.`, false, false],
  ['ja-tagged Latin in en', 'en', `${HEAD}, and the sign says <span lang="ja">youkoso</span> in the same large letters as the English greeting.`, false, false],
]);
/** Greek and Cyrillic letters: [id, lang, text, composes]. */
const SCRIPTS = /** @type {[string, string, string, boolean][]} */ ([
  ['5 μg/mL', 'en', 'The usual starting dose is 5 μg/mL, given once a day with food, and the pharmacist will check the label with you before the first dose is taken at home.', true],
  ['α-synuclein', 'en', 'Researchers measured α-synuclein in the samples from every clinic in the study and found the same pattern across the three sites they visited last spring.', true],
  ['ΔG', 'en', 'The free energy change ΔG was negative for every reaction the students measured in the lab this week, and the report explains why in plain terms.', true],
  ['ПЦР', 'en', 'The lab ran a ПЦР test on every sample the clinic sent in, and the results arrived by text message within two days of the visit to the front desk.', true],
  ['Greek sentence, untagged', '', 'Η κλινική προσφέρει δωρεάν εξετάσεις κάθε Σάββατο, και τα αποτελέσματα φτάνουν με μήνυμα μέσα σε δύο ημέρες.', false],
  ['a Cyrillic word', 'en', 'The label on the box read Здравствуйте in large letters, and the pharmacist explained that it was a greeting printed for the families who read Russian.', false],
  ['four Greek letters in a row', 'en', 'The word αβγδ was printed on the label of every sample the clinic sent in, and the results arrived by text message within two days of the visit.', false],
]);
/** Inline markup: [id, html, composes under coverage: 'extended']. Hidden text is marked with data-hidden-text for the break check. */
const INLINE = /** @type {[string, string, boolean][]} */ ([
  ['plain', PROSE, true],
  ['a', `${HEAD}. <a href="#x">Read the full guide</a> before your appointment so the front desk can check you in.`, true],
  ['em and strong', `${HEAD}. <em>Bring a photo ID</em> and <strong>arrive a few minutes early</strong> so the front desk can check you in.`, true],
  ['code', `${HEAD}. Use the code <code>WALKIN</code> at the kiosk and arrive a few minutes before your appointment.`, true],
  ['abbr', `${HEAD}. Bring a photo <abbr title="identification">ID</abbr> and arrive a few minutes before your appointment.`, true],
  ['mark', `${HEAD}. <mark>Bring a photo ID</mark> and arrive a few minutes before your appointment so the desk can check you in.`, true],
  ['sup footnote', `${HEAD}.<sup>1</sup> ${TAIL}`, true],
  ['sup trademark', `The Typeset<sup>®</sup> script runs on every page of the clinic site, and results arrive by text message within two days. ${TAIL}`, true],
  ['sup, normalize.css', `${HEAD}.<sup style="font-size:75%;line-height:0;position:relative;vertical-align:baseline;top:-0.5em">2</sup> ${TAIL}`, true],
  ['sub', 'Drink water through the day; plain H<sub>2</sub>O is the best choice for most people, and the nurse can suggest how much to aim for in hot weather.', true],
  ['vertical-align: super', `${HEAD}.<span style="vertical-align:super;font-size:70%">3</span> ${TAIL}`, true],
  ['time', 'The walk-in hours start at <time datetime="09:00">9 a.m.</time> on weekdays and run until the last visitor has been seen, which is usually by early evening.', true],
  ['kbd', 'To make the text on this page larger, press <kbd>Ctrl</kbd> and the plus key together, and press them again until the size feels comfortable to read.', true],
  ['dfn', 'A <dfn>walk-in visit</dfn> needs no appointment, and the clinic also takes walk-in visits for vaccines on Saturday mornings before the lunch break.', true],
  ['ins', `${HEAD}, and <ins>as of this month</ins> the clinic also takes walk-in visits for vaccines on Saturday mornings.`, true],
  ['sr-only link text', `${HEAD}. <a href="#hours">Read more<span data-hidden-text style="${SR_ONLY}"> about testing hours</span></a> on the clinic page.`, true],
  ['sr-only, clip-path', `${HEAD}. <a href="#faq">Questions<span data-hidden-text style="${CLIP_PATH}"> about results</span></a> are answered on the help page every weekday.`, true],
  ['sr-only at the start', `<span data-hidden-text style="${SR_ONLY}">Note: </span>${PROSE}`, true],
  ['sr-only at the end', `${PROSE}<span data-hidden-text style="${SR_ONLY}"> End of note.</span>`, true],
  ['aria-hidden, empty', `${HEAD}.<span aria-hidden="true" data-hidden-text></span> ${TAIL}`, true],
  ['vertical-align: top', `${HEAD}.<span style="vertical-align:top;font-size:70%">3</span> ${TAIL}`, false],
  ['br', `${HEAD}.<br>${TAIL}`, false],
  ['img', `${HEAD}. <img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="12" height="12"> ${TAIL}`, false],
  ['svg icon', `${HEAD}. <svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5"></circle></svg> ${TAIL}`, false],
  ['aria-hidden, visible icon', `${HEAD}. <a href="#map"><span aria-hidden="true">→</span> See the map</a> for parking and the bus stops nearest the entrance.`, false],
  ['::after link icon', `${HEAD}. <a class="external" href="#out">Read the county guide</a> before your appointment so the desk can check you in.`, false],
  ['q', `${HEAD}. The sign says <q>walk-ins welcome</q> and the front desk will check you in on arrival.`, false],
  ['bdi', `${HEAD}. Ask for <bdi>Dr. Nguyen</bdi> at the front desk and arrive a few minutes before your appointment.`, false],
  ['soft hyphen', `${HEAD}. Bring a photo iden\u00adtification and arrive a few minutes before your appointment.`, false],
  ['hyphens: auto', `<span style="hyphens:auto">${PROSE}</span>`, false],
]);

/**
 * Runs in the page: compose one paragraph per case with the build and
 * options named, and describe what happened.
 * @param {{ cases: { id: string, html: string, lang?: string, options?: Record<string, unknown> }[], build: 'Typeset' | 'Published', options: Record<string, unknown> }} input
 */
function compose({ cases, build, options }) {
  const api = /** @type {any} */ (window)[build];
  return cases.map(item => {
    const el = document.createElement('p');
    el.style.cssText = 'font:18px/1.5 Georgia, serif;width:320px;margin:0 0 12px;';
    if (item.lang !== undefined) el.setAttribute('lang', item.lang);
    el.innerHTML = item.html;
    document.body.append(el);
    const text = el.textContent || '';
    // The markup as the engine's CSP-safe restore leaves it: style attributes
    // as the CSSOM serializes them (it writes styles back through cssText).
    const canonical = () => { const copy = /** @type {HTMLElement} */ (el.cloneNode(true)); for (const node of copy.querySelectorAll('[style]')) node.setAttribute('style', /** @type {HTMLElement} */ (node).style.cssText); return copy.innerHTML; };
    const authored = canonical();
    // Source ranges of text marked hidden, for the break check.
    const hidden = [...el.querySelectorAll('[data-hidden-text]')].map(span => { const range = document.createRange(); range.setStart(el, 0); range.setEndBefore(span); const start = range.toString().length; return [start, start + (span.textContent || '').length]; });
    let result;
    try { result = api.typeset(el, { ...options, ...item.options }); } catch (error) { result = { outcome: 'threw ' + /** @type {Error} */ (error).message }; }
    const after = api.measureLayout(el);
    const breaks = [...el.querySelectorAll('br[data-ts-break]')].map(br => { const range = document.createRange(); range.setStart(el, 0); range.setEndBefore(br); return range.toString().length; });
    const record = { id: item.id, outcome: String(result.outcome), breaks, lines: after.lines.length, overflow: after.overflow, textIntact: el.textContent === text, markup: el.innerHTML, quotes: result.features?.quotes,
      text: el.textContent, breakInHidden: breaks.some(at => hidden.some(([start, end]) => at > start && at < end)), restored: false };
    api.restore(el);
    record.restored = canonical() === authored && el.textContent === text;
    el.remove();
    return record;
  });
}

const composes = (/** @type {string} */ outcome) => outcome.startsWith('composed') || ['native:fits', 'native:sentence-aligned', 'native:paragraph-rhythm'].includes(outcome);

for (const { name, engine, executablePath } of browsers) {
  const browser = await engine.launch({ executablePath, timeout: 20_000 });
  report.browsers[name] = browser.version();
  const check = (/** @type {string} */ label, /** @type {unknown} */ pass, /** @type {unknown} */ detail) => report.checks.push({ browser: name, label, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (/** @type {Error} */ error) => report.errors.push({ browser: name, error: error.message }));
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:24px}a.external::after{content:" \\2197"}</style></head><body></body></html>');
    await page.addScriptTag({ content: published });
    await page.evaluate(() => { /** @type {any} */ (window).Published = /** @type {any} */ (window).Typeset; });
    await page.addScriptTag({ content: subject });
    /** @param {any[]} cases */
    const run = async cases => ({
      extended: await page.evaluate(compose, { cases, build: 'Typeset', options: { coverage: 'extended' } }),
      core: await page.evaluate(compose, { cases, build: 'Typeset', options: { coverage: 'core' } }),
      published: await page.evaluate(compose, { cases, build: 'Published', options: {} }),
    });
    /** Cases composed with no coverage option whose outcome or breaks differ
     * from coverage: 'core', the default. @param {any[]} cases @param {Awaited<ReturnType<typeof run>>} got */
    const notCore = async (cases, got) => (await page.evaluate(compose, { cases, build: 'Typeset', options: {} }))
      .filter((record, i) => record.outcome !== got.core[i].outcome || record.breaks.join() !== got.core[i].breaks.join())
      .map(record => ({ id: record.id, outcome: record.outcome }));
    /** Records of every build whose text or restore failed. @param {Awaited<ReturnType<typeof run>>} got */
    const damaged = got => [...got.extended, ...got.core, ...got.published].filter(record => !record.textIntact || !record.restored || /^threw/.test(record.outcome));

    // Language tags in other spellings (B) compose exactly as the tag they
    // spell, under both coverages; 4.3.1 left en_US and english native.
    {
      const cases = SPELLINGS.flatMap(([spelling, tag]) => [{ id: spelling, html: PROSE, lang: spelling }, { id: spelling + ' as ' + tag, html: PROSE, lang: tag }]);
      const got = await run(cases);
      const table = SPELLINGS.map(([spelling, tag], i) => ({ spelling, tag, subject: got.extended[i * 2].outcome, as: got.extended[i * 2 + 1].outcome, core: got.core[i * 2].outcome, published: got.published[i * 2].outcome,
        same: JSON.stringify(got.extended[i * 2].breaks) === JSON.stringify(got.extended[i * 2 + 1].breaks) && JSON.stringify(got.core[i * 2].breaks) === JSON.stringify(got.core[i * 2 + 1].breaks) }));
      report.tables[name + ' spellings'] = table;
      check('language spellings: each composes exactly as the tag it spells, under both coverages (en_US as en-US, english as en, Deutsch as de)', table.every(row => row.subject === row.as && row.core === row.as && row.same && /^composed/.test(row.subject)), table);
      check('language spellings: 4.3.1 left en_US, en_US.UTF-8 and english native (negative control)', table.filter(row => ['en_US', 'en_US.UTF-8', 'english'].includes(row.spelling)).every(row => row.published === 'native:language'), table);
      check('language spellings: text intact and restored', damaged(got).length === 0, damaged(got));
    }

    // Declared languages (C).
    {
      const cases = LANGUAGES.map(([tag, text]) => ({ id: tag, html: text, lang: tag }));
      const got = await run(cases);
      const table = LANGUAGES.map(([tag, , expected], i) => ({ tag, expected, extended: got.extended[i].outcome, core: got.core[i].outcome, published: got.published[i].outcome }));
      report.tables[name + ' languages'] = table;
      const wrong = table.filter(row => row.expected ? !composes(row.extended) || row.core !== 'native:language' : row.extended !== 'native:language' || row.core !== 'native:language');
      check('languages: pt, pt-BR, it, nl, pl, sv, tr, vi, fil, sw, ht, sr-Latn and an unreadable tag compose under coverage: extended and stay native:language under coverage: core; ar, he, ja, zh, th, hi, ko, el and sr stay native:language', !wrong.length, wrong.length ? wrong : table);
      const byDefault = await notCore(cases, got);
      check('languages: with no coverage option every case composes as under coverage: core (the default)', !byDefault.length, byDefault);
      check('languages: 4.3.1 left every one of them native:language (negative control)', table.every(row => row.published === 'native:language'), table.filter(row => row.published !== 'native:language'));
      check('languages: text intact and restored', damaged(got).length === 0, damaged(got));
    }

    // Descendants in another language (C).
    {
      const cases = DESCENDANTS.map(([id, lang, html]) => ({ id, html, lang }));
      const got = await run(cases);
      const table = DESCENDANTS.map(([id, , , expected, core], i) => ({ id, expected, expectedCore: core, extended: got.extended[i].outcome, core: got.core[i].outcome, published: got.published[i].outcome }));
      report.tables[name + ' descendants'] = table;
      const wrong = table.filter(row => row.expected
        ? !composes(row.extended) || (row.expectedCore ? !composes(row.core) : row.core !== row.published)
        : !row.extended.startsWith('native:') || row.extended !== row.published || row.core !== row.published);
      check('descendants: a Latin-script phrase in another language is part of its paragraph under coverage: extended and left as 4.3.1 left it under core (an en_US phrase in English composes under both); a Japanese phrase stays native', !wrong.length, table);
      check('descendants: text intact and restored', damaged(got).length === 0, damaged(got));
    }

    // Greek and Cyrillic letters (B).
    {
      const cases = SCRIPTS.map(([id, lang, html]) => ({ id, html, lang }));
      const got = await run(cases);
      const table = SCRIPTS.map(([id, , , expected], i) => ({ id, expected, extended: got.extended[i].outcome, core: got.core[i].outcome, published: got.published[i].outcome }));
      report.tables[name + ' scripts'] = table;
      const wrong = table.filter(row => row.expected ? !composes(row.extended) || !composes(row.core) : !/^native:(script|language)$/.test(row.extended) || row.core !== row.extended);
      check('scripts: up to three Greek or Cyrillic letters in Latin text compose under both coverages; a Greek sentence, a Cyrillic word and four Greek letters in a row stay native', !wrong.length, table);
      check('scripts: 4.3.1 left every one of them native (negative control)', table.every(row => /^native:(script|language)$/.test(row.published)), table);
      check('scripts: text intact and restored', damaged(got).length === 0, damaged(got));
      // The unit binding in phrase-boundaries ("5 μg", a charge for splitting
      // a number from its unit) is reachable now: from 150 to 400 px, a
      // composed break falls between "5" and "μg" only where one falls
      // between "5" and "mg" in the same sentence (4.3 declined the block).
      const bound = await page.evaluate(unit => {
        const split = /** @type {Record<string, number[]>} */ ({}), composedAt = /** @type {Record<string, number>} */ ({});
        for (const symbol of [unit, 'mg']) {
          const text = `The usual starting dose is 5 ${symbol}, given once a day with food, and the pharmacist will check the label with you before the first dose is taken at home.`;
          const el = document.createElement('p'); el.lang = 'en'; el.textContent = text; document.body.append(el);
          split[symbol] = []; composedAt[symbol] = 0;
          for (let width = 150; width <= 400; width += 5) {
            el.style.cssText = `font:18px/1.5 Georgia, serif;width:${width}px;margin:0`;
            const result = /** @type {any} */ (window).Typeset.typeset(el);
            if (String(result.outcome).startsWith('composed')) composedAt[symbol]++;
            const at = text.indexOf(symbol + ',');
            if ([...el.querySelectorAll('br[data-ts-break]')].some(br => { const range = document.createRange(); range.setStart(el, 0); range.setEndBefore(br); return range.toString().length === at; })) split[symbol].push(width);
            /** @type {any} */ (window).Typeset.restore(el);
          }
          el.remove();
        }
        return { split, composed: composedAt };
      }, 'μg');
      check('scripts: "5 μg" is bound like "5 mg": a composed break splits it only where it splits "5 mg" (widths 150 to 400 px)', bound.split['μg'].every(width => bound.split.mg.includes(width)) && bound.composed['μg'] > 10, bound);
    }

    // Inline markup (C).
    {
      const cases = INLINE.map(([id, html]) => ({ id, html, lang: 'en' }));
      const got = await run(cases);
      const table = INLINE.map(([id, , expected], i) => ({ id, expected, extended: got.extended[i].outcome, core: got.core[i].outcome, published: got.published[i].outcome }));
      report.tables[name + ' inline'] = table;
      const wrong = table.filter(row => row.expected ? !composes(row.extended) : row.extended !== row.published);
      check(`inline: ${INLINE.filter(([, , c]) => c).length} cases compose under coverage: extended, and the ${INLINE.filter(([, , c]) => !c).length} others are left as 4.3.1 left them`, !wrong.length, wrong.length ? wrong : table);
      const coreDiffers = table.filter((row, i) => row.core !== row.published || got.core[i].breaks.join() !== got.published[i].breaks.join());
      check('inline: under coverage: core every case has 4.3.1\'s outcome and breaks', !coreDiffers.length, coreDiffers);
      const byDefault = await notCore(cases, got);
      check('inline: with no coverage option every case composes as under coverage: core (the default)', !byDefault.length, byDefault);
      const newlyComposed = got.extended.filter((record, i) => INLINE[i][2] && record.outcome.startsWith('composed'));
      const unsafe = newlyComposed.filter(record => record.overflow > .5 || record.lines !== record.breaks.length + 1 || record.breakInHidden);
      check('inline: every composed case renders its composed lines, without overflow, and no break falls inside hidden text', newlyComposed.length >= 10 && !unsafe.length, { composed: newlyComposed.length, unsafe: unsafe.map(record => ({ id: record.id, overflow: record.overflow, lines: record.lines, breaks: record.breaks, breakInHidden: record.breakInHidden })) });
      check('inline: text intact and restored', damaged(got).length === 0, damaged(got));
    }

    // Smart quotes: 'en-declared' educates declared English only; 'en'
    // educates untagged text too and reads en_US as English.
    {
      const QUOTED = '"Hello," she said, and the nurse at the front desk looked up from the schedule to ask whether she had an appointment that morning or had walked in.';
      const cases = [['en-declared, untagged', '', 'en-declared'], ['en-declared, lang="en"', 'en', 'en-declared'], ['en-declared, lang="en_US"', 'en_US', 'en-declared'], ['en-declared, lang="de"', 'de', 'en-declared'], ['en, untagged', '', 'en'], ['en, lang="en_US"', 'en_US', 'en']]
        .map(([id, lang, smartQuotes]) => ({ id, html: QUOTED, lang, options: { smartQuotes } }));
      const got = await page.evaluate(compose, { cases, build: 'Typeset', options: {} });
      const curled = got.map(record => ({ id: record.id, quotes: record.quotes, curled: record.text?.startsWith('\u201cHello,\u201d') }));
      report.tables[name + ' quotes'] = curled;
      check('quotes: en-declared curls declared English (en, en_US) only; en also curls untagged text and reads en_US as English', JSON.stringify(curled.map(row => row.curled)) === JSON.stringify([false, true, true, false, true, true])
        && curled[0].quotes === 'native:quotes-scope' && curled[3].quotes === 'native:quotes-scope' && curled[1].quotes === 'applied', curled);
    }

    // Headings: headings: false.
    {
      const headings = await page.evaluate(() => {
        const api = /** @type {any} */ (window).Typeset;
        const root = document.createElement('section');
        root.innerHTML = '<h2 style="font:24px/1.3 Georgia;width:260px">The clinic on Market Street offers free testing on Saturdays</h2>'
          + '<div role="heading" aria-level="3" style="font:20px/1.3 Georgia;width:220px">Results arrive by text message within two days</div>'
          + '<p style="font:18px/1.5 Georgia;width:320px">The clinic on Market Street offers free testing on Saturdays, and results arrive by text message within two days. Bring a photo ID and arrive a few minutes early.</p>';
        document.body.append(root);
        const authored = [...root.children].map(el => el.outerHTML);
        const all = api.typesetAll('section h2, section [role=heading], section p', { headings: false });
        const afterAll = [...root.children].map(el => el.outerHTML);
        const pOutcome = /** @type {HTMLElement} */ (root.querySelector('p')).dataset.tsOutcome;
        for (const el of root.children) api.restore(el);
        const single = api.typeset(root.querySelector('h2'), { headings: false }).outcome;
        api.restore(root.querySelector('h2'));
        // (typeset() and restore() rewrote the h2's style attribute through
        // the CSSOM; mount() must leave the headings as they are now.)
        const beforeMount = [...root.children].map(el => el.outerHTML);
        const controller = api.mount(root, 'h2, [role=heading], p', { headings: false });
        return controller.ready.then(() => {
          const mounted = [...root.children].map(el => el.outerHTML);
          const mountedP = /** @type {HTMLElement} */ (root.querySelector('p')).dataset.tsOutcome;
          controller.disconnect();
          root.remove();
          return { results: all.length, headingsUntouched: afterAll.slice(0, 2).every((html, i) => html === authored[i]), pOutcome, single, mountedUntouched: mounted.slice(0, 2).every((html, i) => html === beforeMount[i]), mountedP };
        });
      });
      check('headings: false: typesetAll() and mount() leave h2 and role=heading byte for byte, with no outcome, and compose the paragraph; typeset() composes the heading it is given', headings.results === 1 && headings.headingsUntouched && headings.mountedUntouched
        && /^composed/.test(String(headings.pOutcome)) && /^composed/.test(String(headings.mountedP)) && headings.single !== undefined && !String(headings.single).startsWith('skipped'), headings);
    }
  } catch (error) { report.errors.push({ browser: name, error: String(/** @type {Error} */ (error).stack) }); }
  finally { await browser.close(); }
}
report.summary = { checks: report.checks.length, failed: report.checks.filter(c => !c.pass).length, errors: report.errors.length };
await writeFile('output/coverage.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, failures: report.checks.filter(c => !c.pass).slice(0, 10), errors: report.errors }, null, 2));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;
