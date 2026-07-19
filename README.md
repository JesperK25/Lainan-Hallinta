# 💶 Lainanhallinta

Yksinkertainen selainpohjainen sovellus omien lainojen hallintaan. Lisää
lainasi, korot ja kuukausilyhennykset — sovellus laskee, milloin olet velaton
ja tekee suunnitelman velkojen nopeaan takaisinmaksuun.

## Ominaisuudet

- **Lainojen hallinta** — lisää, muokkaa ja poista lainoja (nimi, jäljellä oleva
  summa, vuosikorko, kuukausilyhennys).
- **Maksuaika-arvio** — jokaiselle lainalle lasketaan, kauanko takaisinmaksuun
  menee ja paljonko korkoja kertyy.
- **Yhteenveto** — kokonaisvelka, kuukausimaksut, arvioitu velaton-hetki ja
  korot yhteensä.
- **Takaisinmaksusuunnitelma** — vertailee kahta strategiaa, kun kohdennat
  ylimääräistä budjettia lyhennyksiin:
  - 🏔️ **Velkalumivyöry** — maksa korkein korko ensin (säästää eniten korkoja).
  - ❄️ **Velkalumipallo** — maksa pienin laina ensin (motivoi nopeilla voitoilla).
- **Suositus** — kertoo kumpi strategia on edullisempi ja kuinka paljon aikaa ja
  rahaa säästät.
- **Tiedot tallentuvat** selaimen `localStorage`-muistiin — mitään ei lähetetä
  minnekään.

## Käyttö

Avaa `index.html` selaimessa. Ei asennuksia eikä palvelinta.

```
# tai käynnistä kevyt paikallinen palvelin:
python3 -m http.server 8000
# ja avaa http://localhost:8000
```

## Rakenne

```
index.html          Käyttöliittymän runko
css/tyyli.css       Ulkoasu
js/laskenta.js      Lainalaskennan funktiot (myös Node-yhteensopiva testejä varten)
js/sovellus.js      Käyttöliittymän logiikka + tallennus
```

## Laskennasta

- Korko lasketaan kuukausittain vuosikorosta (`vuosikorko / 12`).
- Kuukausimaksusta vähennetään ensin korko, loput lyhentää pääomaa (annuiteetti).
- Strategiasimulaatiossa kaikille lainoille maksetaan aina vähintään oma
  kk-maksu; ylimääräinen budjetti ja pois maksettujen lainojen vapautuvat maksut
  ohjataan strategian mukaan seuraavaan kohdelainaan.

Laskelmat ovat arvioita. Todelliset lyhennykset voivat poiketa pankin ehdoista
(esim. koron määräytyminen, kulut, koronmuutokset).
