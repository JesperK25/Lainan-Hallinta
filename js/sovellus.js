/*
 * sovellus.js — Käyttöliittymän logiikka.
 * Käyttää laskenta.js:n funktioita ja tallentaa tiedot localStorageen.
 */

(function () {
  "use strict";

  const TALLENNUSAVAIN = "lainanhallinta.lainat.v1";
  const BUDJETTIAVAIN = "lainanhallinta.lisabudjetti.v1";

  let lainat = lataaLainat();

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
      suositusEl.classList.add("piilossa");
      return;
    }

    // Kumpi säästää enemmän korkoja / on nopeampi?
    const parasStrategia =
      lumivyory.korotYhteensa <= lumipallo.korotYhteensa
        ? "lumivyory"
        : "lumipallo";

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

  lisabudjettiKentta.addEventListener("input", function () {
    tallennaBudjetti(lisabudjettiKentta.value);
    piirraSuunnitelma();
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
