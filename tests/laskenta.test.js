// Laskentafunktioiden testit. Aja: npm test (tai node --test)
// Vertailuarvot lasketaan annuiteettikaavalla, joten testit tarkistavat
// laskennan oikeellisuuden eivätkä vain sitä, että koodi palauttaa jotain.

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/laskenta.js");

// Annuiteettikaava kuukausikorolla i: erä, jolla pääoma maksetaan n kuukaudessa.
const annuiteetti = (paaoma, i, n) => (paaoma * i) / (1 - Math.pow(1 + i, -n));
const lahes = (a, b, tarkkuus = 0.01) =>
  assert.ok(Math.abs(a - b) <= tarkkuus, `odotettiin ${b}, saatiin ${a}`);

beforeEach(() => L.asetaKorkotyyppi("todellinen"));

test("nimelliskorko jaetaan tasan kuukausille", () => {
  L.asetaKorkotyyppi("nimellinen");
  lahes(L.kuukausikorko(12), 0.01, 1e-12);
});

test("todellinen vuosikorko palautuu korkoa korolle 12 kuukaudessa", () => {
  const i = L.kuukausikorko(12);
  lahes(Math.pow(1 + i, 12) - 1, 0.12, 1e-12);
  assert.ok(i < 0.01, "TVK:n kuukausikoron pitää olla pienempi kuin nimellisen");
});

test("tuntematon korkotyyppi tulkitaan todelliseksi vuosikoroksi", () => {
  L.asetaKorkotyyppi("jotain-muuta");
  lahes(Math.pow(1 + L.kuukausikorko(6), 12) - 1, 0.06, 1e-12);
});

test("annuiteettierällä laina maksetaan täsmälleen laina-ajassa", () => {
  L.asetaKorkotyyppi("nimellinen");
  const i = 0.06 / 12;
  const era = annuiteetti(10000, i, 24);
  const tulos = L.laskeLaina(10000, 6, era);

  assert.equal(tulos.kuukaudet, 24);
  lahes(tulos.korotYhteensa, era * 24 - 10000); // 636,95 €
  lahes(tulos.maksettuYhteensa, era * 24);
  assert.equal(tulos.riittamaton, false);
});

test("viimeinen erä ei maksa yli jäljellä olevan pääoman", () => {
  const tulos = L.laskeLaina(1000, 5, 300);
  const lyhennykset = tulos.aikataulu.reduce((s, kk) => s + kk.lyhennys, 0);
  const viimeinen = tulos.aikataulu[tulos.aikataulu.length - 1];

  lahes(lyhennykset, 1000);
  assert.equal(viimeinen.jaljella, 0);
  assert.ok(viimeinen.maksu < 300, "viimeisen erän pitää olla normaalia pienempi");
});

test("kuukausikulut lasketaan jokaiselle kuukaudelle eivätkä lyhennä pääomaa", () => {
  L.asetaKorkotyyppi("nimellinen");
  const ilman = L.laskeLaina(5000, 4, 200);
  const kuluilla = L.laskeLaina(5000, 4, 200, 5);

  lahes(kuluilla.kulutYhteensa, kuluilla.kuukaudet * 5);
  // Kulut vievät osan erästä, joten pääoma lyhenee hitaammin ja korkoa kertyy enemmän.
  assert.ok(kuluilla.korotYhteensa > ilman.korotYhteensa);
  // Maksettu yhteensä = pääoma + korot + kulut.
  lahes(kuluilla.maksettuYhteensa, 5000 + kuluilla.korotYhteensa + kuluilla.kulutYhteensa);
});

test("erä, joka ei kata korkoa ja kuluja, merkitään riittämättömäksi", () => {
  L.asetaKorkotyyppi("nimellinen");
  // Korko ensimmäisenä kuukautena 10 000 € × 12 % / 12 = 100 €.
  const tulos = L.laskeLaina(10000, 12, 100);
  assert.equal(tulos.riittamaton, true);
  assert.equal(tulos.kuukaudet, Infinity);

  const kuluilla = L.laskeLaina(10000, 12, 105, 10);
  assert.equal(kuluilla.riittamaton, true);
});

test("korottomassa lainassa maksuaika on saldo jaettuna erällä", () => {
  const tulos = L.laskeLaina(1200, 0, 100);
  assert.equal(tulos.kuukaudet, 12);
  assert.equal(tulos.korotYhteensa, 0);
});

test("yhden lainan strategiasimulaatio vastaa yksittäistä laskentaa", () => {
  const laina = { nimi: "A", saldo: 8000, korko: 7, kkMaksu: 250 };
  const yksin = L.laskeLaina(laina.saldo, laina.korko, laina.kkMaksu);
  const simuloitu = L.simuloiStrategia([laina], 0, "lumivyory");

  assert.equal(simuloitu.kuukaudet, yksin.kuukaudet);
  lahes(simuloitu.korotYhteensa, yksin.korotYhteensa);
});

const lainat = [
  { nimi: "Kulutusluotto", saldo: 5000, korko: 15, kkMaksu: 150 },
  { nimi: "Opintolaina", saldo: 2000, korko: 5, kkMaksu: 80 },
  { nimi: "Autolaina", saldo: 8000, korko: 9, kkMaksu: 200 },
];

test("lumivyöry maksaa korkeimman koron lainan ensin", () => {
  const tulos = L.simuloiStrategia(lainat, 300, "lumivyory");
  assert.equal(tulos.jarjestys[0].nimi, "Kulutusluotto");
});

test("lumipallo maksaa pienimmän lainan ensin", () => {
  const tulos = L.simuloiStrategia(lainat, 300, "lumipallo");
  assert.equal(tulos.jarjestys[0].nimi, "Opintolaina");
});

test("lumivyöry ei koskaan maksa enempää korkoa kuin lumipallo", () => {
  for (const lisa of [0, 50, 200, 500]) {
    const vyory = L.simuloiStrategia(lainat, lisa, "lumivyory");
    const pallo = L.simuloiStrategia(lainat, lisa, "lumipallo");
    assert.ok(
      vyory.korotYhteensa <= pallo.korotYhteensa + 0.01,
      `lisäbudjetilla ${lisa} €: lumivyöry ${vyory.korotYhteensa}, lumipallo ${pallo.korotYhteensa}`
    );
  }
});

test("lisäbudjetti lyhentää maksuaikaa ja pienentää korkoja", () => {
  const ilman = L.simuloiStrategia(lainat, 0, "lumivyory");
  const kanssa = L.simuloiStrategia(lainat, 200, "lumivyory");
  assert.ok(kanssa.kuukaudet < ilman.kuukaudet);
  assert.ok(kanssa.korotYhteensa < ilman.korotYhteensa);
});

test("simulaatio tunnistaa velan, joka ei koskaan pienene", () => {
  const tulos = L.simuloiStrategia([{ nimi: "X", saldo: 10000, korko: 20, kkMaksu: 50 }], 0, "lumivyory");
  assert.equal(tulos.riittamaton, true);
});

test("yhdistelylainan erä vastaa annuiteettikaavaa", () => {
  L.asetaKorkotyyppi("nimellinen");
  const tulos = L.yhdistelyLaina(15000, 6, 60);
  const odotettuEra = annuiteetti(15000, 0.06 / 12, 60);

  lahes(tulos.era, odotettuEra);
  lahes(tulos.korotYhteensa, odotettuEra * 60 - 15000);
});

test("korottoman yhdistelylainan erä on pääoma jaettuna kuukausilla", () => {
  const tulos = L.yhdistelyLaina(6000, 0, 24);
  assert.equal(tulos.era, 250);
  assert.equal(tulos.korotYhteensa, 0);
});

test("tavoitebudjetilla velat maksetaan tavoiteajassa", () => {
  const tavoite = 24;
  const tulos = L.laskeTavoiteBudjetti(lainat, tavoite);

  assert.equal(tulos.mahdoton, false);
  assert.ok(tulos.kuukaudet <= tavoite);
  // Euroa pienempi budjetti ei saa riittää, muuten haku ei löytänyt pienintä.
  const liianPieni = L.simuloiStrategia(lainat, tulos.lisabudjetti - 1, "lumivyory");
  assert.ok(liianPieni.kuukaudet > tavoite);
});

test("jos minimierät riittävät, lisäbudjettia ei tarvita", () => {
  const tulos = L.laskeTavoiteBudjetti(lainat, 1000);
  assert.equal(tulos.lisabudjetti, 0);
  assert.equal(tulos.joEnnen, true);
});

test("kesto muotoillaan vuosiksi ja kuukausiksi", () => {
  assert.equal(L.muotoileKesto(40), "3 v 4 kk");
  assert.equal(L.muotoileKesto(12), "1 v");
  assert.equal(L.muotoileKesto(5), "5 kk");
  assert.equal(L.muotoileKesto(0), "0 kk");
  assert.equal(L.muotoileKesto(Infinity), "ei maksu koskaan pois");
});
