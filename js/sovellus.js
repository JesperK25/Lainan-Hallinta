/*
 * sovellus.js — Käyttöliittymän logiikka.
 * Käyttää laskenta.js:n funktioita ja tallentaa tiedot localStorageen.
 */

(function () {
  "use strict";

  const TALLENNUSAVAIN = "lainanhallinta.lainat.v1";
  const BUDJETTIAVAIN = "lainanhallinta.lisabudjetti.v1";

  let lainat = lataaLainat();
  let parasStrategiaNyt = "lumivyory";

  // --- DOM-viitteet ---
  const lomake = document.getElementById("laina-lomake");
  const muokkausId = document.getElementById("muokkaus-id");
  const lomakeOtsikko = document.getElementById("lomake-otsikko");
  const tallennaNappi = document.getElementById("tallenna-nappi");
  const peruutaNappi = document.getElementById("peruuta-nappi");
  const lomakeVirhe = document.getElementById("lomake-virhe");
  const lainalista = document.getElementById("lainalista");
  const tyhjaTeksti = document.getElementById("tyhja-teksti");
  const lisabudjettiKentta = document.getElementById("lisabudjetti");

  // --- Tallennus ---
  function lataaLainat() {
    try {
      const data = localStorage.getItem(TALLENNUSAVAIN);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function tallennaLainat() {
    localStorage.setItem(TALLENNUSAVAIN, JSON.stringify(lainat));
  }

  function lataaBudjetti() {
    const arvo = localStorage.getItem(BUDJETTIAVAIN);
    return arvo !== null ? parseFloat(arvo) : 0;
  }

  function tallennaBudjetti(arvo) {
    localStorage.setItem(BUDJETTIAVAIN, String(arvo));
  }

  // --- Lomakkeen käsittely ---
  lomake.addEventListener("submit", function (e) {
    e.preventDefault();
    piilotaVirhe();

    const nimi = document.getElementById("nimi").value.trim();
    const saldo = parseFloat(document.getElementById("saldo").value);
    const korko = parseFloat(document.getElementById("korko").value);
    const kkMaksu = parseFloat(document.getElementById("kkmaksu").value);

    if (!nimi) return naytaVirhe("Anna lainalle nimi.");
    if (!(saldo > 0)) return naytaVirhe("Summan pitää olla suurempi kuin 0.");
    if (!(korko >= 0)) return naytaVirhe("Korko ei voi olla negatiivinen.");
    if (!(kkMaksu > 0))
      return naytaVirhe("Kuukausilyhennyksen pitää olla suurempi kuin 0.");

    const id = muokkausId.value;
    if (id) {
      const laina = lainat.find((l) => l.id === id);
      if (laina) {
        laina.nimi = nimi;
        laina.saldo = saldo;
        laina.korko = korko;
        laina.kkMaksu = kkMaksu;
      }
    } else {
      lainat.push({
        id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
        nimi,
        saldo,
        korko,
        kkMaksu,
      });
    }

    tallennaLainat();
    nollaaLomake();
    piirraKaikki();
  });

  peruutaNappi.addEventListener("click", nollaaLomake);

  function nollaaLomake() {
    lomake.reset();
    muokkausId.value = "";
    lomakeOtsikko.textContent = "Lisää laina";
    tallennaNappi.textContent = "Lisää laina";
    peruutaNappi.classList.add("piilossa");
    piilotaVirhe();
  }

  function aloitaMuokkaus(id) {
    const laina = lainat.find((l) => l.id === id);
    if (!laina) return;
    muokkausId.value = laina.id;
    document.getElementById("nimi").value = laina.nimi;
    document.getElementById("saldo").value = laina.saldo;
    document.getElementById("korko").value = laina.korko;
    document.getElementById("kkmaksu").value = laina.kkMaksu;
    lomakeOtsikko.textContent = "Muokkaa lainaa";
    tallennaNappi.textContent = "Tallenna muutokset";
    peruutaNappi.classList.remove("piilossa");
    lomake.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function poistaLaina(id) {
    const laina = lainat.find((l) => l.id === id);
    if (!laina) return;
    if (!confirm(`Poistetaanko laina "${laina.nimi}"?`)) return;
    lainat = lainat.filter((l) => l.id !== id);
    tallennaLainat();
    if (muokkausId.value === id) nollaaLomake();
    piirraKaikki();
  }

  function naytaVirhe(teksti) {
    lomakeVirhe.textContent = teksti;
    lomakeVirhe.classList.remove("piilossa");
  }

  function piilotaVirhe() {
    lomakeVirhe.classList.add("piilossa");
  }

  // --- Piirto ---
  function piirraKaikki() {
    piirraLainalista();
    piirraYhteenveto();
    piirraSuunnitelma();
    piirraYhdistely();
    piirraTavoite();
  }

  function piirraLainalista() {
    lainalista.innerHTML = "";
    if (lainat.length === 0) {
      tyhjaTeksti.classList.remove("piilossa");
      return;
    }
    tyhjaTeksti.classList.add("piilossa");

    for (const laina of lainat) {
      const tulos = laskeLaina(laina.saldo, laina.korko, laina.kkMaksu);
      const rivi = document.createElement("div");
      rivi.className = "laina-rivi";

      let tiedotHtml;
      if (tulos.riittamaton) {
        tiedotHtml = `
          <div class="laina-tiedot">
            <span>Saldo: <span class="arvo">${euro(laina.saldo)}</span></span>
            <span>Korko: <span class="arvo">${laina.korko} %</span></span>
            <span>Lyhennys: <span class="arvo">${euro(laina.kkMaksu)}/kk</span></span>
          </div>
          <div class="laina-varoitus">
            ⚠️ Kuukausilyhennys ei kata edes korkoa — laina ei lyhene. Nosta lyhennystä.
          </div>`;
      } else {
        const pvm = maksuValmisPaiva(tulos.kuukaudet);
        const pvmTeksti = pvm
          ? pvm.toLocaleDateString("fi-FI", { year: "numeric", month: "long" })
          : "";
        tiedotHtml = `
          <div class="laina-tiedot">
            <span>Saldo: <span class="arvo">${euro(laina.saldo)}</span></span>
            <span>Korko: <span class="arvo">${laina.korko} %</span></span>
            <span>Lyhennys: <span class="arvo">${euro(laina.kkMaksu)}/kk</span></span>
            <span>Maksuaika: <span class="kesto">${muotoileKesto(
              tulos.kuukaudet
            )}</span> (${pvmTeksti})</span>
            <span>Korot yht: <span class="arvo">${euro(
              tulos.korotYhteensa
            )}</span></span>
          </div>`;
      }

      rivi.innerHTML = `
        <div class="laina-otsikko">${escapeHtml(laina.nimi)}</div>
        <div class="laina-napit">
          <button class="nappi toissijainen pieni" data-muokkaa="${laina.id}">Muokkaa</button>
          <button class="nappi toissijainen pieni vaara" data-poista="${laina.id}">Poista</button>
        </div>
        ${tiedotHtml}`;
      lainalista.appendChild(rivi);
    }

    lainalista.querySelectorAll("[data-muokkaa]").forEach((b) =>
      b.addEventListener("click", () => aloitaMuokkaus(b.dataset.muokkaa))
    );
    lainalista.querySelectorAll("[data-poista]").forEach((b) =>
      b.addEventListener("click", () => poistaLaina(b.dataset.poista))
    );
  }

  function piirraYhteenveto() {
    const kortti = document.getElementById("yhteenveto-kortti");
    if (lainat.length === 0) {
      kortti.classList.add("piilossa");
      return;
    }
    kortti.classList.remove("piilossa");

    const yhtVelka = lainat.reduce((s, l) => s + l.saldo, 0);
    const yhtKkMaksu = lainat.reduce((s, l) => s + l.kkMaksu, 0);

    let maxKuukaudet = 0;
    let yhtKorot = 0;
    let joku = false;
    for (const l of lainat) {
      const t = laskeLaina(l.saldo, l.korko, l.kkMaksu);
      if (t.riittamaton) {
        maxKuukaudet = Infinity;
        joku = true;
        continue;
      }
      yhtKorot += t.korotYhteensa;
      if (t.kuukaudet > maxKuukaudet) maxKuukaudet = t.kuukaudet;
    }

    document.getElementById("yht-velka").textContent = euro(yhtVelka);
    document.getElementById("yht-kkmaksu").textContent = euro(yhtKkMaksu) + "/kk";
    document.getElementById("yht-kesto").textContent =
      muotoileKesto(maxKuukaudet);
    document.getElementById("yht-korot").textContent = joku
      ? "–"
      : euro(yhtKorot);
  }

  function piirraSuunnitelma() {
    const kortti = document.getElementById("suunnitelma-kortti");
    const strategiatEl = document.getElementById("strategiat");
    const suositusEl = document.getElementById("suositus");

    if (lainat.length === 0) {
      kortti.classList.add("piilossa");
      document.getElementById("kaavio-kortti").classList.add("piilossa");
      return;
    }
    kortti.classList.remove("piilossa");

    const lisabudjetti = Math.max(0, parseFloat(lisabudjettiKentta.value) || 0);

    const lumivyory = simuloiStrategia(lainat, lisabudjetti, "lumivyory");
    const lumipallo = simuloiStrategia(lainat, lisabudjetti, "lumipallo");

    strategiatEl.innerHTML = "";

    // Riittämättömyys: näytä varoitus.
    if (lumivyory.riittamaton && lumipallo.riittamaton) {
      strategiatEl.innerHTML = `
        <div class="laina-varoitus" style="grid-column:1/-1">
          ⚠️ Nykyiset kuukausimaksut eivät riitä lyhentämään velkaa. Nosta
          lyhennyksiä tai lisää ylimääräistä budjettia.
        </div>`;
      document.getElementById("kohdennus").classList.add("piilossa");
      document.getElementById("kaavio-kortti").classList.add("piilossa");
      suositusEl.classList.add("piilossa");
      return;
    }

    // Kumpi säästää enemmän korkoja / on nopeampi?
    const parasStrategia =
      lumivyory.korotYhteensa <= lumipallo.korotYhteensa
        ? "lumivyory"
        : "lumipallo";
    parasStrategiaNyt = parasStrategia;

    strategiatEl.appendChild(
      luoStrategiaKortti(
        "🏔️ Velkalumivyöry",
        "Korkein korko ensin. Säästää yleensä eniten korkoja.",
        lumivyory,
        parasStrategia === "lumivyory"
      )
    );
    strategiatEl.appendChild(
      luoStrategiaKortti(
        "❄️ Velkalumipallo",
        "Pienin laina ensin. Motivoi nopeilla voitoilla.",
        lumipallo,
        parasStrategia === "lumipallo"
      )
    );

    // Näytä konkreettinen maksujen kohdennus parhaan strategian mukaan.
    piirraKohdennus(parasStrategia, lisabudjetti);

    // Piirrä velan kehitys -kuvaaja.
    piirraKaavio(parasStrategia, lisabudjetti);

    // Vertailu nykytahtiin (ilman lisäbudjettia, minimimaksut).
    const nyky = simuloiStrategia(lainat, 0, "lumivyory");
    naytaSuositus(
      suositusEl,
      parasStrategia === "lumivyory" ? lumivyory : lumipallo,
      parasStrategia,
      nyky,
      lisabudjetti
    );
  }

  function piirraKohdennus(strategia, lisabudjetti) {
    const el = document.getElementById("kohdennus");
    const avoimet = lainat.filter((l) => l.saldo > 0.005);
    if (avoimet.length === 0) {
      el.classList.add("piilossa");
      return;
    }

    // Kohdelaina strategian mukaan: korkein korko (lumivyöry) tai pienin saldo (lumipallo).
    const jarjestetty = [...avoimet].sort((a, b) =>
      strategia === "lumipallo" ? a.saldo - b.saldo : b.korko - a.korko
    );
    const kohde = jarjestetty[0];

    const strategiaNimi =
      strategia === "lumivyory" ? "velkalumivyöry" : "velkalumipallo";

    const otsikko =
      lisabudjetti > 0
        ? "Näin maksat ensi kuussa"
        : "Kuukausierät nyt";

    const selite =
      lisabudjetti > 0
        ? `Kaikkiin lainoihin maksat vähintään minimin. Ylimääräiset <strong>${euro(
            lisabudjetti
          )}</strong> ohjataan kokonaan lainaan, joka kannattaa maksaa ensin (${strategiaNimi}).`
        : `Maksat jokaiseen lainaan sen oman kuukausierän. Lisää ylimääräistä budjettia yltä, niin näet mihin lainaan se kannattaa ohjata.`;

    let riviHtml = "";
    let yhteensa = 0;
    for (const l of lainat) {
      if (l.saldo <= 0.005) continue;
      const onKohde = l.id === kohde.id;
      const uusiEra = onKohde ? l.kkMaksu + lisabudjetti : l.kkMaksu;
      yhteensa += uusiEra;

      const muuttui = onKohde && lisabudjetti > 0;
      const arvoHtml = muuttui
        ? `<span class="era-vanha">${euro(l.kkMaksu)}</span>
           <span class="era-nuoli">→</span>
           <span class="era-uusi">${euro(uusiEra)}</span>`
        : `<span class="era-uusi">${euro(uusiEra)}</span>`;

      riviHtml += `
        <div class="era-rivi ${onKohde ? "kohde" : ""}">
          <span class="era-nimi">${escapeHtml(l.nimi)}${
        onKohde
          ? '<span class="kohde-merkki">MAKSA ENSIN</span>'
          : ""
      }</span>
          <span>${arvoHtml}</span>
        </div>`;
    }

    const seuraavat = jarjestetty.slice(1).map((l) => escapeHtml(l.nimi));
    const seuraavaksiHtml =
      lisabudjetti > 0 && seuraavat.length > 0
        ? `<p class="seuraavaksi">💡 Kun <strong>${escapeHtml(
            kohde.nimi
          )}</strong> on maksettu, sen erä ja lisäbudjetti siirtyvät automaattisesti seuraavaan: ${seuraavat.join(
            " → "
          )}.</p>`
        : "";

    el.innerHTML = `
      <h3>${otsikko}</h3>
      <p class="selite">${selite}</p>
      ${riviHtml}
      <div class="era-yhteensa">
        <span>Yhteensä / kk</span>
        <span class="arvo">${euro(yhteensa)}</span>
      </div>
      ${seuraavaksiHtml}`;
    el.classList.remove("piilossa");
  }

  function luoStrategiaKortti(otsikko, selite, tulos, onParas) {
    const el = document.createElement("div");
    el.className = "strategia" + (onParas ? " paras" : "");

    const jarjestysHtml = tulos.jarjestys
      .map(
        (j) =>
          `<li>${escapeHtml(j.nimi)} — maksettu ${muotoileKesto(j.kuukausi)}</li>`
      )
      .join("");

    el.innerHTML = `
      <h3>${otsikko} ${onParas ? '<span class="paras-merkki">PARAS</span>' : ""}</h3>
      <p class="selite">${selite}</p>
      <div class="strategia-luku">
        <span>Velaton</span>
        <span class="arvo">${muotoileKesto(tulos.kuukaudet)}</span>
      </div>
      <div class="strategia-luku">
        <span>Korot yhteensä</span>
        <span class="arvo">${euro(tulos.korotYhteensa)}</span>
      </div>
      <div class="strategia-luku">
        <span>Maksettu yhteensä</span>
        <span class="arvo">${euro(tulos.maksettuYhteensa)}</span>
      </div>
      <div class="jarjestys">
        <strong>Maksujärjestys:</strong>
        <ol>${jarjestysHtml}</ol>
      </div>`;
    return el;
  }

  function naytaSuositus(el, paras, parasNimi, nyky, lisabudjetti) {
    const nimiTeksti =
      parasNimi === "lumivyory" ? "velkalumivyöry" : "velkalumipallo";

    let html = `<strong>Suositus:</strong> Käytä <strong>${nimiTeksti}</strong>-strategiaa. `;

    if (lisabudjetti > 0 && !nyky.riittamaton) {
      const kkSaasto = nyky.kuukaudet - paras.kuukaudet;
      const korkoSaasto = nyky.korotYhteensa - paras.korotYhteensa;
      if (kkSaasto > 0 || korkoSaasto > 0.5) {
        html += `Laittamalla <strong>${euro(
          lisabudjetti
        )}/kk</strong> ylimääräistä olet velaton `;
        html += `<strong>${muotoileKesto(kkSaasto)}</strong> aiemmin `;
        html += `ja säästät <strong>${euro(korkoSaasto)}</strong> korkoja.`;
      } else {
        html += `Maksat velat pois ${muotoileKesto(paras.kuukaudet)} kuluessa.`;
      }
    } else {
      html += `Lisää yllä ylimääräistä budjettia nähdäksesi, kuinka paljon nopeammin pääset velattomaksi.`;
    }

    el.innerHTML = html;
    el.classList.remove("piilossa");
  }

  // --- Yhdistelylaina ---
  function piirraYhdistely() {
    const kortti = document.getElementById("yhdistely-kortti");
    const tulosEl = document.getElementById("yhd-tulos");
    if (lainat.length === 0) {
      kortti.classList.add("piilossa");
      return;
    }
    kortti.classList.remove("piilossa");

    const korko = Math.max(0, parseFloat(document.getElementById("yhd-korko").value) || 0);
    const vuodet = Math.max(1, parseInt(document.getElementById("yhd-vuodet").value) || 1);
    const kuukaudet = vuodet * 12;

    const velka = lainat.reduce((s, l) => s + l.saldo, 0);
    const yhd = yhdistelyLaina(velka, korko, kuukaudet);

    // Nykytilanne realistisesti: lumivyöry pelkillä minimeillä.
    const nyky = simuloiStrategia(lainat, 0, "lumivyory");
    const nykyKorot = nyky.riittamaton ? Infinity : nyky.korotYhteensa;

    const korkoSaasto = nykyKorot - yhd.korotYhteensa;
    const nykyKkMaksu = lainat.reduce((s, l) => s + l.kkMaksu, 0);

    let huomio = "";
    if (isFinite(korkoSaasto) && korkoSaasto > 0) {
      huomio = `<p class="tulos-huomio hyva">✅ Näillä ehdoilla säästäisit noin <strong>${euro(
        korkoSaasto
      )}</strong> korkoja verrattuna nykyisten lainojen maksamiseen.</p>`;
    } else if (isFinite(korkoSaasto)) {
      huomio = `<p class="tulos-huomio varo">⚠️ Näillä ehdoilla yhdistely ei säästäisi korkoja. Kokeile matalampaa korkoa tai lyhyempää maksuaikaa.</p>`;
    }

    tulosEl.innerHTML = `
      <div class="tulos-otsikko">Yhdistelylaina (${euro(velka)} · ${korko} % · ${vuodet} v)</div>
      <div class="vertailu-rivi">
        <span>Kuukausierä</span>
        <span class="arvo">${euro(yhd.era)}/kk</span>
      </div>
      <div class="vertailu-rivi">
        <span>Korot yhteensä</span>
        <span class="arvo">${euro(yhd.korotYhteensa)}</span>
      </div>
      <div class="vertailu-rivi">
        <span>Maksettu yhteensä</span>
        <span class="arvo">${euro(yhd.maksettu)}</span>
      </div>
      <div class="tulos-otsikko">Nykytilanne vertailuksi</div>
      <div class="vertailu-rivi">
        <span>Kuukausimaksut nyt</span>
        <span class="arvo">${euro(nykyKkMaksu)}/kk</span>
      </div>
      <div class="vertailu-rivi">
        <span>Korot yhteensä (lumivyöry, minimit)</span>
        <span class="arvo">${isFinite(nykyKorot) ? euro(nykyKorot) : "–"}</span>
      </div>
      ${
        isFinite(korkoSaasto) && korkoSaasto > 0
          ? `<div class="vertailu-rivi korostettu">
               <span>Korkosäästö yhdistämällä</span>
               <span class="arvo">${euro(korkoSaasto)}</span>
             </div>`
          : ""
      }
      ${huomio}
      <p class="tulos-huomio">
        Huom: yhdistelylaina on arvio. Todellinen korko ja mahdolliset kulut
        selviävät vain pankin/rahoittajan tarjouksesta. Vertaa myös
        todellista vuosikorkoa (ei pelkkää nimelliskorkoa).
      </p>`;
  }

  // --- Tavoitepäivä ---
  function piirraTavoite() {
    const kortti = document.getElementById("tavoite-kortti");
    const tulosEl = document.getElementById("tavoite-tulos");
    if (lainat.length === 0) {
      kortti.classList.add("piilossa");
      return;
    }
    kortti.classList.remove("piilossa");

    const arvo = document.getElementById("tavoite-kk").value; // "YYYY-MM"
    if (!arvo) {
      tulosEl.innerHTML = `<p class="tulos-huomio">Valitse tavoitekuukausi yltä.</p>`;
      return;
    }

    const [vuosi, kk] = arvo.split("-").map(Number);
    const nyt = new Date();
    // Kuukausien määrä tästä hetkestä tavoitekuukauden loppuun.
    let kuukaudet =
      (vuosi - nyt.getFullYear()) * 12 + (kk - 1 - nyt.getMonth());

    if (kuukaudet < 1) {
      tulosEl.innerHTML = `<p class="tulos-huomio varo">⚠️ Valitse tulevaisuudessa oleva kuukausi.</p>`;
      return;
    }

    const tulos = laskeTavoiteBudjetti(lainat, kuukaudet);
    const nykyKkMaksu = lainat.reduce((s, l) => s + l.kkMaksu, 0);

    if (tulos.mahdoton) {
      tulosEl.innerHTML = `<p class="tulos-huomio varo">⚠️ Tavoite on liian tiukka laskurin rajoissa. Kokeile hieman myöhempää kuukautta.</p>`;
      return;
    }

    if (tulos.joEnnen) {
      tulosEl.innerHTML = `
        <p class="tulos-huomio hyva">
          ✅ Pääset velattomaksi jo nykyisillä maksuilla ${muotoileKesto(
            tulos.kuukaudet
          )} kuluessa — et tarvitse ylimääräistä tähän tavoitteeseen.
        </p>`;
      return;
    }

    const yhteensa = nykyKkMaksu + tulos.lisabudjetti;
    tulosEl.innerHTML = `
      <div class="tulos-otsikko">Tavoitteeseen (${kuukaudet} kk) tarvitset</div>
      <div class="vertailu-rivi">
        <span>Nykyiset minimimaksut</span>
        <span class="arvo">${euro(nykyKkMaksu)}/kk</span>
      </div>
      <div class="vertailu-rivi korostettu">
        <span>+ Ylimääräistä / kk</span>
        <span class="arvo">${euro(tulos.lisabudjetti)}</span>
      </div>
      <div class="vertailu-rivi">
        <span>Yhteensä / kk</span>
        <span class="arvo">${euro(yhteensa)}/kk</span>
      </div>
      <p class="tulos-huomio">
        Ylimääräinen ohjataan korkeimman koron lainaan (lumivyöry).
        <button type="button" class="nappi toissijainen pieni" id="kayta-tavoite">
          Käytä tämä ylimääräinen budjetti
        </button>
      </p>`;

    const nappi = document.getElementById("kayta-tavoite");
    if (nappi) {
      nappi.addEventListener("click", function () {
        lisabudjettiKentta.value = tulos.lisabudjetti;
        tallennaBudjetti(tulos.lisabudjetti);
        piirraSuunnitelma();
        document
          .getElementById("suunnitelma-kortti")
          .scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  // --- Velan kehitys -kuvaaja (Canvas) ---
  function piirraKaavio(strategia, lisabudjetti) {
    const kortti = document.getElementById("kaavio-kortti");
    const canvas = document.getElementById("velka-kaavio");
    const seliteEl = document.getElementById("kaavio-selite");
    if (lainat.length === 0) {
      kortti.classList.add("piilossa");
      return;
    }
    kortti.classList.remove("piilossa");

    const kanssa = simuloiStrategia(lainat, lisabudjetti, strategia);
    const minimit = simuloiStrategia(lainat, 0, strategia);
    if (kanssa.riittamaton) {
      kortti.classList.add("piilossa");
      return;
    }

    const velka = lainat.reduce((s, l) => s + l.saldo, 0);

    // Muodosta sarjat: kuukausi 0 = koko velka, sitten aikataulusta.
    function sarja(tulos) {
      const pisteet = [{ x: 0, y: velka }];
      for (const r of tulos.aikataulu) {
        pisteet.push({ x: r.kuukausi, y: r.jaljellaYhteensa });
      }
      return pisteet;
    }
    const sarjaKanssa = sarja(kanssa);
    const sarjaMinimit = minimit.riittamaton ? [] : sarja(minimit);

    const maxKk = Math.max(
      sarjaKanssa[sarjaKanssa.length - 1].x,
      sarjaMinimit.length ? sarjaMinimit[sarjaMinimit.length - 1].x : 0
    );
    const maxEur = velka;

    // Canvasin koko (high-DPI).
    const wrap = canvas.parentElement;
    const cssW = Math.max(wrap.clientWidth, 280);
    const cssH = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const pad = { left: 58, right: 14, top: 14, bottom: 28 };
    const plotW = cssW - pad.left - pad.right;
    const plotH = cssH - pad.top - pad.bottom;

    const teksti = "#94a3b8";
    const ruudukko = "rgba(148,163,184,0.15)";

    const xPos = (kk) => pad.left + (maxKk === 0 ? 0 : (kk / maxKk) * plotW);
    const yPos = (eur) => pad.top + (1 - eur / maxEur) * plotH;

    ctx.font = "11px -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "middle";

    // Vaakaviivat + euromerkinnät (0, 25, 50, 75, 100 %).
    ctx.strokeStyle = ruudukko;
    ctx.fillStyle = teksti;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const eur = (maxEur / 4) * i;
      const y = yPos(eur);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(cssW - pad.right, y);
      ctx.stroke();
      ctx.textAlign = "right";
      const label = eur >= 1000 ? Math.round(eur / 1000) + " t€" : "0 €";
      ctx.fillText(label, pad.left - 8, y);
    }

    // Vuosimerkinnät X-akselille.
    ctx.textAlign = "center";
    const vuosina = Math.ceil(maxKk / 12);
    const askel = vuosina > 12 ? 2 : 1;
    for (let v = 0; v <= vuosina; v += askel) {
      const kk = v * 12;
      if (kk > maxKk) break;
      const x = xPos(kk);
      ctx.fillText(v + " v", x, cssH - pad.bottom + 14);
    }

    // Piirrä sarja.
    function piirraViiva(pisteet, vari, katko, tayta) {
      if (pisteet.length === 0) return;
      if (tayta) {
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
        grad.addColorStop(0, "rgba(52,211,153,0.28)");
        grad.addColorStop(1, "rgba(52,211,153,0.02)");
        ctx.beginPath();
        ctx.moveTo(xPos(pisteet[0].x), yPos(pisteet[0].y));
        for (const p of pisteet) ctx.lineTo(xPos(p.x), yPos(p.y));
        ctx.lineTo(xPos(pisteet[pisteet.length - 1].x), yPos(0));
        ctx.lineTo(xPos(pisteet[0].x), yPos(0));
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.setLineDash(katko ? [5, 5] : []);
      ctx.strokeStyle = vari;
      ctx.lineWidth = 2.5;
      ctx.moveTo(xPos(pisteet[0].x), yPos(pisteet[0].y));
      for (const p of pisteet) ctx.lineTo(xPos(p.x), yPos(p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (sarjaMinimit.length) piirraViiva(sarjaMinimit, teksti, true, false);
    piirraViiva(sarjaKanssa, "#34d399", false, true);

    // Selite.
    const kkKesto = muotoileKesto(kanssa.kuukaudet);
    const minKesto = minimit.riittamaton
      ? "–"
      : muotoileKesto(minimit.kuukaudet);
    if (lisabudjetti > 0 && sarjaMinimit.length) {
      seliteEl.innerHTML = `
        <span class="merkki"><span class="viiva vihrea"></span> Lisäbudjetilla: velaton ${kkKesto}</span>
        <span class="merkki"><span class="viiva harmaa"></span> Pelkät minimit: velaton ${minKesto}</span>`;
    } else {
      seliteEl.innerHTML = `
        <span class="merkki"><span class="viiva vihrea"></span> Velaton ${kkKesto}. Lisää ylimääräistä budjettia nähdäksesi vertailun.</span>`;
    }
  }

  lisabudjettiKentta.addEventListener("input", function () {
    tallennaBudjetti(lisabudjettiKentta.value);
    piirraSuunnitelma();
  });

  // Työkalujen syötteet.
  ["yhd-korko", "yhd-vuodet"].forEach((id) =>
    document.getElementById(id).addEventListener("input", piirraYhdistely)
  );
  document
    .getElementById("tavoite-kk")
    .addEventListener("input", piirraTavoite);

  // Piirrä kuvaaja uudelleen ikkunan koon muuttuessa.
  let resizeAjastin = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeAjastin);
    resizeAjastin = setTimeout(function () {
      if (lainat.length > 0) {
        const lisa = Math.max(0, parseFloat(lisabudjettiKentta.value) || 0);
        piirraKaavio(parasStrategiaNyt, lisa);
      }
    }, 150);
  });

  // --- Apurit ---
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Alustus ---
  lisabudjettiKentta.value = lataaBudjetti();
  piirraKaikki();
})();
