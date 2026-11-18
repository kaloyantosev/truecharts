/* TrueCharts level & scenario engine v2.1.0
 *
 * One file, three users:
 *   - tv_automation.py injects it into TradingView Desktop (window.TCEngine) and calls TCEngine.analyze()
 *   - the backtester site imports it (frontend/src/lib/tc_engine.js)
 *   - research/parity_check.js runs it in Node against the Python research code
 *
 * Every probability shown comes from STATS, calibrated on SPY+QQQ 2020-11..2026-10 using only real inputs:
 * start-of-day option OI ladders and real daily OHLC (intraday reaction odds: real 5m tape 2026-04..10).
 * Distances and the gamma regime are measured from the session OPEN, in ATR(14) units, as in the calibration.
 * Regenerate STATS with research/export_stats.py + research/build_engine.py.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TCEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var STATS = /*STATS_BEGIN*/{"meta":{"source":"SPY+QQQ 2020-11..2026-10: start-of-day option OI ladders + real daily OHLC (intraday odds: real 5m 2026-04..10)","regime_buckets_atr":[-0.5,0,0.5],"dist_buckets_atr":[0.25,0.5,0.75,1.0,1.5],"gap_buckets_atr":[-0.6,-0.15,0.15,0.6],"n_days":2946},"regime":{"neg":{"n":456,"range_atr":0.919,"range_atr_p80":1.195,"trend_day":0.261,"up":0.535,"gap_fill":0.49,"real_vs_impl":0.531},"neg_deep":{"n":537,"range_atr":1.028,"range_atr_p80":1.296,"trend_day":0.346,"up":0.553,"gap_fill":0.462,"real_vs_impl":0.566},"neg_nocross":{"n":329,"range_atr":1.085,"range_atr_p80":1.398,"trend_day":0.274,"up":0.535,"gap_fill":0.482,"real_vs_impl":0.636},"pos":{"n":629,"range_atr":0.867,"range_atr_p80":1.105,"trend_day":0.211,"up":0.542,"gap_fill":0.544,"real_vs_impl":0.486},"pos_deep":{"n":913,"range_atr":0.845,"range_atr_p80":1.072,"trend_day":0.18,"up":0.518,"gap_fill":0.498,"real_vs_impl":0.433},"pos_nocross":{"n":82,"range_atr":0.782,"range_atr_p80":1.09,"trend_day":0.195,"up":0.524,"gap_fill":0.25,"real_vs_impl":0.483}},"gap_fill":{"down_big|neg":{"p":0.208,"n":24},"down_big|neg_deep":{"p":0.182,"n":110},"down_big|neg_nocross":{"p":0.345,"n":87},"down_big|pos":{"p":0.308,"n":13},"down_big|pos_deep":{"p":0.0,"n":6},"down|neg":{"p":0.503,"n":159},"down|neg_deep":{"p":0.607,"n":183},"down|neg_nocross":{"p":0.541,"n":111},"down|pos":{"p":0.537,"n":123},"down|pos_deep":{"p":0.676,"n":68},"down|pos_nocross":{"p":0.0,"n":1},"up|neg":{"p":0.541,"n":111},"up|neg_deep":{"p":0.554,"n":101},"up|neg_nocross":{"p":0.609,"n":46},"up|pos":{"p":0.6,"n":200},"up|pos_deep":{"p":0.537,"n":410},"up|pos_nocross":{"p":0.378,"n":37},"up_big|neg":{"p":0.438,"n":16},"up_big|neg_deep":{"p":0.211,"n":19},"up_big|neg_nocross":{"p":0.462,"n":13},"up_big|pos":{"p":0.351,"n":37},"up_big|pos_deep":{"p":0.311,"n":135},"up_big|pos_nocross":{"p":0.077,"n":26}},"level":{"res|strike|neg|0-.25":{"n":727,"p_touch":0.813,"p_hold_close":0.438,"pen_p80":0.586},"res|strike|neg|.25-.5":{"n":760,"p_touch":0.484,"p_hold_close":0.38,"pen_p80":0.493},"res|strike|neg|.5-.75":{"n":737,"p_touch":0.227,"p_hold_close":0.383,"pen_p80":0.417},"res|strike|neg|.75-1":{"n":724,"p_touch":0.091,"p_hold_close":0.318,"pen_p80":0.384},"res|strike|neg|1-1.5":{"n":1358,"p_touch":0.018,"p_hold_close":0.542,"pen_p80":0.311},"res|strike|neg|1.5+":{"n":2671,"p_touch":0.001,"p_hold_close":null,"pen_p80":null},"res|strike|neg_deep|0-.25":{"n":872,"p_touch":0.821,"p_hold_close":0.443,"pen_p80":0.702},"res|strike|neg_deep|.25-.5":{"n":941,"p_touch":0.57,"p_hold_close":0.425,"pen_p80":0.558},"res|strike|neg_deep|.5-.75":{"n":929,"p_touch":0.319,"p_hold_close":0.443,"pen_p80":0.443},"res|strike|neg_deep|.75-1":{"n":886,"p_touch":0.141,"p_hold_close":0.504,"pen_p80":0.487},"res|strike|neg_deep|1-1.5":{"n":1685,"p_touch":0.04,"p_hold_close":0.485,"pen_p80":0.507},"res|strike|neg_deep|1.5+":{"n":2879,"p_touch":0.007,"p_hold_close":0.6,"pen_p80":0.995},"res|strike|neg_nocross|0-.25":{"n":733,"p_touch":0.821,"p_hold_close":0.468,"pen_p80":0.761},"res|strike|neg_nocross|.25-.5":{"n":803,"p_touch":0.562,"p_hold_close":0.488,"pen_p80":0.703},"res|strike|neg_nocross|.5-.75":{"n":780,"p_touch":0.331,"p_hold_close":0.422,"pen_p80":0.692},"res|strike|neg_nocross|.75-1":{"n":689,"p_touch":0.193,"p_hold_close":0.398,"pen_p80":0.738},"res|strike|neg_nocross|1-1.5":{"n":1186,"p_touch":0.083,"p_hold_close":0.505,"pen_p80":0.93},"res|strike|neg_nocross|1.5+":{"n":834,"p_touch":0.018,"p_hold_close":0.4,"pen_p80":0.681},"res|strike|pos|0-.25":{"n":978,"p_touch":0.801,"p_hold_close":0.409,"pen_p80":0.57},"res|strike|pos|.25-.5":{"n":1011,"p_touch":0.453,"p_hold_close":0.393,"pen_p80":0.466},"res|strike|pos|.5-.75":{"n":1043,"p_touch":0.213,"p_hold_close":0.432,"pen_p80":0.395},"res|strike|pos|.75-1":{"n":959,"p_touch":0.069,"p_hold_close":0.303,"pen_p80":0.299},"res|strike|pos|1-1.5":{"n":1903,"p_touch":0.018,"p_hold_close":0.657,"pen_p80":0.302},"res|strike|pos|1.5+":{"n":3709,"p_touch":0.001,"p_hold_close":null,"pen_p80":null},"res|strike|pos_deep|0-.25":{"n":1259,"p_touch":0.748,"p_hold_close":0.467,"pen_p80":0.495},"res|strike|pos_deep|.25-.5":{"n":1371,"p_touch":0.398,"p_hold_close":0.456,"pen_p80":0.392},"res|strike|pos_deep|.5-.75":{"n":1374,"p_touch":0.158,"p_hold_close":0.387,"pen_p80":0.297},"res|strike|pos_deep|.75-1":{"n":1380,"p_touch":0.043,"p_hold_close":0.475,"pen_p80":0.444},"res|strike|pos_deep|1-1.5":{"n":2718,"p_touch":0.015,"p_hold_close":0.488,"pen_p80":0.417},"res|strike|pos_deep|1.5+":{"n":5906,"p_touch":0.001,"p_hold_close":null,"pen_p80":null},"res|strike|pos_nocross|0-.25":{"n":182,"p_touch":0.742,"p_hold_close":0.452,"pen_p80":0.509},"res|strike|pos_nocross|.25-.5":{"n":199,"p_touch":0.347,"p_hold_close":0.304,"pen_p80":0.577},"res|strike|pos_nocross|.5-.75":{"n":188,"p_touch":0.186,"p_hold_close":0.257,"pen_p80":0.495},"res|strike|pos_nocross|.75-1":{"n":169,"p_touch":0.101,"p_hold_close":0.235,"pen_p80":0.38},"res|strike|pos_nocross|1-1.5":{"n":254,"p_touch":0.039,"p_hold_close":0.3,"pen_p80":0.531},"res|strike|pos_nocross|1.5+":{"n":283,"p_touch":0.011,"p_hold_close":null,"pen_p80":null},"res|wall|neg|0-.25":{"n":28,"p_touch":0.786,"p_hold_close":0.409,"pen_p80":0.623},"res|wall|neg|.25-.5":{"n":53,"p_touch":0.377,"p_hold_close":0.25,"pen_p80":0.463},"res|wall|neg|.5-.75":{"n":56,"p_touch":0.179,"p_hold_close":0.3,"pen_p80":0.268},"res|wall|neg|.75-1":{"n":71,"p_touch":0.07,"p_hold_close":null,"pen_p80":null},"res|wall|neg|1-1.5":{"n":131,"p_touch":0.046,"p_hold_close":null,"pen_p80":null},"res|wall|neg|1.5+":{"n":116,"p_touch":0.0,"p_hold_close":null,"pen_p80":null},"res|wall|neg_deep|0-.25":{"n":18,"p_touch":0.889,"p_hold_close":0.312,"pen_p80":0.53},"res|wall|neg_deep|.25-.5":{"n":36,"p_touch":0.556,"p_hold_close":0.5,"pen_p80":0.382},"res|wall|neg_deep|.5-.75":{"n":45,"p_touch":0.378,"p_hold_close":0.353,"pen_p80":0.554},"res|wall|neg_deep|.75-1":{"n":69,"p_touch":0.145,"p_hold_close":0.5,"pen_p80":0.319},"res|wall|neg_deep|1-1.5":{"n":148,"p_touch":0.047,"p_hold_close":null,"pen_p80":null},"res|wall|neg_deep|1.5+":{"n":221,"p_touch":0.009,"p_hold_close":null,"pen_p80":null},"res|wall|neg_nocross|0-.25":{"n":10,"p_touch":1.0,"p_hold_close":0.4,"pen_p80":0.695},"res|wall|neg_nocross|.25-.5":{"n":14,"p_touch":0.5,"p_hold_close":null,"pen_p80":null},"res|wall|neg_nocross|.5-.75":{"n":41,"p_touch":0.22,"p_hold_close":null,"pen_p80":null},"res|wall|neg_nocross|.75-1":{"n":50,"p_touch":0.08,"p_hold_close":null,"pen_p80":null},"res|wall|neg_nocross|1-1.5":{"n":111,"p_touch":0.072,"p_hold_close":null,"pen_p80":null},"res|wall|neg_nocross|1.5+":{"n":103,"p_touch":0.049,"p_hold_close":null,"pen_p80":null},"res|wall|pos|0-.25":{"n":67,"p_touch":0.701,"p_hold_close":0.319,"pen_p80":0.509},"res|wall|pos|.25-.5":{"n":95,"p_touch":0.316,"p_hold_close":0.533,"pen_p80":0.36},"res|wall|pos|.5-.75":{"n":92,"p_touch":0.261,"p_hold_close":0.5,"pen_p80":0.369},"res|wall|pos|.75-1":{"n":110,"p_touch":0.127,"p_hold_close":0.286,"pen_p80":0.332},"res|wall|pos|1-1.5":{"n":141,"p_touch":0.007,"p_hold_close":null,"pen_p80":null},"res|wall|pos|1.5+":{"n":120,"p_touch":0.0,"p_hold_close":null,"pen_p80":null},"res|wall|pos_deep|0-.25":{"n":145,"p_touch":0.807,"p_hold_close":0.479,"pen_p80":0.482},"res|wall|pos_deep|.25-.5":{"n":161,"p_touch":0.36,"p_hold_close":0.431,"pen_p80":0.443},"res|wall|pos_deep|.5-.75":{"n":178,"p_touch":0.135,"p_hold_close":0.458,"pen_p80":0.525},"res|wall|pos_deep|.75-1":{"n":139,"p_touch":0.086,"p_hold_close":0.75,"pen_p80":0.565},"res|wall|pos_deep|1-1.5":{"n":166,"p_touch":0.012,"p_hold_close":null,"pen_p80":null},"res|wall|pos_deep|1.5+":{"n":110,"p_touch":0.009,"p_hold_close":null,"pen_p80":null},"res|wall|pos_nocross|0-.25":{"n":18,"p_touch":0.778,"p_hold_close":0.286,"pen_p80":0.512},"res|wall|pos_nocross|.25-.5":{"n":24,"p_touch":0.458,"p_hold_close":0.364,"pen_p80":0.604},"res|wall|pos_nocross|.5-.75":{"n":15,"p_touch":0.067,"p_hold_close":null,"pen_p80":null},"res|wall|pos_nocross|.75-1":{"n":11,"p_touch":0.091,"p_hold_close":null,"pen_p80":null},"res|wall|pos_nocross|1-1.5":{"n":6,"p_touch":0.0,"p_hold_close":null,"pen_p80":null},"res|wall|pos_nocross|1.5+":{"n":8,"p_touch":0.0,"p_hold_close":null,"pen_p80":null},"sup|strike|neg|0-.25":{"n":733,"p_touch":0.798,"p_hold_close":0.535,"pen_p80":0.787},"sup|strike|neg|.25-.5":{"n":767,"p_touch":0.49,"p_hold_close":0.457,"pen_p80":0.696},"sup|strike|neg|.5-.75":{"n":759,"p_touch":0.295,"p_hold_close":0.482,"pen_p80":0.595},"sup|strike|neg|.75-1":{"n":746,"p_touch":0.177,"p_hold_close":0.5,"pen_p80":0.508},"sup|strike|neg|1-1.5":{"n":1424,"p_touch":0.057,"p_hold_close":0.593,"pen_p80":0.375},"sup|strike|neg|1.5+":{"n":3062,"p_touch":0.005,"p_hold_close":0.643,"pen_p80":0.762},"sup|strike|neg_deep|0-.25":{"n":868,"p_touch":0.79,"p_hold_close":0.538,"pen_p80":0.791},"sup|strike|neg_deep|.25-.5":{"n":898,"p_touch":0.508,"p_hold_close":0.456,"pen_p80":0.729},"sup|strike|neg_deep|.5-.75":{"n":914,"p_touch":0.315,"p_hold_close":0.389,"pen_p80":0.64},"sup|strike|neg_deep|.75-1":{"n":883,"p_touch":0.177,"p_hold_close":0.455,"pen_p80":0.556},"sup|strike|neg_deep|1-1.5":{"n":1725,"p_touch":0.081,"p_hold_close":0.557,"pen_p80":0.413},"sup|strike|neg_deep|1.5+":{"n":3522,"p_touch":0.006,"p_hold_close":0.667,"pen_p80":0.437},"sup|strike|neg_nocross|0-.25":{"n":690,"p_touch":0.832,"p_hold_close":0.516,"pen_p80":0.692},"sup|strike|neg_nocross|.25-.5":{"n":754,"p_touch":0.55,"p_hold_close":0.561,"pen_p80":0.655},"sup|strike|neg_nocross|.5-.75":{"n":745,"p_touch":0.295,"p_hold_close":0.518,"pen_p80":0.636},"sup|strike|neg_nocross|.75-1":{"n":674,"p_touch":0.157,"p_hold_close":0.425,"pen_p80":0.559},"sup|strike|neg_nocross|1-1.5":{"n":1301,"p_touch":0.067,"p_hold_close":0.448,"pen_p80":0.529},"sup|strike|neg_nocross|1.5+":{"n":1215,"p_touch":0.012,"p_hold_close":0.533,"pen_p80":0.676},"sup|strike|pos|0-.25":{"n":1030,"p_touch":0.744,"p_hold_close":0.542,"pen_p80":0.675},"sup|strike|pos|.25-.5":{"n":1085,"p_touch":0.434,"p_hold_close":0.533,"pen_p80":0.689},"sup|strike|pos|.5-.75":{"n":1113,"p_touch":0.249,"p_hold_close":0.552,"pen_p80":0.77},"sup|strike|pos|.75-1":{"n":1026,"p_touch":0.137,"p_hold_close":0.532,"pen_p80":0.754},"sup|strike|pos|1-1.5":{"n":1928,"p_touch":0.06,"p_hold_close":0.452,"pen_p80":0.847},"sup|strike|pos|1.5+":{"n":4155,"p_touch":0.013,"p_hold_close":0.357,"pen_p80":0.755},"sup|strike|pos_deep|0-.25":{"n":1425,"p_touch":0.766,"p_hold_close":0.511,"pen_p80":0.692},"sup|strike|pos_deep|.25-.5":{"n":1520,"p_touch":0.457,"p_hold_close":0.564,"pen_p80":0.662},"sup|strike|pos_deep|.5-.75":{"n":1504,"p_touch":0.248,"p_hold_close":0.55,"pen_p80":0.717},"sup|strike|pos_deep|.75-1":{"n":1491,"p_touch":0.135,"p_hold_close":0.505,"pen_p80":0.832},"sup|strike|pos_deep|1-1.5":{"n":2810,"p_touch":0.066,"p_hold_close":0.5,"pen_p80":0.924},"sup|strike|pos_deep|1.5+":{"n":6218,"p_touch":0.016,"p_hold_close":0.317,"pen_p80":1.37},"sup|strike|pos_nocross|0-.25":{"n":194,"p_touch":0.747,"p_hold_close":0.538,"pen_p80":0.51},"sup|strike|pos_nocross|.25-.5":{"n":212,"p_touch":0.344,"p_hold_close":0.589,"pen_p80":0.506},"sup|strike|pos_nocross|.5-.75":{"n":197,"p_touch":0.168,"p_hold_close":0.606,"pen_p80":0.508},"sup|strike|pos_nocross|.75-1":{"n":172,"p_touch":0.081,"p_hold_close":0.714,"pen_p80":0.579},"sup|strike|pos_nocross|1-1.5":{"n":260,"p_touch":0.042,"p_hold_close":0.364,"pen_p80":0.754},"sup|strike|pos_nocross|1.5+":{"n":280,"p_touch":0.014,"p_hold_close":null,"pen_p80":null},"sup|wall|neg|0-.25":{"n":19,"p_touch":0.632,"p_hold_close":0.167,"pen_p80":0.706},"sup|wall|neg|.25-.5":{"n":38,"p_touch":0.526,"p_hold_close":0.4,"pen_p80":0.754},"sup|wall|neg|.5-.75":{"n":43,"p_touch":0.209,"p_hold_close":null,"pen_p80":null},"sup|wall|neg|.75-1":{"n":63,"p_touch":0.127,"p_hold_close":null,"pen_p80":null},"sup|wall|neg|1-1.5":{"n":120,"p_touch":0.075,"p_hold_close":null,"pen_p80":null},"sup|wall|neg|1.5+":{"n":172,"p_touch":0.006,"p_hold_close":null,"pen_p80":null},"sup|wall|neg_deep|0-.25":{"n":30,"p_touch":0.833,"p_hold_close":0.36,"pen_p80":1.086},"sup|wall|neg_deep|.25-.5":{"n":75,"p_touch":0.52,"p_hold_close":0.385,"pen_p80":0.896},"sup|wall|neg_deep|.5-.75":{"n":65,"p_touch":0.262,"p_hold_close":0.412,"pen_p80":0.653},"sup|wall|neg_deep|.75-1":{"n":79,"p_touch":0.19,"p_hold_close":0.467,"pen_p80":0.408},"sup|wall|neg_deep|1-1.5":{"n":138,"p_touch":0.072,"p_hold_close":0.7,"pen_p80":0.245},"sup|wall|neg_deep|1.5+":{"n":149,"p_touch":0.027,"p_hold_close":null,"pen_p80":null},"sup|wall|neg_nocross|0-.25":{"n":41,"p_touch":0.78,"p_hold_close":0.344,"pen_p80":0.815},"sup|wall|neg_nocross|.25-.5":{"n":51,"p_touch":0.51,"p_hold_close":0.462,"pen_p80":0.971},"sup|wall|neg_nocross|.5-.75":{"n":54,"p_touch":0.296,"p_hold_close":0.562,"pen_p80":0.501},"sup|wall|neg_nocross|.75-1":{"n":59,"p_touch":0.153,"p_hold_close":null,"pen_p80":null},"sup|wall|neg_nocross|1-1.5":{"n":69,"p_touch":0.072,"p_hold_close":null,"pen_p80":null},"sup|wall|neg_nocross|1.5+":{"n":46,"p_touch":0.022,"p_hold_close":null,"pen_p80":null},"sup|wall|pos|0-.25":{"n":6,"p_touch":0.667,"p_hold_close":null,"pen_p80":null},"sup|wall|pos|.25-.5":{"n":23,"p_touch":0.348,"p_hold_close":null,"pen_p80":null},"sup|wall|pos|.5-.75":{"n":44,"p_touch":0.159,"p_hold_close":null,"pen_p80":null},"sup|wall|pos|.75-1":{"n":72,"p_touch":0.083,"p_hold_close":null,"pen_p80":null},"sup|wall|pos|1-1.5":{"n":182,"p_touch":0.055,"p_hold_close":0.3,"pen_p80":1.279},"sup|wall|pos|1.5+":{"n":302,"p_touch":0.01,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_deep|0-.25":{"n":5,"p_touch":0.6,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_deep|.25-.5":{"n":17,"p_touch":0.294,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_deep|.5-.75":{"n":37,"p_touch":0.108,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_deep|.75-1":{"n":58,"p_touch":0.086,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_deep|1-1.5":{"n":191,"p_touch":0.063,"p_hold_close":0.25,"pen_p80":0.905},"sup|wall|pos_deep|1.5+":{"n":605,"p_touch":0.013,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_nocross|0-.25":{"n":1,"p_touch":0.0,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_nocross|.25-.5":{"n":3,"p_touch":0.333,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_nocross|.5-.75":{"n":12,"p_touch":0.083,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_nocross|.75-1":{"n":17,"p_touch":0.059,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_nocross|1-1.5":{"n":17,"p_touch":0.0,"p_hold_close":null,"pen_p80":null},"sup|wall|pos_nocross|1.5+":{"n":32,"p_touch":0.031,"p_hold_close":null,"pen_p80":null}},"prior_day":{"PDC|neg|0-.25":{"n":222,"p_touch":0.77,"p_hold_close":0.503},"PDC|neg|.25-.5":{"n":132,"p_touch":0.447,"p_hold_close":0.39},"PDC|neg|.5-.75":{"n":59,"p_touch":0.339,"p_hold_close":0.55},"PDC|neg|.75-1":{"n":13,"p_touch":0.154,"p_hold_close":null},"PDC|neg|1-1.5":{"n":5,"p_touch":0.4,"p_hold_close":null},"PDC|neg_deep|0-.25":{"n":189,"p_touch":0.81,"p_hold_close":0.477},"PDC|neg_deep|.25-.5":{"n":168,"p_touch":0.554,"p_hold_close":0.43},"PDC|neg_deep|.5-.75":{"n":93,"p_touch":0.419,"p_hold_close":0.41},"PDC|neg_deep|.75-1":{"n":49,"p_touch":0.102,"p_hold_close":null},"PDC|neg_deep|1-1.5":{"n":18,"p_touch":0.056,"p_hold_close":null},"PDC|neg_deep|1.5+":{"n":9,"p_touch":0.111,"p_hold_close":null},"PDC|neg_nocross|0-.25":{"n":100,"p_touch":0.87,"p_hold_close":0.621},"PDC|neg_nocross|.25-.5":{"n":92,"p_touch":0.543,"p_hold_close":0.58},"PDC|neg_nocross|.5-.75":{"n":50,"p_touch":0.44,"p_hold_close":0.455},"PDC|neg_nocross|.75-1":{"n":43,"p_touch":0.349,"p_hold_close":0.267},"PDC|neg_nocross|1-1.5":{"n":26,"p_touch":0.346,"p_hold_close":null},"PDC|neg_nocross|1.5+":{"n":6,"p_touch":0.0,"p_hold_close":null},"PDC|pos|0-.25":{"n":322,"p_touch":0.832,"p_hold_close":0.522},"PDC|pos|.25-.5":{"n":177,"p_touch":0.542,"p_hold_close":0.521},"PDC|pos|.5-.75":{"n":61,"p_touch":0.361,"p_hold_close":0.455},"PDC|pos|.75-1":{"n":21,"p_touch":0.286,"p_hold_close":null},"PDC|pos|1-1.5":{"n":6,"p_touch":0.5,"p_hold_close":null},"PDC|pos_deep|0-.25":{"n":423,"p_touch":0.79,"p_hold_close":0.446},"PDC|pos_deep|.25-.5":{"n":243,"p_touch":0.547,"p_hold_close":0.632},"PDC|pos_deep|.5-.75":{"n":129,"p_touch":0.326,"p_hold_close":0.548},"PDC|pos_deep|.75-1":{"n":51,"p_touch":0.216,"p_hold_close":0.545},"PDC|pos_deep|1-1.5":{"n":23,"p_touch":0.391,"p_hold_close":null},"PDC|pos_deep|1.5+":{"n":2,"p_touch":0.0,"p_hold_close":null},"PDC|pos_nocross|0-.25":{"n":25,"p_touch":0.76,"p_hold_close":0.421},"PDC|pos_nocross|.25-.5":{"n":21,"p_touch":0.333,"p_hold_close":null},"PDC|pos_nocross|.5-.75":{"n":14,"p_touch":0.214,"p_hold_close":null},"PDC|pos_nocross|.75-1":{"n":3,"p_touch":0.0,"p_hold_close":null},"PDC|pos_nocross|1-1.5":{"n":7,"p_touch":0.0,"p_hold_close":null},"PDC|pos_nocross|1.5+":{"n":9,"p_touch":0.0,"p_hold_close":null},"PDH|neg|0-.25":{"n":116,"p_touch":0.767,"p_hold_close":0.303},"PDH|neg|.25-.5":{"n":130,"p_touch":0.554,"p_hold_close":0.417},"PDH|neg|.5-.75":{"n":112,"p_touch":0.232,"p_hold_close":0.385},"PDH|neg|.75-1":{"n":44,"p_touch":0.091,"p_hold_close":null},"PDH|neg|1-1.5":{"n":36,"p_touch":0.083,"p_hold_close":null},"PDH|neg|1.5+":{"n":8,"p_touch":0.0,"p_hold_close":null},"PDH|neg_deep|0-.25":{"n":55,"p_touch":0.745,"p_hold_close":0.39},"PDH|neg_deep|.25-.5":{"n":83,"p_touch":0.566,"p_hold_close":0.362},"PDH|neg_deep|.5-.75":{"n":125,"p_touch":0.304,"p_hold_close":0.421},"PDH|neg_deep|.75-1":{"n":87,"p_touch":0.161,"p_hold_close":0.429},"PDH|neg_deep|1-1.5":{"n":119,"p_touch":0.05,"p_hold_close":null},"PDH|neg_deep|1.5+":{"n":61,"p_touch":0.016,"p_hold_close":null},"PDH|neg_nocross|0-.25":{"n":33,"p_touch":0.788,"p_hold_close":0.462},"PDH|neg_nocross|.25-.5":{"n":43,"p_touch":0.465,"p_hold_close":0.65},"PDH|neg_nocross|.5-.75":{"n":55,"p_touch":0.127,"p_hold_close":null},"PDH|neg_nocross|.75-1":{"n":38,"p_touch":0.237,"p_hold_close":null},"PDH|neg_nocross|1-1.5":{"n":85,"p_touch":0.082,"p_hold_close":null},"PDH|neg_nocross|1.5+":{"n":73,"p_touch":0.068,"p_hold_close":null},"PDH|pos|0-.25":{"n":263,"p_touch":0.779,"p_hold_close":0.507},"PDH|pos|.25-.5":{"n":196,"p_touch":0.515,"p_hold_close":0.406},"PDH|pos|.5-.75":{"n":97,"p_touch":0.227,"p_hold_close":0.455},"PDH|pos|.75-1":{"n":30,"p_touch":0.033,"p_hold_close":null},"PDH|pos|1-1.5":{"n":12,"p_touch":0.0,"p_hold_close":null},"PDH|pos|1.5+":{"n":3,"p_touch":0.0,"p_hold_close":null},"PDH|pos_deep|0-.25":{"n":487,"p_touch":0.797,"p_hold_close":0.477},"PDH|pos_deep|.25-.5":{"n":245,"p_touch":0.478,"p_hold_close":0.556},"PDH|pos_deep|.5-.75":{"n":87,"p_touch":0.322,"p_hold_close":0.464},"PDH|pos_deep|.75-1":{"n":23,"p_touch":0.217,"p_hold_close":null},"PDH|pos_deep|1-1.5":{"n":14,"p_touch":0.214,"p_hold_close":null},"PDH|pos_deep|1.5+":{"n":2,"p_touch":0.0,"p_hold_close":null},"PDH|pos_nocross|0-.25":{"n":33,"p_touch":0.758,"p_hold_close":0.64},"PDH|pos_nocross|.25-.5":{"n":29,"p_touch":0.448,"p_hold_close":0.615},"PDH|pos_nocross|.5-.75":{"n":5,"p_touch":0.2,"p_hold_close":null},"PDH|pos_nocross|.75-1":{"n":3,"p_touch":0.0,"p_hold_close":null},"PDH|pos_nocross|1-1.5":{"n":3,"p_touch":0.0,"p_hold_close":null},"PDH|pos_nocross|1.5+":{"n":6,"p_touch":0.0,"p_hold_close":null},"PDL|neg|0-.25":{"n":126,"p_touch":0.857,"p_hold_close":0.556},"PDL|neg|.25-.5":{"n":125,"p_touch":0.488,"p_hold_close":0.475},"PDL|neg|.5-.75":{"n":91,"p_touch":0.297,"p_hold_close":0.556},"PDL|neg|.75-1":{"n":50,"p_touch":0.26,"p_hold_close":0.615},"PDL|neg|1-1.5":{"n":42,"p_touch":0.095,"p_hold_close":null},"PDL|neg|1.5+":{"n":10,"p_touch":0.0,"p_hold_close":null},"PDL|neg_deep|0-.25":{"n":195,"p_touch":0.862,"p_hold_close":0.494},"PDL|neg_deep|.25-.5":{"n":150,"p_touch":0.52,"p_hold_close":0.5},"PDL|neg_deep|.5-.75":{"n":88,"p_touch":0.273,"p_hold_close":0.208},"PDL|neg_deep|.75-1":{"n":46,"p_touch":0.196,"p_hold_close":null},"PDL|neg_deep|1-1.5":{"n":33,"p_touch":0.061,"p_hold_close":null},"PDL|neg_deep|1.5+":{"n":10,"p_touch":0.0,"p_hold_close":null},"PDL|neg_nocross|0-.25":{"n":114,"p_touch":0.842,"p_hold_close":0.552},"PDL|neg_nocross|.25-.5":{"n":81,"p_touch":0.617,"p_hold_close":0.4},"PDL|neg_nocross|.5-.75":{"n":52,"p_touch":0.462,"p_hold_close":0.375},"PDL|neg_nocross|.75-1":{"n":38,"p_touch":0.289,"p_hold_close":0.273},"PDL|neg_nocross|1-1.5":{"n":29,"p_touch":0.31,"p_hold_close":null},"PDL|neg_nocross|1.5+":{"n":8,"p_touch":0.0,"p_hold_close":null},"PDL|pos|0-.25":{"n":121,"p_touch":0.727,"p_hold_close":0.455},"PDL|pos|.25-.5":{"n":149,"p_touch":0.43,"p_hold_close":0.5},"PDL|pos|.5-.75":{"n":141,"p_touch":0.227,"p_hold_close":0.406},"PDL|pos|.75-1":{"n":107,"p_touch":0.206,"p_hold_close":0.545},"PDL|pos|1-1.5":{"n":79,"p_touch":0.114,"p_hold_close":null},"PDL|pos|1.5+":{"n":19,"p_touch":0.0,"p_hold_close":null},"PDL|pos_deep|0-.25":{"n":65,"p_touch":0.738,"p_hold_close":0.458},"PDL|pos_deep|.25-.5":{"n":142,"p_touch":0.423,"p_hold_close":0.617},"PDL|pos_deep|.5-.75":{"n":231,"p_touch":0.247,"p_hold_close":0.561},"PDL|pos_deep|.75-1":{"n":185,"p_touch":0.114,"p_hold_close":0.381},"PDL|pos_deep|1-1.5":{"n":204,"p_touch":0.069,"p_hold_close":0.429},"PDL|pos_deep|1.5+":{"n":81,"p_touch":0.123,"p_hold_close":0.5},"PDL|pos_nocross|0-.25":{"n":1,"p_touch":1.0,"p_hold_close":null},"PDL|pos_nocross|.25-.5":{"n":5,"p_touch":0.2,"p_hold_close":null},"PDL|pos_nocross|.5-.75":{"n":15,"p_touch":0.133,"p_hold_close":null},"PDL|pos_nocross|.75-1":{"n":19,"p_touch":0.105,"p_hold_close":null},"PDL|pos_nocross|1-1.5":{"n":25,"p_touch":0.0,"p_hold_close":null},"PDL|pos_nocross|1.5+":{"n":17,"p_touch":0.0,"p_hold_close":null}},"reaction_5m":{"GF":{"p":0.567,"n":60},"ORH10":{"p":0.565,"n":131},"ORL10":{"p":0.49,"n":151},"PDC":{"p":0.429,"n":105},"PDH":{"p":0.489,"n":88},"PDL":{"p":0.405,"n":79},"Z#1":{"p":0.45,"n":109},"strike":{"p":0.496,"n":1727},"wall":{"p":0.513,"n":76}},"reach":{"neg":{"k":[0.25,0.5,0.75,1.0,1.25,1.5],"up":[0.64,0.366,0.167,0.066,0.02,0.007],"down":[0.638,0.366,0.237,0.125,0.057,0.02],"both":[0.298,0.048,0.009,0.002,0.0,0.0],"n":456},"neg_deep":{"k":[0.25,0.5,0.75,1.0,1.25,1.5],"up":[0.698,0.464,0.236,0.095,0.043,0.022],"down":[0.65,0.413,0.257,0.155,0.078,0.032],"both":[0.354,0.063,0.009,0.004,0.002,0.0],"n":537},"neg_nocross":{"k":[0.25,0.5,0.75,1.0,1.25,1.5],"up":[0.736,0.45,0.267,0.149,0.076,0.04],"down":[0.666,0.422,0.216,0.128,0.061,0.024],"both":[0.413,0.085,0.012,0.006,0.003,0.0],"n":329},"pos":{"k":[0.25,0.5,0.75,1.0,1.25,1.5],"up":[0.612,0.347,0.129,0.054,0.014,0.005],"down":[0.599,0.334,0.196,0.105,0.067,0.037],"both":[0.251,0.033,0.005,0.002,0.0,0.0],"n":629},"pos_deep":{"k":[0.25,0.5,0.75,1.0,1.25,1.5],"up":[0.56,0.268,0.1,0.032,0.014,0.009],"down":[0.611,0.348,0.187,0.107,0.062,0.046],"both":[0.234,0.036,0.003,0.0,0.0,0.0],"n":913},"pos_nocross":{"k":[0.25,0.5,0.75,1.0,1.25,1.5],"up":[0.5,0.293,0.122,0.061,0.024,0.012],"down":[0.537,0.293,0.134,0.085,0.037,0.024],"both":[0.098,0.024,0.0,0.0,0.0,0.0],"n":82}}}/*STATS_END*/;

  // Only candidate seen in the CFD tests (6y, exact on daily OHLC): positive in both halves, t ~ 1, so not proven.
  var EXT_NOTE = "Watch-only: fading a move of 1+ ATR from the open (stop 0.75 ATR, exit at the close) averaged +0.03 to +0.05 ATR per trade here, t ≈ 1, not proven.";

  var REGIME_TEXT = {
    pos_deep: {
      code: "RANGE", title: "Positive gamma: range / pin day",
      lines: [
        "Open is 0.5+ ATR above the gamma flip.",
        "Expect a smaller range; walls act as barriers (touched less often than other strikes).",
        "CFD: keep targets inside the walls and inside the reach odds below; a touched level is still a coin flip, so a fade needs its own trigger.",
      ],
    },
    pos: {
      code: "MILD_POS", title: "Mild positive gamma",
      lines: ["Open is just above the gamma flip.", "Range a little below average; a move under the flip turns the day into expansion odds."],
    },
    neg: {
      code: "MILD_NEG", title: "Mild negative gamma",
      lines: ["Open is just below the gamma flip.", "Range a little above average; reclaiming the flip moves the odds back to range.", EXT_NOTE],
    },
    neg_deep: {
      code: "EXPANSION", title: "Negative gamma: expansion / trend day",
      lines: [
        "Open is 0.5+ ATR below the gamma flip.",
        "Expect a wider range and about 1 day in 3 to trend; walls get run more often.",
        "CFD: widen stops (levels get pushed through further), cut size, do not fade levels near the open.",
        EXT_NOTE,
      ],
    },
    neg_nocross: {
      code: "EXPANSION", title: "Negative gamma everywhere near price: expansion day",
      lines: [
        "No gamma flip within ±3%: dealer gamma is negative across the whole range.",
        "Widest ranges in the sample. CFD: widen stops, cut size, do not fade levels.",
      ],
    },
    pos_nocross: {
      code: "RANGE", title: "Positive gamma everywhere near price: range day",
      lines: [
        "No gamma flip within ±3%: dealer gamma is positive across the whole range.",
        "Smallest ranges in the sample (rare: about 1 day in 36).",
      ],
    },
    unknown: {
      code: "UNKNOWN", title: "Gamma regime not available",
      lines: ["No usable OI ladder or vol index for this symbol; regime odds are not available."],
    },
  };

  function bsGamma(S, K, T, iv) {
    if (T <= 0 || iv <= 0) return 0;
    var d1 = (Math.log(S / K) + 0.5 * iv * iv * T) / (iv * Math.sqrt(T));
    return Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI) / (S * iv * Math.sqrt(T));
  }

  /* Dealer GEX ($ per 1% move, dealers long calls / short puts) at hypothetical spots. ladder rows: {strike, put_oi, call_oi} */
  function gexAt(ladder, iv, T, S) {
    var tot = 0;
    for (var i = 0; i < ladder.length; i++) {
      var r = ladder[i];
      tot += ((r.call_oi || 0) - (r.put_oi || 0)) * bsGamma(S, r.strike, T, iv);
    }
    return tot * 100 * S * S * 0.01;
  }

  /* Zero-gamma price nearest the reference, scanning ±3% in 121 steps (same as research/features.py). */
  function gammaFlip(ladder, iv, T, ref) {
    var n = 121, xs = [], ys = [];
    for (var i = 0; i < n; i++) {
      var S = ref * 0.97 + (ref * 0.06) * i / (n - 1);
      xs.push(S); ys.push(gexAt(ladder, iv, T, S));
    }
    var best = null;
    for (var j = 0; j < n - 1; j++) {
      if (Math.sign(ys[j]) !== Math.sign(ys[j + 1])) {
        if (best === null || Math.abs(xs[j] - ref) < Math.abs(xs[best] - ref)) best = j;
      }
    }
    if (best === null) return { flip: null, gex: ys[60] };
    var x0 = xs[best], x1 = xs[best + 1], y0 = ys[best], y1 = ys[best + 1];
    return { flip: x0 - y0 * (x1 - x0) / (y1 - y0), gex: ys[60] };
  }

  /* ATR(14) from prior sessions [[o,h,l,c], ...] oldest first (needs 15+). */
  function atr14(daily) {
    if (!daily || daily.length < 15) return null;
    var trs = [];
    for (var i = daily.length - 14; i < daily.length; i++) {
      var h = daily[i][1], l = daily[i][2], pc = daily[i - 1][3];
      trs.push(Math.max(h, pc) - Math.min(l, pc));
    }
    return trs.reduce(function (a, b) { return a + b; }, 0) / trs.length;
  }

  function bucket(x, edges, labels) {
    for (var i = 0; i < edges.length; i++) if (x <= edges[i]) return labels[i];
    return labels[labels.length - 1];
  }
  var REG_L = ["neg_deep", "neg", "pos", "pos_deep"];
  var DIST_L = ["0-.25", ".25-.5", ".5-.75", ".75-1", "1-1.5", "1.5+"];
  var GAP_L = ["down_big", "down", "flat", "up", "up_big"];
  function meta(k, dflt) { return (STATS.meta && STATS.meta[k]) || dflt; }
  function regimeOf(gfDistAtr) { return gfDistAtr === null ? "unknown" : bucket(gfDistAtr, meta("regime_buckets_atr", [-0.5, 0, 0.5]), REG_L); }
  function distOf(d) { return bucket(d, meta("dist_buckets_atr", [0.25, 0.5, 0.75, 1, 1.5]), DIST_L); }
  function gapOf(g) { return bucket(g, meta("gap_buckets_atr", [-0.6, -0.15, 0.15, 0.6]), GAP_L); }

  function levelStats(side, isWall, reg, dist) {
    if (!STATS.level || reg === "unknown") return null;
    var key = side + "|" + (isWall ? "wall" : "strike") + "|" + reg + "|" + distOf(dist);
    var c = STATS.level[key];
    if (isWall && (!c || c.n < 40)) c = STATS.level[side + "|strike|" + reg + "|" + distOf(dist)];
    return c || null;
  }

  function pct(p) { return p === null || p === undefined ? "–" : Math.round(p * 100) + "%"; }
  function fmtK(n) { return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n)); }

  function walls(rows, ref, above, n, key) {
    return rows
      .filter(function (r) { return above ? r.strike > ref : r.strike < ref; })
      .map(function (r) { return { strike: r.strike, size: (r[key] || 0) }; })
      .filter(function (r) { return r.size > 0; })
      .sort(function (a, b) { return b.size - a.size; })
      .slice(0, n);
  }

  /*
   * input = {
   *   ticker, open, spot, atr (or daily: [[o,h,l,c], ...] prior sessions, oldest first),
   *   iv (vol index prior close / 100: VIX for SPY, VXN for QQQ),
   *   prevDay: {h, l, c},
   *   weekly: [{strike, put_oi, call_oi}],          // expiries <= 7 DTE
   *   zdte:   [{strike, put_oi, call_oi, put_vol?, call_vol?}],  // nearest expiry
   *   bars:   [[t, o, h, l, c], ...] today's 5m RTH bars so far (optional)
   * }
   */
  function analyze(inp) {
    var ref = inp.open, atr = inp.atr || atr14(inp.daily);
    var calibrated = inp.ticker === "SPY" || inp.ticker === "QQQ";
    var out = { version: "2.1.0", ticker: inp.ticker, calibrated: calibrated, levels: [], notes: [] };
    if (!(ref > 0) || !(atr > 0)) { out.error = "open/ATR missing"; return out; }

    var gf = (inp.weekly && inp.weekly.length && inp.iv > 0) ? gammaFlip(inp.weekly, inp.iv, 2 / 252, ref) : { flip: null, gex: null };
    out.gammaFlip = gf.flip;
    out.gex = gf.gex;
    out.gfDistAtr = gf.flip ? (ref - gf.flip) / atr : null;
    // No crossing within ±3%: the sign of GEX at the open decides (calibrated as its own bucket)
    out.regime = gf.flip ? regimeOf(out.gfDistAtr) : (gf.gex > 0 ? "pos_nocross" : gf.gex < 0 ? "neg_nocross" : "unknown");
    out.regimeStats = (STATS.regime && STATS.regime[out.regime]) || null;
    var pdc = inp.prevDay ? inp.prevDay.c : null;
    out.gapAtr = pdc ? (ref - pdc) / atr : null;
    out.gapBucket = out.gapAtr === null ? null : gapOf(out.gapAtr);
    var gfCell = (STATS.gap_fill && out.gapBucket && out.gapBucket !== "flat") ? STATS.gap_fill[out.gapBucket + "|" + out.regime] : null;
    out.gapFill = gfCell || null;

    var levels = [];
    function add(price, label, color, kind, extra) {
      if (!(price > 0) || !isFinite(price)) return;
      var side = price > ref ? "res" : "sup";
      var dist = Math.abs(price - ref) / atr;
      levels.push(Object.assign({ price: price, label: label, color: color, kind: kind, side: side, distAtr: dist }, extra || {}));
    }

    // 1. Weekly OI walls (calibrated): 2 per side, biggest first
    var wk = inp.weekly || [];
    [["call_oi", true, "CALL WALL", ["#dc2626", "#f87171"]], ["put_oi", false, "PUT WALL", ["#059669", "#34d399"]]].forEach(function (cfg) {
      walls(wk, ref, cfg[1], 2, cfg[0]).forEach(function (w, i) {
        var st = levelStats(cfg[1] ? "res" : "sup", i === 0, out.regime, Math.abs(w.strike - ref) / atr);
        add(w.strike, cfg[2] + (i ? " 2" : "") + " · " + fmtK(w.size), cfg[3][i], i ? "wall2" : "wall1",
            { oi: w.size, pTouch: st ? st.p_touch : null, pHoldClose: st ? st.p_hold_close : null, penP80: st ? st.pen_p80 : null, n: st ? st.n : 0 });
      });
    });
    // 2. Nearest-expiry wall (OI + today's volume, as on the live DOM), 1 per side
    var z = (inp.zdte || []).map(function (r) {
      return { strike: r.strike, c: (r.call_oi || 0) + (r.call_vol || 0), p: (r.put_oi || 0) + (r.put_vol || 0) };
    });
    walls(z, ref, true, 1, "c").forEach(function (w) { add(w.strike, "0DTE CALL WALL · " + fmtK(w.size), "#fb7185", "zwall"); });
    walls(z, ref, false, 1, "p").forEach(function (w) { add(w.strike, "0DTE PUT WALL · " + fmtK(w.size), "#4ade80", "zwall"); });
    // 3. Gamma flip
    if (gf.flip) {
      var gst = levelStats(gf.flip > ref ? "res" : "sup", false, out.regime, Math.abs(gf.flip - ref) / atr);
      add(gf.flip, "GAMMA FLIP", "#facc15", "gf", { pTouch: gst ? gst.p_touch : null, pHoldClose: gst ? gst.p_hold_close : null });
    }
    // 4. Prior day
    if (inp.prevDay) {
      [["PDH", inp.prevDay.h, "PRIOR DAY HIGH"], ["PDL", inp.prevDay.l, "PRIOR DAY LOW"], ["PDC", inp.prevDay.c, "PRIOR DAY CLOSE"]].forEach(function (p) {
        var d = Math.abs(p[1] - ref) / atr;
        var c = (STATS.prior_day && out.regime !== "unknown") ? STATS.prior_day[p[0] + "|" + out.regime + "|" + distOf(d)] : null;
        add(p[1], p[2], "#38bdf8", "prior", { pTouch: c ? c.p_touch : null, pHoldClose: c ? c.p_hold_close : null });
      });
    }
    // 5. Opening range: 10 min once 09:40 is complete, 30 min once 10:00 is complete (never a partial range)
    var bars = inp.bars || [];
    if (bars.length >= 2) {
      var or10 = bars.slice(0, 2);
      add(Math.max.apply(null, or10.map(function (b) { return b[2]; })), "OPENING RANGE 10m HIGH", "#a78bfa", "or");
      add(Math.min.apply(null, or10.map(function (b) { return b[3]; })), "OPENING RANGE 10m LOW", "#a78bfa", "or");
    }
    if (bars.length >= 6) {
      var or30 = bars.slice(0, 6);
      add(Math.max.apply(null, or30.map(function (b) { return b[2]; })), "OPENING RANGE 30m HIGH", "#c4b5fd", "or");
      add(Math.min.apply(null, or30.map(function (b) { return b[3]; })), "OPENING RANGE 30m LOW", "#c4b5fd", "or");
    }

    // 6. Caller's extra lines (e.g. premarket high/low): drawn, no odds
    (inp.extra || []).forEach(function (e) { add(e.price, e.label, e.color || "#38bdf8", "extra"); });

    // Touched yet? (from today's bars)
    if (bars.length) {
      var hi = -Infinity, lo = Infinity;
      bars.forEach(function (b) { hi = Math.max(hi, b[2]); lo = Math.min(lo, b[3]); });
      levels.forEach(function (l) { if (l.kind !== "or" && l.kind !== "extra") l.touched = l.side === "res" ? hi >= l.price : lo <= l.price; });
      out.sessionHigh = hi; out.sessionLow = lo;
    }

    // Probability suffix on the line label (only where calibrated)
    levels.forEach(function (l) {
      if (calibrated && (l.pTouch !== undefined && l.pTouch !== null)) {
        l.label += " · touch " + pct(l.pTouch) + (l.pHoldClose !== null && l.pHoldClose !== undefined ? " · close back " + pct(l.pHoldClose) : "");
      }
      if (l.touched) l.label += " · TOUCHED";
    });

    // Merge levels within 0.05% so labels do not overlap; walls own the line
    levels.sort(function (a, b) { return a.price - b.price; });
    var merged = [];
    levels.forEach(function (l) {
      var last = merged[merged.length - 1];
      if (last && l.price - last.price <= last.price * 0.0005) {
        if (/WALL/.test(l.label) && !/WALL/.test(last.label)) merged[merged.length - 1] = Object.assign({}, l, { label: l.label + " + " + last.label });
        else last.label += " + " + l.label;
      } else merged.push(l);
    });
    out.levels = merged;

    // Scenario / playbook
    var rs = out.regimeStats;
    var txt = REGIME_TEXT[out.regime] || REGIME_TEXT.unknown;
    out.scenario = { code: txt.code, title: txt.title, lines: txt.lines.slice() };
    if (rs && calibrated) {
      out.expectedRange = { atr: rs.range_atr, dollars: rs.range_atr * atr, p80Dollars: rs.range_atr_p80 * atr };
      out.scenario.lines.push("6y odds here: range " + rs.range_atr.toFixed(2) + " ATR ($" + (rs.range_atr * atr).toFixed(2) + "), trend day " + pct(rs.trend_day) +
        ", up close " + pct(rs.up) + ", open→close = " + rs.real_vs_impl.toFixed(2) + "× the vol-index implied move (n=" + rs.n + ").");
    }
    var rc = STATS.reach && STATS.reach[out.regime];
    if (rc && calibrated) {
      var at = function (arr, k) { return arr[rc.k.indexOf(k)]; };
      out.reach = { k: rc.k, up: rc.up, down: rc.down };
      out.scenario.lines.push("Reach from the open (" + rc.n + " days): +0.5 ATR ($" + (ref + 0.5 * atr).toFixed(2) + ") " + pct(at(rc.up, 0.5)) +
        ", +0.75 ATR ($" + (ref + 0.75 * atr).toFixed(2) + ") " + pct(at(rc.up, 0.75)) + "; −0.5 ATR ($" + (ref - 0.5 * atr).toFixed(2) + ") " + pct(at(rc.down, 0.5)) +
        ", −0.75 ATR ($" + (ref - 0.75 * atr).toFixed(2) + ") " + pct(at(rc.down, 0.75)) + ".");
    }
    if (out.gapFill && calibrated) {
      out.scenario.lines.push("Gap " + (out.gapAtr > 0 ? "up " : "down ") + Math.abs(out.gapAtr).toFixed(2) + " ATR: prior close revisited " + pct(out.gapFill.p) + " of the time in this regime (n=" + out.gapFill.n + ").");
    }
    if (inp.preOpen) out.notes.push("Pre-open: the last premarket price stands in for the open until 09:30.");
    if (!calibrated) out.notes.push("Odds are calibrated on SPY and QQQ only; levels shown without probabilities.");
    out.notes.push("Tested on the underlying with no edge: fading or breaking walls / flip / prior-day levels (5m reaction odds ≈ 50%), opening-range breakouts, gap fades, late-day pins.");
    return out;
  }

  return { VERSION: "2.1.0", STATS: STATS, analyze: analyze, gammaFlip: gammaFlip, atr14: atr14, bsGamma: bsGamma };
});
