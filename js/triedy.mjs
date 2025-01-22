const dni = {
    Po: "Pondelok",
    Ut: "Utorok",
    St: "Streda",
    Št: "Štvrtok",
    Pi: "Piatok",
    So: "Sobota",
    Ne: "Nedeľa",
};

const typy = {
    C: "rgba(200, 0, 0, 0.25)",
    S: "rgba(200, 255, 0, 0.25)",
};

class Hodina {
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
        /** @type {string} */
        this.den = den;

        /** @type {string} */
        this.cas = cas;

        /** @type {Number} */
        this.pocetHodin = pocetHodin;

        /** @type {string} */
        this.typ = typ;

        /** @type {string} */
        this.skratka = skratka;

        /** @type {string} */
        this.nazov = nazov;

        /** @type {string} */
        this.miestnost = miestnost;

        /** @type {string} */
        this.vyucujuci = vyucujuci;

        /** @type {string} */
        this.poznamka = poznamka;

        /** @type {string} */
        this.pravidelnost = pravidelnost;
    }

    /**
     * Vráti zoznam skupín, ktoré majú danú hodinu.
     *
     * @returns {number[]} Zoznam skupín. Prázdny, ak hodinu majú všetky skupiny.
     */
    get skupiny() {
        const regex = /(\d).\s+skupina/g;
        let skupiny = [];
        let match;

        while ((match = regex.exec(this.poznamka)) !== null) {
            const skupina = Number(match[1]);
            if (skupina !== 0) {
                skupiny.push(skupina);
            }
        }

        return skupiny;
    }

    /**
     * Vytvorí `Hodina` z HTML elementu.
     *
     * @param {HTMLTableRowElement} element HTML element, z ktorého sa má vytvoriť `Hodina`.
     *
     * @returns {Hodina} Vytvorená hodina.
     * @throws {Error} Ak sa nepodarí vytvoriť `Hodina`.
     * @throws {TypeError} Ak `element` nie je `HTMLTableRowElement`.
     **/
    zHtml(element) {
        if (!(element instanceof HTMLTableRowElement)) {
            throw new TypeError("element musí byť `HTMLTableRowElement`");
        }

        let bunky = element.querySelectorAll("td.cell:not(:first-child)");

        let den = bunky[0].innerText.trim();
        let cas = bunky[1].innerText.trim();
        let pocetHodin = bunky[2].innerText.trim();
        let typ = bunky[3].innerText.trim();
        let skratka = bunky[4].innerText.trim();
        let nazov = bunky[5].innerText.trim();
        let miestnost = bunky[6].innerText.trim();
        let vyucujuci = bunky[7].innerText.trim();
        let poznamka = bunky[8].innerText.trim();
        let pravidelnost = bunky[9].innerText.trim();

        return new Hodina(
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
        );
    }

    casZaciatku() {
        return this.cas.split('-')[0].trim();
    }

    casKonca() {
        const koniec = this.cas.split('-')[1];
        if (koniec !== undefined) return koniec.trim();

        return this.cas
    }
}

class Rozvrh {
    constructor(hodiny = []) {
        /** @type {Hodina[]} */
        this.hodiny = hodiny;
    }

    /**
     * Pretransformuje HTML tabuľky rozvrhu do JS objektov.
     *
     * @param {string} element HTML tabuľky rozvrhu
     * @returns {Rozvrh} Rozvrh
     **/
    zHtml(html) {
        let rozvrh = new Rozvrh();
        let tabulkaElement = document.createElement("table");
        tabulkaElement.innerHTML = html;

        for (let riadok of tabulkaElement.querySelectorAll(
            "tbody tr:not(:first-child)"
        )) {
            let hodina = new Hodina().zHtml(riadok);
            rozvrh.hodiny.push(hodina);
        }

        return rozvrh;
    }

    /**
     * Vráti HTML element tabuľky rozvrhu hodín.
     *
     * @returns {HTMLTableElement}
     **/
    tabulka(skupina = null) {
        let tabulka = document.createElement("table");

        let hlavicka = document.createElement("tr");
        hlavicka.innerHTML = `
            <th>Deň</th>
            <th>Pravidelnosť</th>
            <th>Čas</th>
            <th>Predmet</th>
            <th>Typ</th>
            <th>Skupiny</th>
        `;
        tabulka.appendChild(hlavicka);

        var hodiny = this.filtrujPodlaSkupiny(skupina);

        hodiny.sort((a, b) => {
            const dniPoradie = Object.keys(dni);
            const denRozdiel = dniPoradie.indexOf(a.den) - dniPoradie.indexOf(b.den);
            if (denRozdiel !== 0) return denRozdiel;
            return this.porovnajCasy(a.casZaciatku(), b.casZaciatku());
        });

        for (const hodina of hodiny) {
            const riadok = document.createElement("tr");
            riadok.style.backgroundColor = typy[hodina.typ];
            riadok.innerHTML = `
                <td>${dni[hodina.den]}</td>
                <td ${hodina.pravidelnost !== "TYZ" && 'style="border: 6px double green"'}>${hodina.pravidelnost}</td>
                <td>${hodina.cas}</td>
                <td>${hodina.nazov}</td>
                <td>${hodina.typ}</td>
                <td>${hodina.skupiny.join(", ")}</td>
            `;

            tabulka.appendChild(riadok);
        }

        return tabulka;
    }

    filtrujPodlaSkupiny(skupina) {
        if (skupina !== null) {
            return this.hodiny.filter(
                (hodina) => hodina.skupiny.includes(skupina) || hodina.skupiny.length == 0
            );
        } else {
            return this.hodiny;
        }
    }

    skoreADlheDni(skupina = null) {
        let filtrovaneHodiny = skupina !== null
            ? this.hodiny.filter(h => h.skupiny.includes(skupina) || h.skupiny.length === 0)
            : this.hodiny;

        let najskorsieCasy = {};
        let najneskorsieCasy = {};
        let najskorsiCas = '23:59';
        let najneskorsiCas = '00:00';

        for (const hodina of filtrovaneHodiny) {
            const zaciatok = hodina.casZaciatku();
            const koniec = hodina.casKonca();

            if (zaciatok <= najskorsiCas) {
                if (zaciatok < najskorsiCas) {
                    najskorsieCasy = {};
                    najskorsiCas = zaciatok;
                }
                if (!najskorsieCasy[hodina.den]) {
                    najskorsieCasy[hodina.den] = zaciatok;
                }
            }

            if (koniec >= najneskorsiCas) {
                if (koniec > najneskorsiCas) {
                    najneskorsieCasy = {};
                    najneskorsiCas = koniec;
                }
                if (!najneskorsieCasy[hodina.den]) {
                    najneskorsieCasy[hodina.den] = koniec;
                }
            }
        }

        return {
            najskorsi: Object.entries(najskorsieCasy).map(([den, cas]) => ({ den: dni[den], cas })),
            najneskorsi: Object.entries(najneskorsieCasy).map(([den, cas]) => ({ den: dni[den], cas }))
        };
    }

    dlhePrestavky(skupina = null, minDlzkaPrestavky = 30) {
        let filtrovaneHodiny = skupina !== null
            ? this.hodiny.filter(h => h.skupiny.includes(skupina) || h.skupiny.length === 0)
            : this.hodiny;

        let prestavky = {};

        for (const den of Object.keys(dni)) {
            let hodinyDna = filtrovaneHodiny.filter(h => h.den === den)
                .sort((a, b) => this.porovnajCasy(a.casZaciatku(), b.casZaciatku()));

            prestavky[den] = [];

            for (let i = 0; i < hodinyDna.length - 1; i++) {
                const aktualnaKonci = hodinyDna[i].casKonca();
                const dalsiaZacina = hodinyDna[i + 1].casZaciatku();
                const dlzkaPrestavky = this.rozdielVMinutach(aktualnaKonci, dalsiaZacina);

                if (dlzkaPrestavky > minDlzkaPrestavky) {
                    prestavky[den].push({
                        zaciatok: aktualnaKonci,
                        koniec: dalsiaZacina,
                        dlzka: dlzkaPrestavky
                    });
                }
            }
        }

        return prestavky;
    }

    ibaNepovinneDni(skupina = null) {
        const filtrovaneHodiny = skupina !== null
            ? this.hodiny.filter(h => h.skupiny.includes(skupina) || h.skupiny.length === 0)
            : this.hodiny;
        const povinnePocty = {};

        for (const hodina of filtrovaneHodiny) {
            if (!povinnePocty[hodina.den]) {
                povinnePocty[hodina.den] = 0;
            }

            if (hodina.typ !== "P") {
                povinnePocty[hodina.den] += 1;
            }
        }

        const nepovinneDni = Object.keys(povinnePocty).filter(den => povinnePocty[den] === 0);
        return nepovinneDni;
    }

    porovnajCasy(cas1, cas2) {
        const [hodiny1, minuty1] = cas1.split(':').map(Number);
        const [hodiny2, minuty2] = cas2.split(':').map(Number);

        if (hodiny1 !== hodiny2) {
            return hodiny1 - hodiny2;
        }
        return minuty1 - minuty2;
    }

    rozdielVMinutach(cas1, cas2) {
        const [hodiny1, minuty1] = cas1.split(':').map(Number);
        const [hodiny2, minuty2] = cas2.split(':').map(Number);

        const celkoveMinuty1 = hodiny1 * 60 + minuty1;
        const celkoveMinuty2 = hodiny2 * 60 + minuty2;

        return celkoveMinuty2 - celkoveMinuty1;
    }
}

export { Rozvrh, typy, dni };