/*
 * laskenta.js — Lainojen takaisinmaksun laskentafunktiot.
 *
 * Kaikki summat euroina, korot vuosikorkona prosentteina (esim. 4.5 = 4,5 %).
 * Lyhennykset ovat kuukausimaksuja (annuiteetti-tyyppinen: korko + lyhennys).
 */

// Miten syötetty vuosikorko tulkitaan:
//  "todellinen" = todellinen vuosikorko (TVK, efektiivinen) — oletus
//  "nimellinen" = nimelliskorko (jaetaan tasan 12 kk:lle)
let korkotila = "todellinen";

/**
 * Asettaa käytettävän korkotyypin ("todellinen" | "nimellinen").
 */
function asetaKorkotyyppi(tyyppi) {
  korkotila = tyyppi === "nimellinen" ? "nimellinen" : "todellinen";
}

/**
 * Kuukausikorko desimaalilukuna vuosikorosta (%).
 *
 * Todellinen vuosikorko on efektiivinen: kun kuukausikorko kerrotaan
 * korkoa korolle 12 kertaa, tulokseksi tulee juuri syötetty vuosikorko.
 * Nimelliskorko jaetaan yksinkertaisesti 12:lla.
 */
function kuukausikorko(vuosikorkoProsentti) {
  if (korkotila === "nimellinen") {
    return vuosikorkoProsentti / 100 / 12;
  }
  return Math.pow(1 + vuosikorkoProsentti / 100, 1 / 12) - 1;
}

/**
 * Laskee yksittäisen lainan takaisinmaksun kuukausi kuukaudelta.
 *
 * @param {number} saldo         Jäljellä oleva pääoma (€)
 * @param {number} vuosikorko    Vuosikorko (%)
 * @param {number} kkMaksu       Kuukausimaksu (€)
 * @param {number} maxKuukaudet  Turvaraja ettei silmukka jää ikuiseksi
 * @returns {{
 *   kuukaudet: number,          Montako kuukautta maksuun menee
 *   korotYhteensa: number,      Maksetut korot yhteensä (€)
 *   maksettuYhteensa: number,   Maksettu yhteensä pääoma + korot (€)
 *   riittamaton: boolean,       Tosi jos maksu ei kata edes korkoa
 *   aikataulu: Array            Kuukausittainen erittely
 * }}
 */
function laskeLaina(saldo, vuosikorko, kkMaksu, maxKuukaudet = 1200) {
  const i = kuukausikorko(vuosikorko);
  const aikataulu = [];
  let jaljella = saldo;
  let korotYhteensa = 0;
  let maksettuYhteensa = 0;
  let kuukaudet = 0;

  // Jos maksu ei kata ensimmäisen kuukauden korkoa, laina ei koskaan pienene.
  const ensimmainenKorko = jaljella * i;
  if (kkMaksu <= ensimmainenKorko && i > 0) {
    return {
      kuukaudet: Infinity,
      korotYhteensa: Infinity,
      maksettuYhteensa: Infinity,
      riittamaton: true,
      aikataulu: [],
    };
  }

  while (jaljella > 0.005 && kuukaudet < maxKuukaudet) {
    const korko = jaljella * i;
    let lyhennys = kkMaksu - korko;

    // Viimeinen erä: älä maksa yli jäljellä olevan pääoman.
    if (lyhennys >= jaljella) {
      lyhennys = jaljella;
    }

    const maksuTallaKuulla = lyhennys + korko;
    jaljella -= lyhennys;
    korotYhteensa += korko;
    maksettuYhteensa += maksuTallaKuulla;
    kuukaudet += 1;

    aikataulu.push({
      kuukausi: kuukaudet,
      korko: korko,
      lyhennys: lyhennys,
      maksu: maksuTallaKuulla,
      jaljella: Math.max(jaljella, 0),
    });
  }

  return {
    kuukaudet,
    korotYhteensa,
    maksettuYhteensa,
    riittamaton: false,
    aikataulu,
  };
}

/**
 * Muuntaa kuukausimäärän luettavaan muotoon, esim. "3 v 4 kk".
 */
function muotoileKesto(kuukaudet) {
  if (!isFinite(kuukaudet)) return "ei maksu koskaan pois";
  if (kuukaudet === 0) return "0 kk";
  const vuodet = Math.floor(kuukaudet / 12);
  const kk = kuukaudet % 12;
  const osat = [];
  if (vuodet > 0) osat.push(`${vuodet} v`);
  if (kk > 0) osat.push(`${kk} kk`);
  return osat.join(" ");
}

/**
 * Muotoilee euromäärän suomalaisittain, esim. "1 234,56 €".
 */
function euro(summa) {
  if (!isFinite(summa)) return "–";
  return summa.toLocaleString("fi-FI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Laskee arvioidun takaisinmaksupäivän tästä hetkestä n kuukauden päähän.
 */
function maksuValmisPaiva(kuukaudet) {
  if (!isFinite(kuukaudet)) return null;
  const pvm = new Date();
  pvm.setMonth(pvm.getMonth() + kuukaudet);
  return pvm;
}

/**
 * Simuloi useamman lainan takaisinmaksua annetulla strategialla.
 *
 * Kaikille lainoille maksetaan aina vähintään niiden oma kk-maksu.
 * Kun jokin laina on maksettu pois, vapautuva maksu + mahdollinen
 * lisäbudjetti ohjataan strategian mukaiseen seuraavaan lainaan
 * (velkalumivyöry / velkalumipallo -periaate).
 *
 * @param {Array} lainat        [{ nimi, saldo, korko, kkMaksu }]
 * @param {number} lisabudjetti Ylimääräinen kk-summa (€) kohdennettavaksi
 * @param {string} strategia    "lumivyory" (korkein korko) | "lumipallo" (pienin saldo)
 * @returns {{
 *   kuukaudet, korotYhteensa, maksettuYhteensa,
 *   riittamaton, jarjestys, aikataulu
 * }}
 */
function simuloiStrategia(lainat, lisabudjetti, strategia, maxKuukaudet = 1200) {
  // Kopioidaan tila, ettei muokata alkuperäisiä.
  let tila = lainat.map((l, idx) => ({
    idx,
    nimi: l.nimi,
    jaljella: l.saldo,
    korko: l.korko,
    kkMaksu: l.kkMaksu,
    maksettuKuukausi: null,
  }));

  let kuukaudet = 0;
  let korotYhteensa = 0;
  let maksettuYhteensa = 0;
  const aikataulu = [];
  const jarjestys = [];

  // Perusvaroitus: kattavatko kk-maksut edes korot yhteensä?
  const kokonaisMaksu =
    lainat.reduce((s, l) => s + l.kkMaksu, 0) + lisabudjetti;

  while (tila.some((l) => l.jaljella > 0.005) && kuukaudet < maxKuukaudet) {
    kuukaudet += 1;

    // 1. Peritään korot ja maksetaan minimit kaikille avoimille lainoille.
    let kaytettavissa = lisabudjetti; // lisäbudjetti + vapautuneet minimit
    for (const l of tila) {
      if (l.jaljella <= 0.005) {
        // Jo maksettu — vapautuu minimimaksu kohdennettavaksi.
        kaytettavissa += l.kkMaksu;
        continue;
      }
      const korko = l.jaljella * kuukausikorko(l.korko);
      l.jaljella += korko;
      korotYhteensa += korko;

      const minimi = Math.min(l.kkMaksu, l.jaljella);
      l.jaljella -= minimi;
      maksettuYhteensa += minimi;

      // Jos minimi olisi ollut isompi kuin jäljellä, ylijäävä osa vapautuu.
      kaytettavissa += l.kkMaksu - minimi;
    }

    // 2. Valitaan kohdelaina strategian mukaan ja kohdennetaan ylimäärä.
    let turva = 0;
    while (kaytettavissa > 0.005 && turva < tila.length + 1) {
      turva += 1;
      const avoimet = tila.filter((l) => l.jaljella > 0.005);
      if (avoimet.length === 0) break;

      avoimet.sort((a, b) => {
        if (strategia === "lumipallo") {
          return a.jaljella - b.jaljella; // pienin saldo ensin
        }
        return b.korko - a.korko; // lumivyöry: korkein korko ensin
      });

      const kohde = avoimet[0];
      const maksu = Math.min(kaytettavissa, kohde.jaljella);
      kohde.jaljella -= maksu;
      kaytettavissa -= maksu;
      maksettuYhteensa += maksu;
    }

    // 3. Merkitään juuri maksuun tulleet lainat.
    for (const l of tila) {
      if (l.jaljella <= 0.005 && l.maksettuKuukausi === null) {
        l.maksettuKuukausi = kuukaudet;
        jarjestys.push({ nimi: l.nimi, kuukausi: kuukaudet });
      }
    }

    aikataulu.push({
      kuukausi: kuukaudet,
      jaljellaYhteensa: tila.reduce((s, l) => s + Math.max(l.jaljella, 0), 0),
    });

    // Turvatarkistus: jos velka ei pienene lainkaan, keskeytetään.
    if (
      kuukaudet > 3 &&
      aikataulu[kuukaudet - 1].jaljellaYhteensa >=
        aikataulu[kuukaudet - 2].jaljellaYhteensa - 0.001
    ) {
      return {
        kuukaudet: Infinity,
        korotYhteensa: Infinity,
        maksettuYhteensa: Infinity,
        riittamaton: true,
        jarjestys: [],
        aikataulu: [],
      };
    }
  }

  return {
    kuukaudet,
    korotYhteensa,
    maksettuYhteensa,
    riittamaton: kuukaudet >= maxKuukaudet,
    jarjestys,
    aikataulu,
  };
}

/**
 * Laskee yhdistelylainan (kaikki velat yhtenä annuiteettilainana).
 *
 * @param {number} paaoma     Yhdistettävä kokonaisvelka (€)
 * @param {number} vuosikorko Uuden lainan vuosikorko (%)
 * @param {number} kuukaudet  Laina-aika kuukausina
 * @returns {{ era, maksettu, korotYhteensa, kuukaudet }}
 */
function yhdistelyLaina(paaoma, vuosikorko, kuukaudet) {
  const i = kuukausikorko(vuosikorko);
  let era;
  if (i === 0) {
    era = paaoma / kuukaudet;
  } else {
    era = (paaoma * i) / (1 - Math.pow(1 + i, -kuukaudet));
  }
  const maksettu = era * kuukaudet;
  return {
    era,
    maksettu,
    korotYhteensa: maksettu - paaoma,
    kuukaudet,
  };
}

/**
 * Etsii pienimmän ylimääräisen kuukausibudjetin, jolla velat saa maksettua
 * pois annetussa ajassa (lumivyöry-strategialla). Käyttää puolitushakua.
 *
 * @param {Array} lainat            [{ nimi, saldo, korko, kkMaksu }]
 * @param {number} tavoiteKuukaudet Tavoite: velaton viimeistään näin monessa kk
 * @returns {{ lisabudjetti, kuukaudet, joEnnen, mahdoton }}
 */
function laskeTavoiteBudjetti(lainat, tavoiteKuukaudet, maxKuukaudet = 1200) {
  const perus = simuloiStrategia(lainat, 0, "lumivyory", maxKuukaudet);

  // Jos jo pelkillä minimeillä ehtii, lisäbudjettia ei tarvita.
  if (!perus.riittamaton && perus.kuukaudet <= tavoiteKuukaudet) {
    return {
      lisabudjetti: 0,
      kuukaudet: perus.kuukaudet,
      joEnnen: true,
      mahdoton: false,
    };
  }

  const kokonaisVelka = lainat.reduce((s, l) => s + l.saldo, 0);
  let lo = 0;
  let hi = kokonaisVelka; // Tällä velat lähtee käytännössä heti.

  for (let it = 0; it < 48; it++) {
    const mid = (lo + hi) / 2;
    const s = simuloiStrategia(lainat, mid, "lumivyory", maxKuukaudet);
    if (!s.riittamaton && s.kuukaudet <= tavoiteKuukaudet) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const lisabudjetti = Math.ceil(hi);
  const lopullinen = simuloiStrategia(lainat, lisabudjetti, "lumivyory", maxKuukaudet);
  return {
    lisabudjetti,
    kuukaudet: lopullinen.kuukaudet,
    joEnnen: false,
    mahdoton: lopullinen.riittamaton,
  };
}

// Vie funktiot testejä varten (Node) ilman että selain hajoaa.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    kuukausikorko,
    asetaKorkotyyppi,
    laskeLaina,
    muotoileKesto,
    euro,
    maksuValmisPaiva,
    simuloiStrategia,
    yhdistelyLaina,
    laskeTavoiteBudjetti,
  };
}
