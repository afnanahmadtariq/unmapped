// Generates the full ISO 3166-1 alpha-2 country registry used by both
// apps/web and apps/api. The 3 curated snapshot countries (GH/BD/KE) keep
// their hand-tuned values; everything else is derived from a region +
// income-group default table so the system can serve users from any country
// via the live World Bank fallback path.
//
// Run: node scripts/generate-countries.mjs

import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ----------------------------------------------------------------------------
// 1. SOURCE OF TRUTH: ISO 3166-1 alpha-2 + alpha-3 + name + region +
//    World Bank income group + ISO 4217 currency code + symbol +
//    primary UI language (must be one of our 15 supported locales,
//    falling back to "en"). Compact rows so the file stays readable.
//
//    Region values match the World Bank 7-region taxonomy.
//    Income groups: HIC (high), UMC (upper middle), LMC (lower middle), LIC.
// ----------------------------------------------------------------------------

// Format: code, iso3, name, region, income, currency, symbol, locale
const ROWS = [
  // ====== Sub-Saharan Africa ======
  ["AO","AGO","Angola","Sub-Saharan Africa","LMC","AOA","Kz","pt"],
  ["BF","BFA","Burkina Faso","Sub-Saharan Africa","LIC","XOF","CFA","fr"],
  ["BI","BDI","Burundi","Sub-Saharan Africa","LIC","BIF","FBu","fr"],
  ["BJ","BEN","Benin","Sub-Saharan Africa","LMC","XOF","CFA","fr"],
  ["BW","BWA","Botswana","Sub-Saharan Africa","UMC","BWP","P","en"],
  ["CD","COD","Congo, Dem. Rep.","Sub-Saharan Africa","LIC","CDF","FC","fr"],
  ["CF","CAF","Central African Republic","Sub-Saharan Africa","LIC","XAF","FCFA","fr"],
  ["CG","COG","Congo, Rep.","Sub-Saharan Africa","LMC","XAF","FCFA","fr"],
  ["CI","CIV","Côte d'Ivoire","Sub-Saharan Africa","LMC","XOF","CFA","fr"],
  ["CM","CMR","Cameroon","Sub-Saharan Africa","LMC","XAF","FCFA","fr"],
  ["CV","CPV","Cabo Verde","Sub-Saharan Africa","LMC","CVE","Esc","pt"],
  ["DJ","DJI","Djibouti","Sub-Saharan Africa","LMC","DJF","Fdj","fr"],
  ["ER","ERI","Eritrea","Sub-Saharan Africa","LIC","ERN","Nfk","ar"],
  ["ET","ETH","Ethiopia","Sub-Saharan Africa","LIC","ETB","Br","en"],
  ["GA","GAB","Gabon","Sub-Saharan Africa","UMC","XAF","FCFA","fr"],
  ["GH","GHA","Ghana","Sub-Saharan Africa","LMC","GHS","GH₵","en", { snapshot: true, calibration: 0.62, context: "urban-informal" }],
  ["GM","GMB","Gambia","Sub-Saharan Africa","LIC","GMD","D","en"],
  ["GN","GIN","Guinea","Sub-Saharan Africa","LMC","GNF","FG","fr"],
  ["GQ","GNQ","Equatorial Guinea","Sub-Saharan Africa","UMC","XAF","FCFA","es"],
  ["GW","GNB","Guinea-Bissau","Sub-Saharan Africa","LIC","XOF","CFA","pt"],
  ["KE","KEN","Kenya","Sub-Saharan Africa","LMC","KES","KSh","sw", { snapshot: true, calibration: 0.65, context: "urban-informal" }],
  ["KM","COM","Comoros","Sub-Saharan Africa","LMC","KMF","CF","ar"],
  ["LR","LBR","Liberia","Sub-Saharan Africa","LIC","LRD","L$","en"],
  ["LS","LSO","Lesotho","Sub-Saharan Africa","LMC","LSL","L","en"],
  ["MG","MDG","Madagascar","Sub-Saharan Africa","LIC","MGA","Ar","fr"],
  ["ML","MLI","Mali","Sub-Saharan Africa","LIC","XOF","CFA","fr"],
  ["MR","MRT","Mauritania","Sub-Saharan Africa","LMC","MRU","UM","ar"],
  ["MU","MUS","Mauritius","Sub-Saharan Africa","HIC","MUR","Rs","en"],
  ["MW","MWI","Malawi","Sub-Saharan Africa","LIC","MWK","MK","en"],
  ["MZ","MOZ","Mozambique","Sub-Saharan Africa","LIC","MZN","MT","pt"],
  ["NA","NAM","Namibia","Sub-Saharan Africa","UMC","NAD","N$","en"],
  ["NE","NER","Niger","Sub-Saharan Africa","LIC","XOF","CFA","fr"],
  ["NG","NGA","Nigeria","Sub-Saharan Africa","LMC","NGN","₦","en"],
  ["RW","RWA","Rwanda","Sub-Saharan Africa","LIC","RWF","FRw","en"],
  ["SC","SYC","Seychelles","Sub-Saharan Africa","HIC","SCR","SR","en"],
  ["SD","SDN","Sudan","Sub-Saharan Africa","LIC","SDG","ج.س.","ar"],
  ["SL","SLE","Sierra Leone","Sub-Saharan Africa","LIC","SLE","Le","en"],
  ["SN","SEN","Senegal","Sub-Saharan Africa","LMC","XOF","CFA","fr"],
  ["SO","SOM","Somalia","Sub-Saharan Africa","LIC","SOS","Sh","sw"],
  ["SS","SSD","South Sudan","Sub-Saharan Africa","LIC","SSP","SS£","en"],
  ["ST","STP","Sao Tome and Principe","Sub-Saharan Africa","LMC","STN","Db","pt"],
  ["SZ","SWZ","Eswatini","Sub-Saharan Africa","LMC","SZL","E","en"],
  ["TD","TCD","Chad","Sub-Saharan Africa","LIC","XAF","FCFA","fr"],
  ["TG","TGO","Togo","Sub-Saharan Africa","LIC","XOF","CFA","fr"],
  ["TZ","TZA","Tanzania","Sub-Saharan Africa","LMC","TZS","TSh","sw"],
  ["UG","UGA","Uganda","Sub-Saharan Africa","LIC","UGX","USh","en"],
  ["ZA","ZAF","South Africa","Sub-Saharan Africa","UMC","ZAR","R","en"],
  ["ZM","ZMB","Zambia","Sub-Saharan Africa","LMC","ZMW","ZK","en"],
  ["ZW","ZWE","Zimbabwe","Sub-Saharan Africa","LMC","ZWL","Z$","en"],

  // ====== Middle East & North Africa ======
  ["AE","ARE","United Arab Emirates","Middle East & North Africa","HIC","AED","د.إ","ar"],
  ["BH","BHR","Bahrain","Middle East & North Africa","HIC","BHD","BD","ar"],
  ["DZ","DZA","Algeria","Middle East & North Africa","UMC","DZD","DA","ar"],
  ["EG","EGY","Egypt","Middle East & North Africa","LMC","EGP","E£","ar"],
  ["IL","ISR","Israel","Middle East & North Africa","HIC","ILS","₪","en"],
  ["IQ","IRQ","Iraq","Middle East & North Africa","UMC","IQD","ع.د","ar"],
  ["IR","IRN","Iran","Middle East & North Africa","LMC","IRR","﷼","ar"],
  ["JO","JOR","Jordan","Middle East & North Africa","UMC","JOD","JD","ar"],
  ["KW","KWT","Kuwait","Middle East & North Africa","HIC","KWD","KD","ar"],
  ["LB","LBN","Lebanon","Middle East & North Africa","UMC","LBP","ل.ل","ar"],
  ["LY","LBY","Libya","Middle East & North Africa","UMC","LYD","ل.د","ar"],
  ["MA","MAR","Morocco","Middle East & North Africa","LMC","MAD","DH","ar"],
  ["OM","OMN","Oman","Middle East & North Africa","HIC","OMR","ر.ع.","ar"],
  ["PS","PSE","Palestine","Middle East & North Africa","LMC","ILS","₪","ar"],
  ["QA","QAT","Qatar","Middle East & North Africa","HIC","QAR","ر.ق","ar"],
  ["SA","SAU","Saudi Arabia","Middle East & North Africa","HIC","SAR","ر.س","ar"],
  ["SY","SYR","Syrian Arab Republic","Middle East & North Africa","LIC","SYP","SP","ar"],
  ["TN","TUN","Tunisia","Middle East & North Africa","LMC","TND","DT","ar"],
  ["YE","YEM","Yemen","Middle East & North Africa","LIC","YER","﷼","ar"],

  // ====== South Asia ======
  ["AF","AFG","Afghanistan","South Asia","LIC","AFN","؋","ur"],
  ["BD","BGD","Bangladesh","South Asia","LMC","BDT","৳","bn", { snapshot: true, calibration: 0.71, context: "mixed-urban-rural" }],
  ["BT","BTN","Bhutan","South Asia","LMC","BTN","Nu","hi"],
  ["IN","IND","India","South Asia","LMC","INR","₹","hi"],
  ["LK","LKA","Sri Lanka","South Asia","LMC","LKR","Rs","en"],
  ["MV","MDV","Maldives","South Asia","UMC","MVR","Rf","en"],
  ["NP","NPL","Nepal","South Asia","LMC","NPR","Rs","hi"],
  ["PK","PAK","Pakistan","South Asia","LMC","PKR","Rs","ur"],

  // ====== East Asia & Pacific ======
  ["AS","ASM","American Samoa","East Asia & Pacific","HIC","USD","$","en"],
  ["AU","AUS","Australia","East Asia & Pacific","HIC","AUD","$","en"],
  ["BN","BRN","Brunei Darussalam","East Asia & Pacific","HIC","BND","B$","en"],
  ["CK","COK","Cook Islands","East Asia & Pacific","HIC","NZD","$","en"],
  ["CN","CHN","China","East Asia & Pacific","UMC","CNY","¥","zh"],
  ["FJ","FJI","Fiji","East Asia & Pacific","UMC","FJD","FJ$","en"],
  ["FM","FSM","Micronesia","East Asia & Pacific","LMC","USD","$","en"],
  ["HK","HKG","Hong Kong SAR","East Asia & Pacific","HIC","HKD","HK$","zh"],
  ["ID","IDN","Indonesia","East Asia & Pacific","UMC","IDR","Rp","id"],
  ["JP","JPN","Japan","East Asia & Pacific","HIC","JPY","¥","en"],
  ["KH","KHM","Cambodia","East Asia & Pacific","LMC","KHR","៛","en"],
  ["KI","KIR","Kiribati","East Asia & Pacific","LMC","AUD","$","en"],
  ["KP","PRK","Korea, Dem. People's Rep.","East Asia & Pacific","LIC","KPW","₩","en"],
  ["KR","KOR","Korea, Rep.","East Asia & Pacific","HIC","KRW","₩","en"],
  ["LA","LAO","Lao PDR","East Asia & Pacific","LMC","LAK","₭","en"],
  ["MH","MHL","Marshall Islands","East Asia & Pacific","UMC","USD","$","en"],
  ["MM","MMR","Myanmar","East Asia & Pacific","LMC","MMK","K","en"],
  ["MN","MNG","Mongolia","East Asia & Pacific","LMC","MNT","₮","en"],
  ["MO","MAC","Macao SAR","East Asia & Pacific","HIC","MOP","MOP$","zh"],
  ["MP","MNP","Northern Mariana Islands","East Asia & Pacific","HIC","USD","$","en"],
  ["MY","MYS","Malaysia","East Asia & Pacific","UMC","MYR","RM","en"],
  ["NC","NCL","New Caledonia","East Asia & Pacific","HIC","XPF","CFP","fr"],
  ["NR","NRU","Nauru","East Asia & Pacific","HIC","AUD","$","en"],
  ["NU","NIU","Niue","East Asia & Pacific","HIC","NZD","$","en"],
  ["NZ","NZL","New Zealand","East Asia & Pacific","HIC","NZD","$","en"],
  ["PF","PYF","French Polynesia","East Asia & Pacific","HIC","XPF","CFP","fr"],
  ["PG","PNG","Papua New Guinea","East Asia & Pacific","LMC","PGK","K","en"],
  ["PH","PHL","Philippines","East Asia & Pacific","LMC","PHP","₱","en"],
  ["PW","PLW","Palau","East Asia & Pacific","HIC","USD","$","en"],
  ["SB","SLB","Solomon Islands","East Asia & Pacific","LMC","SBD","SI$","en"],
  ["SG","SGP","Singapore","East Asia & Pacific","HIC","SGD","S$","en"],
  ["TH","THA","Thailand","East Asia & Pacific","UMC","THB","฿","en"],
  ["TL","TLS","Timor-Leste","East Asia & Pacific","LMC","USD","$","pt"],
  ["TO","TON","Tonga","East Asia & Pacific","UMC","TOP","T$","en"],
  ["TV","TUV","Tuvalu","East Asia & Pacific","UMC","AUD","$","en"],
  ["TW","TWN","Taiwan","East Asia & Pacific","HIC","TWD","NT$","zh"],
  ["VN","VNM","Vietnam","East Asia & Pacific","LMC","VND","₫","vi"],
  ["VU","VUT","Vanuatu","East Asia & Pacific","LMC","VUV","Vt","en"],
  ["WS","WSM","Samoa","East Asia & Pacific","UMC","WST","WS$","en"],

  // ====== Europe & Central Asia ======
  ["AD","AND","Andorra","Europe & Central Asia","HIC","EUR","€","es"],
  ["AL","ALB","Albania","Europe & Central Asia","UMC","ALL","L","en"],
  ["AM","ARM","Armenia","Europe & Central Asia","UMC","AMD","֏","ru"],
  ["AT","AUT","Austria","Europe & Central Asia","HIC","EUR","€","de"],
  ["AZ","AZE","Azerbaijan","Europe & Central Asia","UMC","AZN","₼","ru"],
  ["BA","BIH","Bosnia and Herzegovina","Europe & Central Asia","UMC","BAM","KM","en"],
  ["BE","BEL","Belgium","Europe & Central Asia","HIC","EUR","€","fr"],
  ["BG","BGR","Bulgaria","Europe & Central Asia","HIC","BGN","лв","en"],
  ["BY","BLR","Belarus","Europe & Central Asia","UMC","BYN","Br","ru"],
  ["CH","CHE","Switzerland","Europe & Central Asia","HIC","CHF","Fr","de"],
  ["CY","CYP","Cyprus","Europe & Central Asia","HIC","EUR","€","en"],
  ["CZ","CZE","Czechia","Europe & Central Asia","HIC","CZK","Kč","en"],
  ["DE","DEU","Germany","Europe & Central Asia","HIC","EUR","€","de"],
  ["DK","DNK","Denmark","Europe & Central Asia","HIC","DKK","kr","en"],
  ["EE","EST","Estonia","Europe & Central Asia","HIC","EUR","€","en"],
  ["ES","ESP","Spain","Europe & Central Asia","HIC","EUR","€","es"],
  ["FI","FIN","Finland","Europe & Central Asia","HIC","EUR","€","en"],
  ["FO","FRO","Faroe Islands","Europe & Central Asia","HIC","DKK","kr","en"],
  ["FR","FRA","France","Europe & Central Asia","HIC","EUR","€","fr"],
  ["GB","GBR","United Kingdom","Europe & Central Asia","HIC","GBP","£","en"],
  ["GE","GEO","Georgia","Europe & Central Asia","UMC","GEL","₾","ru"],
  ["GI","GIB","Gibraltar","Europe & Central Asia","HIC","GIP","£","en"],
  ["GL","GRL","Greenland","Europe & Central Asia","HIC","DKK","kr","en"],
  ["GR","GRC","Greece","Europe & Central Asia","HIC","EUR","€","en"],
  ["HR","HRV","Croatia","Europe & Central Asia","HIC","EUR","€","en"],
  ["HU","HUN","Hungary","Europe & Central Asia","HIC","HUF","Ft","en"],
  ["IE","IRL","Ireland","Europe & Central Asia","HIC","EUR","€","en"],
  ["IM","IMN","Isle of Man","Europe & Central Asia","HIC","GBP","£","en"],
  ["IS","ISL","Iceland","Europe & Central Asia","HIC","ISK","kr","en"],
  ["IT","ITA","Italy","Europe & Central Asia","HIC","EUR","€","en"],
  ["KG","KGZ","Kyrgyz Republic","Europe & Central Asia","LMC","KGS","сом","ru"],
  ["KZ","KAZ","Kazakhstan","Europe & Central Asia","UMC","KZT","₸","ru"],
  ["LI","LIE","Liechtenstein","Europe & Central Asia","HIC","CHF","Fr","de"],
  ["LT","LTU","Lithuania","Europe & Central Asia","HIC","EUR","€","en"],
  ["LU","LUX","Luxembourg","Europe & Central Asia","HIC","EUR","€","fr"],
  ["LV","LVA","Latvia","Europe & Central Asia","HIC","EUR","€","en"],
  ["MC","MCO","Monaco","Europe & Central Asia","HIC","EUR","€","fr"],
  ["MD","MDA","Moldova","Europe & Central Asia","UMC","MDL","L","ru"],
  ["ME","MNE","Montenegro","Europe & Central Asia","UMC","EUR","€","en"],
  ["MK","MKD","North Macedonia","Europe & Central Asia","UMC","MKD","ден","en"],
  ["MT","MLT","Malta","Europe & Central Asia","HIC","EUR","€","en"],
  ["NL","NLD","Netherlands","Europe & Central Asia","HIC","EUR","€","en"],
  ["NO","NOR","Norway","Europe & Central Asia","HIC","NOK","kr","en"],
  ["PL","POL","Poland","Europe & Central Asia","HIC","PLN","zł","en"],
  ["PT","PRT","Portugal","Europe & Central Asia","HIC","EUR","€","pt"],
  ["RO","ROU","Romania","Europe & Central Asia","HIC","RON","lei","en"],
  ["RS","SRB","Serbia","Europe & Central Asia","UMC","RSD","дин","en"],
  ["RU","RUS","Russian Federation","Europe & Central Asia","UMC","RUB","₽","ru"],
  ["SE","SWE","Sweden","Europe & Central Asia","HIC","SEK","kr","en"],
  ["SI","SVN","Slovenia","Europe & Central Asia","HIC","EUR","€","en"],
  ["SK","SVK","Slovak Republic","Europe & Central Asia","HIC","EUR","€","en"],
  ["SM","SMR","San Marino","Europe & Central Asia","HIC","EUR","€","en"],
  ["TJ","TJK","Tajikistan","Europe & Central Asia","LMC","TJS","SM","ru"],
  ["TM","TKM","Turkmenistan","Europe & Central Asia","UMC","TMT","T","ru"],
  ["TR","TUR","Türkiye","Europe & Central Asia","UMC","TRY","₺","tr"],
  ["UA","UKR","Ukraine","Europe & Central Asia","UMC","UAH","₴","ru"],
  ["UZ","UZB","Uzbekistan","Europe & Central Asia","LMC","UZS","сум","ru"],
  ["VA","VAT","Holy See","Europe & Central Asia","HIC","EUR","€","en"],
  ["XK","XKX","Kosovo","Europe & Central Asia","UMC","EUR","€","en"],

  // ====== Latin America & Caribbean ======
  ["AG","ATG","Antigua and Barbuda","Latin America & Caribbean","HIC","XCD","$","en"],
  ["AI","AIA","Anguilla","Latin America & Caribbean","HIC","XCD","$","en"],
  ["AR","ARG","Argentina","Latin America & Caribbean","UMC","ARS","$","es"],
  ["AW","ABW","Aruba","Latin America & Caribbean","HIC","AWG","ƒ","en"],
  ["BB","BRB","Barbados","Latin America & Caribbean","HIC","BBD","$","en"],
  ["BL","BLM","Saint Barthélemy","Latin America & Caribbean","HIC","EUR","€","fr"],
  ["BO","BOL","Bolivia","Latin America & Caribbean","LMC","BOB","Bs","es"],
  ["BQ","BES","Bonaire, Sint Eustatius and Saba","Latin America & Caribbean","HIC","USD","$","en"],
  ["BR","BRA","Brazil","Latin America & Caribbean","UMC","BRL","R$","pt"],
  ["BS","BHS","Bahamas","Latin America & Caribbean","HIC","BSD","$","en"],
  ["BZ","BLZ","Belize","Latin America & Caribbean","UMC","BZD","BZ$","en"],
  ["CL","CHL","Chile","Latin America & Caribbean","HIC","CLP","$","es"],
  ["CO","COL","Colombia","Latin America & Caribbean","UMC","COP","$","es"],
  ["CR","CRI","Costa Rica","Latin America & Caribbean","UMC","CRC","₡","es"],
  ["CU","CUB","Cuba","Latin America & Caribbean","UMC","CUP","$","es"],
  ["CW","CUW","Curaçao","Latin America & Caribbean","HIC","ANG","ƒ","en"],
  ["DM","DMA","Dominica","Latin America & Caribbean","UMC","XCD","$","en"],
  ["DO","DOM","Dominican Republic","Latin America & Caribbean","UMC","DOP","RD$","es"],
  ["EC","ECU","Ecuador","Latin America & Caribbean","UMC","USD","$","es"],
  ["GD","GRD","Grenada","Latin America & Caribbean","UMC","XCD","$","en"],
  ["GF","GUF","French Guiana","Latin America & Caribbean","HIC","EUR","€","fr"],
  ["GP","GLP","Guadeloupe","Latin America & Caribbean","HIC","EUR","€","fr"],
  ["GT","GTM","Guatemala","Latin America & Caribbean","UMC","GTQ","Q","es"],
  ["GY","GUY","Guyana","Latin America & Caribbean","HIC","GYD","G$","en"],
  ["HN","HND","Honduras","Latin America & Caribbean","LMC","HNL","L","es"],
  ["HT","HTI","Haiti","Latin America & Caribbean","LIC","HTG","G","fr"],
  ["JM","JAM","Jamaica","Latin America & Caribbean","UMC","JMD","J$","en"],
  ["KN","KNA","Saint Kitts and Nevis","Latin America & Caribbean","HIC","XCD","$","en"],
  ["KY","CYM","Cayman Islands","Latin America & Caribbean","HIC","KYD","$","en"],
  ["LC","LCA","Saint Lucia","Latin America & Caribbean","UMC","XCD","$","en"],
  ["MF","MAF","Saint Martin (French)","Latin America & Caribbean","HIC","EUR","€","fr"],
  ["MQ","MTQ","Martinique","Latin America & Caribbean","HIC","EUR","€","fr"],
  ["MS","MSR","Montserrat","Latin America & Caribbean","HIC","XCD","$","en"],
  ["MX","MEX","Mexico","Latin America & Caribbean","UMC","MXN","$","es"],
  ["NI","NIC","Nicaragua","Latin America & Caribbean","LMC","NIO","C$","es"],
  ["PA","PAN","Panama","Latin America & Caribbean","HIC","PAB","B/.","es"],
  ["PE","PER","Peru","Latin America & Caribbean","UMC","PEN","S/","es"],
  ["PR","PRI","Puerto Rico","Latin America & Caribbean","HIC","USD","$","es"],
  ["PY","PRY","Paraguay","Latin America & Caribbean","UMC","PYG","₲","es"],
  ["SR","SUR","Suriname","Latin America & Caribbean","UMC","SRD","$","en"],
  ["SV","SLV","El Salvador","Latin America & Caribbean","UMC","USD","$","es"],
  ["SX","SXM","Sint Maarten (Dutch)","Latin America & Caribbean","HIC","ANG","ƒ","en"],
  ["TC","TCA","Turks and Caicos","Latin America & Caribbean","HIC","USD","$","en"],
  ["TT","TTO","Trinidad and Tobago","Latin America & Caribbean","HIC","TTD","TT$","en"],
  ["UY","URY","Uruguay","Latin America & Caribbean","HIC","UYU","$U","es"],
  ["VC","VCT","Saint Vincent and the Grenadines","Latin America & Caribbean","UMC","XCD","$","en"],
  ["VE","VEN","Venezuela","Latin America & Caribbean","UMC","VES","Bs.","es"],
  ["VG","VGB","British Virgin Islands","Latin America & Caribbean","HIC","USD","$","en"],
  ["VI","VIR","US Virgin Islands","Latin America & Caribbean","HIC","USD","$","en"],

  // ====== North America ======
  ["BM","BMU","Bermuda","North America","HIC","BMD","$","en"],
  ["CA","CAN","Canada","North America","HIC","CAD","$","en"],
  ["US","USA","United States","North America","HIC","USD","$","en"],
];

// ----------------------------------------------------------------------------
// 2. Defaults derived from income group + region.
// ----------------------------------------------------------------------------

function calibrationFor(income, region) {
  // Base from World Bank income group
  let base;
  switch (income) {
    case "HIC": base = 0.97; break;
    case "UMC": base = 0.82; break;
    case "LMC": base = 0.70; break;
    case "LIC": base = 0.55; break;
    default: base = 0.75;
  }
  // Sub-Saharan Africa LMICs sit a touch lower than LMICs elsewhere because
  // the informal economy is larger; small adjustment.
  if (region === "Sub-Saharan Africa" && (income === "LMC" || income === "LIC")) base -= 0.03;
  if (region === "North America" || region === "Europe & Central Asia") base = Math.min(1.0, base + 0.02);
  return Math.round(base * 100) / 100;
}

function contextFor(income) {
  // Crude economy-context label so the synthesised dataset has something
  // sensible to display. Snapshot countries override.
  switch (income) {
    case "HIC": return "mixed-urban-rural";
    case "UMC": return "mixed-urban-rural";
    case "LMC": return "urban-informal";
    case "LIC": return "rural-agricultural";
    default: return "mixed-urban-rural";
  }
}

// ----------------------------------------------------------------------------
// 3. Generate.
// ----------------------------------------------------------------------------

const countries = ROWS.map((row) => {
  const [code, iso3, name, region, income, currency, currencySymbol, defaultLocale, override] = row;
  const o = override ?? {};
  return {
    code,
    iso3,
    name,
    region,
    currency,
    currencySymbol,
    defaultLocale,
    automationCalibration: o.calibration ?? calibrationFor(income, region),
    context: o.context ?? contextFor(income),
    incomeGroup: income,
    snapshot: o.snapshot ?? false,
  };
}).sort((a, b) => a.name.localeCompare(b.name));

// Dedupe in case of accidental duplicates
const seen = new Set();
const dedup = countries.filter((c) => {
  if (seen.has(c.code)) {
    console.warn(`! duplicate ${c.code} dropped`);
    return false;
  }
  seen.add(c.code);
  return true;
});

const out = {
  _source:
    "ISO 3166-1 alpha-2 + alpha-3 + World Bank region + income group. " +
    "Currency from ISO 4217. Default UI locale chosen from our 15 supported languages " +
    "based on majority/official tongue. Automation calibration multiplier derived from " +
    "income group (HIC 0.97 / UMC 0.82 / LMC 0.70 / LIC 0.55) with small SSA adjustment. " +
    "Snapshot=true marks the 3 hand-curated countries (GH/BD/KE) with full ILOSTAT-derived " +
    "wage and growth tables. All other countries fall through the synthesised baseline + " +
    "live World Bank fallback path.",
  generatedAt: new Date().toISOString(),
  count: dedup.length,
  countries: dedup,
};

const TARGETS = [
  resolve(ROOT, "apps/web/lib/data/countries.json"),
  resolve(ROOT, "apps/api/src/country/data/countries.json"),
];

for (const path of TARGETS) {
  await writeFile(path, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`wrote ${path} (${dedup.length} countries)`);
}
