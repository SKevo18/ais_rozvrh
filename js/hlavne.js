import { Rozvrh } from "./triedy.mjs";

/**
 * Vráti zoznam HTML súborov všetkých rozvrhov.
 *
 * @returns {Promise<string[]>}
 **/
async function vsetkySuboryRozvrhov() {
    let json = await (await fetch("/rozvrhy/zoznam.json")).json();
    let subory = json["subory"].map((subor) => "/rozvrhy/" + subor);

    return subory;
}

function najskorsiNajneskorsiElement(prvaPosledna) {
    const infoElement = document.createElement('div');

    const najskorsieDni = prvaPosledna.najskorsi.map(item => `${item.den} (${item.cas})`).join(', ');
    const najneskorsieDni = prvaPosledna.najneskorsi.map(item => `${item.den} (${item.cas})`).join(', ');

    infoElement.innerHTML = `
    <div id="info">
        <p><b>Najskorší začiatok:</b> ${najskorsieDni}</p>
        <p><b>Najneskorší koniec:</b> ${najneskorsieDni}</p>
    </div>
    `;
    return infoElement;
}

function dniSIbaNepovinnymi(dni) {
    const nepovinne = document.createElement('div');
    nepovinne.innerHTML = dni.join(', ');

    return nepovinne;
}

function tabulkaPrestavok(prestavkyData) {
    const tabulka = document.createElement('table');
    tabulka.innerHTML = `
        <thead>
            <tr>
                <th>Deň</th>
                <th>Začiatok prestávky</th>
                <th>Koniec prestávky</th>
                <th>Trvanie (minúty)</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;

    const tbody = tabulka.querySelector('tbody');

    for (const [den, prestavky] of Object.entries(prestavkyData)) {
        for (const prestavkyInfo of prestavky) {
            const riadok = document.createElement('tr');
            riadok.innerHTML = `
                <td>${den}</td>
                <td>${prestavkyInfo.zaciatok}</td>
                <td>${prestavkyInfo.koniec}</td>
                <td>${prestavkyInfo.dlzka}</td>
            `;
            tbody.appendChild(riadok);
        }
    }

    return tabulka;
}

function prepinacSkupiny(aktualnaSkupina) {
    const prepinac = document.createElement('input');
    prepinac.type = 'number';
    prepinac.id = prepinac.name = 'skupina';
    prepinac.style.marginLeft = "1rem";

    prepinac.value = aktualnaSkupina;
    prepinac.min = '0';
    prepinac.max = '8';

    prepinac.prepend('Skupina: ');

    prepinac.addEventListener('change', (event) => {
        window.location = `?s=${event.target.value}`;
    });

    return prepinac;
}

globalThis.window.addEventListener("load", async () => {
    const s = new URLSearchParams(window.location.search).get("s");
    const SKUPINA = (s !== null && s.length > 0 && s !== "0") ? parseInt(s) : null;

    const skup_element = document.getElementById("skupina");
    if (SKUPINA != null) {
        skup_element.innerHTML = `Skupina ${SKUPINA}`;
    } else {
        skup_element.innerHTML = "Všetky skupiny";
    }

    skup_element.append(prepinacSkupiny(s));

    let rozvrh = document.getElementById("rozvrh");
    let kombinovanyRozvrh = new Rozvrh();

    for (let subor of await vsetkySuboryRozvrhov()) {
        let htmlRozvrhu = await (await fetch(subor)).text();

        let rozvrhObjekt = new Rozvrh().zHtml(htmlRozvrhu);
        kombinovanyRozvrh.hodiny = kombinovanyRozvrh.hodiny.concat(rozvrhObjekt.hodiny);
        rozvrh.appendChild(rozvrhObjekt.tabulka(SKUPINA));
    }

    const prestavky = kombinovanyRozvrh.dlhePrestavky(SKUPINA);
    const prestavkyElement = tabulkaPrestavok(prestavky);
    const prestavkyDiv = document.createElement('div');
    const nepovinneDniInfo = document.createElement('div');

    prestavkyDiv.id = 'prestavky';
    prestavkyDiv.innerHTML = '<h3>Dlhé prestávky (> 30 minút):</h3>';
    prestavkyDiv.appendChild(prestavkyElement);

    const prvaPosledna = kombinovanyRozvrh.skoreADlheDni(SKUPINA);
    const infoElement = najskorsiNajneskorsiElement(prvaPosledna);
    prestavkyDiv.appendChild(infoElement);

    nepovinneDniInfo.id = 'nepovinne';
    nepovinneDniInfo.innerHTML = '<h3>Nepovinné dni:</h3>';
    const nepovinneDniData = dniSIbaNepovinnymi(kombinovanyRozvrh.ibaNepovinneDni(SKUPINA));
    nepovinneDniInfo.appendChild(nepovinneDniData);

    rozvrh.parentNode.append(prestavkyDiv);
    prestavkyDiv.append(nepovinneDniInfo);
});