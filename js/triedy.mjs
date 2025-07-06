// Slovenské názvy dní v týždni
const dni = {
    Po: "Pondelok",
    Ut: "Utorok",
    St: "Streda",
    Št: "Štvrtok",
    Pi: "Piatok",
    So: "Sobota",
    Ne: "Nedeľa",
};

// Farby typov hodín
const typy = {
    C: "rgba(200, 0, 0, 0.25)", // Cvičenie - červená
    S: "rgba(200, 255, 0, 0.25)", // Seminár - žltá
    P: "rgba(0, 200, 255, 0.25)", // Prednáška - modrá
};

/**
 * Reprezentuje jednu hodinu v rozvrhu.
 */
class Hodina {
    /**
     * @param {string} den Deň v týždni (Po, Ut, St, Št, Pi)
     * @param {string} cas Časový interval (napr. "08:45-10:15")
     * @param {number} pocetHodin Počet hodín
     * @param {string} typ Typ hodiny (C, S, P)
     * @param {string} skratka Skratka predmetu
     * @param {string} nazov Názov predmetu
     * @param {string} miestnost Miestnosť
     * @param {string} vyucujuci Vyučujúci
     * @param {string} poznamka Poznámka (obsahuje info o skupinách)
     * @param {string} pravidelnost Pravidelnosť (TYZ, N.T, P.T, BLK)
     */
    constructor(
        den,
        cas,
        pocetHodin,
        typ,
        skratka,
        nazov,
        miestnost,
        vyucujuci,
        poznamka,
        pravidelnost
    ) {
        this.den = String(den).trim();
        this.cas = String(cas).trim();
        this.pocetHodin = Number(pocetHodin) || 0;
        this.typ = String(typ).trim();
        this.skratka = String(skratka).trim();
        this.nazov = String(nazov).trim();
        this.miestnost = String(miestnost).trim();
        this.vyucujuci = String(vyucujuci).trim();
        this.poznamka = String(poznamka).trim();
        this.pravidelnost = String(pravidelnost).trim();

        // Validácia
        if (!this.den || !Object.keys(dni).includes(this.den)) {
            throw new Error(`Neplatný deň: ${this.den}`);
        }
        if (!this.cas || !this._validujCasovyFormat(this.cas)) {
            throw new Error(`Neplatný časový formát: ${this.cas}`);
        }
    }

    /**
     * Validuje formát času.
     * @param {string} cas
     * @returns {boolean}
     * @private
     */
    _validujCasovyFormat(cas) {
        // Podporuje formáty: "08:45-10:15", "08:45", "09:15"
        const formatPattern = /^(\d{1,2}:\d{2})(-\d{1,2}:\d{2})?$/;
        return formatPattern.test(cas);
    }

    /**
     * Vráti zoznam skupín, ktoré majú danú hodinu.
     * @returns {number[]} Zoznam skupín. Prázdny, ak hodinu majú všetky skupiny.
     */
    get skupiny() {
        if (!this.poznamka) return [];

        // Zlepšený regex pre skupiny - podporuje rôzne formáty
        const regexPatterns = [
            /(\d+)\.\s*skupina/gi,
            /(\d+)\s*a\s*(\d+)\.\s*skupina/gi,
            /skupina\s*(\d+)/gi
        ];

        const skupiny = new Set();

        for (const regex of regexPatterns) {
            let match;
            while ((match = regex.exec(this.poznamka)) !== null) {
                // Pridaj všetky zachytené čísla skupín
                for (let i = 1; i < match.length; i++) {
                    if (match[i] && !isNaN(match[i])) {
                        const skupina = Number(match[i]);
                        if (skupina > 0 && skupina <= 10) { // Rozumný rozsah skupín
                            skupiny.add(skupina);
                        }
                    }
                }
            }
        }

        return Array.from(skupiny).sort((a, b) => a - b);
    }

    /**
     * Vytvorí `Hodina` z HTML elementu.
     * @param {HTMLTableRowElement} element HTML element
     * @returns {Hodina} Vytvorená hodina
     * @throws {Error} Ak sa nepodarí vytvoriť hodinu
     * @static
     */
    static zHtml(element) {
        if (!(element instanceof HTMLTableRowElement)) {
            throw new TypeError("Element musí byť HTMLTableRowElement");
        }

        const bunky = element.querySelectorAll("td.cell:not(:first-child)");

        if (bunky.length < 10) {
            throw new Error(`Nedostatočný počet buniek: ${bunky.length}, očakávaných: 10`);
        }

        try {
            return new Hodina(
                bunky[0]?.innerText?.trim() || "",
                bunky[1]?.innerText?.trim() || "",
                bunky[2]?.innerText?.trim() || "0",
                bunky[3]?.innerText?.trim() || "",
                bunky[4]?.innerText?.trim() || "",
                bunky[5]?.innerText?.trim() || "",
                bunky[6]?.innerText?.trim() || "",
                bunky[7]?.innerText?.trim() || "",
                bunky[8]?.innerText?.trim() || "",
                bunky[9]?.innerText?.trim() || ""
            );
        } catch (error) {
            throw new Error(`Chyba pri vytváraní hodiny z HTML: ${error.message}`);
        }
    }

    /**
     * Vráti čas začiatku hodiny.
     * @returns {string}
     */
    casZaciatku() {
        const cas = this.cas.split('-')[0]?.trim();
        return cas || this.cas;
    }

    /**
     * Vráti čas konca hodiny.
     * @returns {string}
     */
    casKonca() {
        const casti = this.cas.split('-');
        if (casti.length > 1) {
            return casti[1].trim();
        }

        // Ak nie je koniec, pridaj 90 minút k začiatku (typická dĺžka hodiny)
        const zaciatok = this.casZaciatku();
        const [hodiny, minuty] = zaciatok.split(':').map(Number);
        const celkoveMinuty = hodiny * 60 + minuty + 90;
        const novHodiny = Math.floor(celkoveMinuty / 60);
        const novMinuty = celkoveMinuty % 60;

        return `${novHodiny.toString().padStart(2, '0')}:${novMinuty.toString().padStart(2, '0')}`;
    }

    /**
     * Vráti dĺžku hodiny v minútach.
     * @returns {number}
     */
    get dlzkaVMinutach() {
        const zaciatok = this.casZaciatku();
        const koniec = this.casKonca();
        return this._rozdielVMinutach(zaciatok, koniec);
    }

    /**
     * Vypočíta rozdiel medzi dvoma časmi v minútach.
     * @param {string} cas1 
     * @param {string} cas2 
     * @returns {number}
     * @private
     */
    _rozdielVMinutach(cas1, cas2) {
        const [h1, m1] = cas1.split(':').map(Number);
        const [h2, m2] = cas2.split(':').map(Number);

        const celkoveMinuty1 = h1 * 60 + m1;
        const celkoveMinuty2 = h2 * 60 + m2;

        return celkoveMinuty2 - celkoveMinuty1;
    }
}

/**
 * Reprezentuje celý rozvrh hodín.
 */
class Rozvrh {
    /**
     * @param {Hodina[]} hodiny Zoznam hodín
     */
    constructor(hodiny = []) {
        if (!Array.isArray(hodiny)) {
            throw new TypeError("Hodiny musia byť pole");
        }
        this.hodiny = hodiny;
        this._cache = new Map(); // Cache pre často používané výpočty
    }

    /**
     * Vytvorí rozvrh z HTML reťazca.
     * @param {string} html HTML obsah tabuľky rozvrhu
     * @returns {Rozvrh} Nový rozvrh
     * @static
     */
    static zHtml(html) {
        if (!html || typeof html !== 'string') {
            throw new Error("HTML obsah musí byť neprázdny reťazec");
        }

        const rozvrh = new Rozvrh();
        const tabulkaElement = document.createElement("table");
        tabulkaElement.innerHTML = html;

        const riadky = tabulkaElement.querySelectorAll("tbody tr:not(:first-child)");

        for (const riadok of riadky) {
            try {
                const hodina = Hodina.zHtml(riadok);
                rozvrh.hodiny.push(hodina);
            } catch (error) {
                console.warn(`Preskakujem riadok kvôli chybe: ${error.message}`);
                // Pokračuj s ďalšími riadkami
            }
        }

        return rozvrh;
    }

    /**
     * Vráti HTML element tabuľky rozvrhu hodín.
     * @param {number|null} skupina Číslo skupiny pre filtrovanie
     * @returns {HTMLTableElement}
     */
    tabulka(skupina = null) {
        const cacheKey = `tabulka_${skupina}`;
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey).cloneNode(true);
        }

        const tabulka = document.createElement("table");
        tabulka.className = "rozvrh-tabulka";

        // Hlavička
        const hlavicka = document.createElement("thead");
        hlavicka.innerHTML = `
            <tr>
                <th>Deň</th>
                <th>Pravidelnosť</th>
                <th>Čas</th>
                <th>Predmet</th>
                <th>Typ</th>
                <th>Miestnosť</th>
                <th>Vyučujúci</th>
                <th>Skupiny</th>
            </tr>
        `;
        tabulka.appendChild(hlavicka);

        const tbody = document.createElement("tbody");
        const hodiny = this.filtrujPodlaSkupiny(skupina);

        // Zoradenie
        hodiny.sort((a, b) => {
            const dniPoradie = Object.keys(dni);
            const denRozdiel = dniPoradie.indexOf(a.den) - dniPoradie.indexOf(b.den);
            if (denRozdiel !== 0) return denRozdiel;
            return this._porovnajCasy(a.casZaciatku(), b.casZaciatku());
        });

        hodiny.forEach(hodina => {
            const riadok = document.createElement("tr");
            riadok.className = `hodina-riadok typ-${hodina.typ.toLowerCase()}`;

            if (typy[hodina.typ]) {
                riadok.style.backgroundColor = typy[hodina.typ];
            }

            const pravidelnostCell = hodina.pravidelnost !== "TYZ"
                ? `<td class="pravidelnost-special">${hodina.pravidelnost}</td>`
                : `<td>${hodina.pravidelnost}</td>`;

            riadok.innerHTML = `
                <td class="den">${dni[hodina.den]}</td>
                ${pravidelnostCell}
                <td class="cas">${hodina.cas}</td>
                <td class="predmet" title="${hodina.nazov}">${hodina.nazov}</td>
                <td class="typ">${hodina.typ}</td>
                <td class="miestnost">${hodina.miestnost}</td>
                <td class="vyucujuci">${hodina.vyucujuci}</td>
                <td class="skupiny">${hodina.skupiny.join(", ") || "Všetky"}</td>
            `;

            tbody.appendChild(riadok);
        });

        tabulka.appendChild(tbody);

        // Uloženie do cache
        this._cache.set(cacheKey, tabulka.cloneNode(true));

        return tabulka;
    }

    /**
     * Filtruje hodiny podľa skupiny.
     * @param {number|null} skupina 
     * @returns {Hodina[]}
     */
    filtrujPodlaSkupiny(skupina) {
        if (skupina === null || skupina === undefined) {
            return [...this.hodiny];
        }

        return this.hodiny.filter(hodina => {
            // Defensive programming - ensure skupiny is always an array
            const skupinyHodiny = hodina.skupiny || [];
            return skupinyHodiny.length === 0 || skupinyHodiny.includes(skupina);
        });
    }

    /**
     * Vráti informácie o najskorších a najneskorších časoch.
     * @param {number|null} skupina 
     * @returns {Object}
     */
    skoreADlheDni(skupina = null) {
        const cacheKey = `skore_dlhe_${skupina}`;
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        const filtrovaneHodiny = this.filtrujPodlaSkupiny(skupina);

        if (filtrovaneHodiny.length === 0) {
            return { najskorsi: [], najneskorsi: [] };
        }

        let najskorsieCasy = {};
        let najneskorsieCasy = {};
        let globalNajskorsi = '23:59';
        let globalNajneskorsi = '00:00';

        filtrovaneHodiny.forEach(hodina => {
            const zaciatok = hodina.casZaciatku();
            const koniec = hodina.casKonca();

            // Najskorší čas
            if (this._porovnajCasy(zaciatok, globalNajskorsi) <= 0) {
                if (this._porovnajCasy(zaciatok, globalNajskorsi) < 0) {
                    najskorsieCasy = {};
                    globalNajskorsi = zaciatok;
                }
                if (!najskorsieCasy[hodina.den]) {
                    najskorsieCasy[hodina.den] = zaciatok;
                }
            }

            // Najneskorší čas
            if (this._porovnajCasy(koniec, globalNajneskorsi) >= 0) {
                if (this._porovnajCasy(koniec, globalNajneskorsi) > 0) {
                    najneskorsieCasy = {};
                    globalNajneskorsi = koniec;
                }
                if (!najneskorsieCasy[hodina.den]) {
                    najneskorsieCasy[hodina.den] = koniec;
                }
            }
        });

        const vysledok = {
            najskorsi: Object.entries(najskorsieCasy).map(([den, cas]) => ({
                den: dni[den],
                cas
            })),
            najneskorsi: Object.entries(najneskorsieCasy).map(([den, cas]) => ({
                den: dni[den],
                cas
            }))
        };

        this._cache.set(cacheKey, vysledok);
        return vysledok;
    }

    /**
     * Vráti dlhé prestávky v rozvrhu.
     * @param {number|null} skupina 
     * @param {number} minDlzkaPrestavky Minimálna dĺžka prestávky v minútach
     * @returns {Object}
     */
    dlhePrestavky(skupina = null, minDlzkaPrestavky = 30) {
        const cacheKey = `prestavky_${skupina}_${minDlzkaPrestavky}`;
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        const filtrovaneHodiny = this.filtrujPodlaSkupiny(skupina);
        const prestavky = {};

        Object.keys(dni).forEach(den => {
            const hodinyDna = filtrovaneHodiny
                .filter(h => h.den === den)
                .sort((a, b) => this._porovnajCasy(a.casZaciatku(), b.casZaciatku()));

            prestavky[dni[den]] = [];

            for (let i = 0; i < hodinyDna.length - 1; i++) {
                const aktualnaKonci = hodinyDna[i].casKonca();
                const dalsiaZacina = hodinyDna[i + 1].casZaciatku();
                const dlzkaPrestavky = this._rozdielVMinutach(aktualnaKonci, dalsiaZacina);

                if (dlzkaPrestavky >= minDlzkaPrestavky) {
                    prestavky[dni[den]].push({
                        zaciatok: aktualnaKonci,
                        koniec: dalsiaZacina,
                        dlzka: dlzkaPrestavky,
                        formatovanaDlzka: this._formatujDlzku(dlzkaPrestavky)
                    });
                }
            }
        });

        this._cache.set(cacheKey, prestavky);
        return prestavky;
    }

    /**
     * Vráti dni, ktoré obsahujú len nepovinné predmety.
     * @param {number|null} skupina 
     * @returns {string[]}
     */
    ibaNepovinneDni(skupina = null) {
        const filtrovaneHodiny = this.filtrujPodlaSkupiny(skupina);
        const povinnePocty = {};

        filtrovaneHodiny.forEach(hodina => {
            if (!povinnePocty[hodina.den]) {
                povinnePocty[hodina.den] = 0;
            }

            if (hodina.typ !== "P") {
                povinnePocty[hodina.den] += 1;
            }
        });

        return Object.keys(povinnePocty)
            .filter(den => povinnePocty[den] === 0)
            .map(den => dni[den]);
    }

    /**
     * Vymaže cache pre výkonnostné optimalizácie.
     */
    vycistiCache() {
        this._cache.clear();
    }

    /**
     * Porovná dva časy.
     * @param {string} cas1 
     * @param {string} cas2 
     * @returns {number} -1, 0, alebo 1
     * @private
     */
    _porovnajCasy(cas1, cas2) {
        const [hodiny1, minuty1] = cas1.split(':').map(Number);
        const [hodiny2, minuty2] = cas2.split(':').map(Number);

        const celkoveMinuty1 = hodiny1 * 60 + minuty1;
        const celkoveMinuty2 = hodiny2 * 60 + minuty2;

        return celkoveMinuty1 - celkoveMinuty2;
    }

    /**
     * Vypočíta rozdiel medzi dvoma časmi v minútach.
     * @param {string} cas1 
     * @param {string} cas2 
     * @returns {number}
     * @private
     */
    _rozdielVMinutach(cas1, cas2) {
        return Math.abs(this._porovnajCasy(cas1, cas2));
    }

    /**
     * Formatuje dĺžku v minútach na čitateľný formát.
     * @param {number} minuty 
     * @returns {string}
     * @private
     */
    _formatujDlzku(minuty) {
        const hodiny = Math.floor(minuty / 60);
        const zvysokMinuty = minuty % 60;

        if (hodiny === 0) {
            return `${zvysokMinuty} min`;
        } else if (zvysokMinuty === 0) {
            return `${hodiny} h`;
        } else {
            return `${hodiny} h ${zvysokMinuty} min`;
        }
    }
}

// Export všetkých tried a konštánt
export { Rozvrh, Hodina, typy, dni };