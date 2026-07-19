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

- **Koron tyyppi** valitaan yläpalkista:
  - *Todellinen vuosikorko (TVK)* — efektiivinen korko, kuukausikorko
    `(1 + korko)^(1/12) − 1`. Sisältää lainan kulut jo, joten erillinen
    kulukenttä on tässä tilassa pois käytöstä.
  - *Nimelliskorko* — kuukausikorko `korko / 12`, ja lainakohtaiset
    kuukausikulut (esim. tilinhoitomaksu) huomioidaan erikseen.
- Kuukausierästä vähennetään ensin korko ja kulut, loppu lyhentää pääomaa.
- Strategiasimulaatiossa kaikille lainoille maksetaan aina vähintään oma
  kk-maksu; ylimääräinen budjetti ja pois maksettujen lainojen vapautuvat maksut
  ohjataan strategian mukaan seuraavaan kohdelainaan.

Laskelmat ovat arvioita. Todelliset lyhennykset voivat poiketa pankin ehdoista
(esim. koron määräytyminen, kulut, koronmuutokset).
