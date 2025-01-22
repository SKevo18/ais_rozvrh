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

function vytvorInfoElement(nadpis, obsah) {
    const element = document.createElement('div');
    element.innerHTML = `
        <h3>${nadpis}</h3>
        <p>${obsah}</p>
    `;
    return element;
}

function tabulkaPrestavok(prestavkyData) {
    const riadky = Object.entries(prestavkyData).flatMap(([den, prestavky]) =>
        prestavky.map(p => `
            <tr>
                <td>${den}</td>
                <td>${p.zaciatok}</td>
                <td>${p.koniec}</td>
                <td>${p.dlzka}</td>
            </tr>
        `)
    ).join('');

    return `
        <table>
            <thead>
                <tr>
                    <th>Deň</th>
                    <th>Začiatok prestávky</th>
                    <th>Koniec prestávky</th>
                    <th>Trvanie (minúty)</th>
                </tr>
            </thead>
            <tbody>
                ${riadky}
            </tbody>
        </table>
    `;
}

function prepinacSkupiny(aktualnaSkupina) {
    const prepinac = document.createElement('input');
    Object.assign(prepinac, {
        type: 'number',
        id: 'skupina',
        name: 'skupina',
        value: aktualnaSkupina || 0,
        min: '0',
        max: '7',
    });
    prepinac.style.marginLeft = '1rem';

    prepinac.addEventListener('change', (event) => {
        window.location.search = `?s=${event.target.value}`;
    });

    return prepinac;
}

async function nacitajRozvrhy() {
    const subory = await vsetkySuboryRozvrhov();
    const kombinovanyRozvrh = new Rozvrh();

    for (const subor of subory) {
        const htmlRozvrhu = await (await fetch(subor)).text();
        const rozvrhObjekt = new Rozvrh().zHtml(htmlRozvrhu);
        kombinovanyRozvrh.hodiny = kombinovanyRozvrh.hodiny.concat(rozvrhObjekt.hodiny);
    }

    return kombinovanyRozvrh;
}

function vytvorInformacie(kombinovanyRozvrh, SKUPINA) {
    const prestavky = kombinovanyRozvrh.dlhePrestavky(SKUPINA);
    const prvaPosledna = kombinovanyRozvrh.skoreADlheDni(SKUPINA);
    const nepovinneDni = kombinovanyRozvrh.ibaNepovinneDni(SKUPINA);

    const prestavkyElement = vytvorInfoElement('Dlhé prestávky (> 30 minút):', tabulkaPrestavok(prestavky));
    const najskorsiNajneskorsiInfo = vytvorInfoElement('Informácie o začiatkoch a koncoch:',
        `<b>Najskorší začiatok</b>: ${prvaPosledna.najskorsi.map(item => `${item.den} (${item.cas})`).join(', ')}<br>
         <b>Najneskorší koniec</b>: ${prvaPosledna.najneskorsi.map(item => `${item.den} (${item.cas})`).join(', ')}`
    );
    const nepovinneDniInfo = vytvorInfoElement('Nepovinné dni:', nepovinneDni.join(', '));

    return [prestavkyElement, najskorsiNajneskorsiInfo, nepovinneDniInfo];
}

function prepinacTmavehoRezimu() {
    const prepinac = document.createElement('button');
    prepinac.textContent = 'Prepnúť tmavý režim';
    prepinac.style.marginLeft = '1rem';

    prepinac.addEventListener('click', () => {
        const tmaveStyly = document.getElementById('tmave-styly');
        tmaveStyly.disabled = !tmaveStyly.disabled;
        localStorage.setItem('tmavyRezim', tmaveStyly.disabled ? 'nie' : 'ano');
    });

    return prepinac;
}

globalThis.window.addEventListener("load", async () => {
    const s = new URLSearchParams(window.location.search).get("s");
    const SKUPINA = (s !== null && s.length > 0 && s !== "0") ? parseInt(s) : null;

    const skup_element = document.getElementById("skupina");
    skup_element.innerHTML = SKUPINA != null ? `Skupina ${SKUPINA}` : "Všetky skupiny";
    skup_element.append(prepinacSkupiny(s));
    skup_element.append(prepinacTmavehoRezimu());

    let tmavyRezim = localStorage.getItem('tmavyRezim')
    if (!tmavyRezim) {
        tmavyRezim = window.matchMedia("(prefers-color-scheme: dark)").matches ? 'ano' : 'nie';
        localStorage.setItem('tmavyRezim', tmavyRezim);
    }

    document.getElementById("tmave-styly").disabled = tmavyRezim === 'nie';

    const rozvrh = document.getElementById("rozvrh");
    const kombinovanyRozvrh = await nacitajRozvrhy();
    rozvrh.appendChild(kombinovanyRozvrh.tabulka(SKUPINA));

    const informacie = vytvorInformacie(kombinovanyRozvrh, SKUPINA);
    const infoDiv = document.createElement('div');
    infoDiv.id = 'informacie';
    informacie.forEach(info => infoDiv.appendChild(info));

    rozvrh.parentNode.appendChild(infoDiv);
});
