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
    C: "Cvičenia",
    P: "Prednášky",
    S: "Semináre",
};

class Cas {
    constructor(zaciatok, koniec) {
        /** @type {string} */
        this.zaciatok = zaciatok;

        /** @type {string} */
        this.koniec = koniec;
    }
}

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

        //let _cas = cas.split("-");
        /** @type {string} */
        //this.cas = Cas(_cas[0], _cas[1]);
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
        let skupiny = [];

        for (let i = 0; i < this.poznamka.length; i++) {
            if (!isNaN(this.poznamka[i])) {
                let skupina = Number(this.poznamka[i])
                if (skupina == 0) continue

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

        let den = bunky[0].innerText;
        let cas = bunky[1].innerText;
        let pocetHodin = bunky[2].innerText;
        let typ = typy[bunky[3].innerText];
        let skratka = bunky[4].innerText;
        let nazov = bunky[5].innerText.trim();
        let miestnost = bunky[6].innerText;
        let vyucujuci = bunky[7].innerText;
        let poznamka = bunky[8].innerText;
        let pravidelnost = bunky[9].innerText;

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
        console.log(tabulkaElement);

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
    tabulka(skupina=null) {
        let tabulka = document.createElement("table");

        let hlavicka = document.createElement("tr");
        hlavicka.innerHTML = `
            <th>Čas</th>
            <th>Deň</th>
            <th>Predmet</th>
            <th>Skupiny</th>
        `;
        tabulka.appendChild(hlavicka);

        if (skupina !== null) {
            var hodiny = this.hodiny.filter(
                (hodina) => hodina.skupiny.includes(skupina) || hodina.skupiny.length == 0
            );
        } else {
            var hodiny = this.hodiny;
        }

        for (const hodina of hodiny) {
            const riadok = document.createElement("tr");
            riadok.innerHTML = `
                <td>${hodina.cas}</td>
                <td>${dni[hodina.den]}</td>
                <td>${hodina.nazov}</td>
                <td>${hodina.skupiny.join(", ")}</td>
            `;
            tabulka.appendChild(riadok);
        }

        return tabulka;
    }
}

export { Rozvrh };
