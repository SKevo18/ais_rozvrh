import { Rozvrh, dni } from "./triedy.mjs";

const ZACIATOK_SEMESTRA = new Date('2025-02-17');
const POCET_TYZDNOV = 13;

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
        const params = new URLSearchParams(window.location.search);
        params.set('s', event.target.value);
        window.location.search = params.toString();
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
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    const zobrazenie = params.get('z') || 't';
    const SKUPINA = (s !== null && s.length > 0 && s !== "0") ? parseInt(s) : null;

    const skup_element = document.getElementById("skupina");
    skup_element.innerHTML = SKUPINA != null ? `Skupina ${SKUPINA}` : "Všetky skupiny";
    skup_element.append(prepinacSkupiny(s));
    skup_element.append(prepinacTmavehoRezimu());

    let tmavyRezim = localStorage.getItem('tmavyRezim');
    if (!tmavyRezim) {
        tmavyRezim = window.matchMedia("(prefers-color-scheme: dark)").matches ? 'ano' : 'nie';
        localStorage.setItem('tmavyRezim', tmavyRezim);
    }

    document.getElementById("tmave-styly").disabled = tmavyRezim === 'nie';

    const rozvrh = document.getElementById("rozvrh");
    const kalendar = document.getElementById("kalendar");
    const kombinovanyRozvrh = await nacitajRozvrhy();
    rozvrh.appendChild(kombinovanyRozvrh.tabulka(SKUPINA));

    const informacie = vytvorInformacie(kombinovanyRozvrh, SKUPINA);
    const infoDiv = document.createElement('div');
    infoDiv.id = 'informacie';
    informacie.forEach(info => infoDiv.appendChild(info));
    rozvrh.parentNode.appendChild(infoDiv);

    if (zobrazenie === 'k') {
        rozvrh.style.display = 'none';
        kalendar.style.display = 'block';
        if (!kalendar.dataset.initialized) {
            await nastavitKalendar();
            kalendar.dataset.initialized = 'true';
        }
    } else {
        rozvrh.style.display = 'block';
        kalendar.style.display = 'none';
    }

    document.getElementById('prepnut-zobrazenie').addEventListener('click', async () => {
        if (rozvrh.style.display === 'none') {
            rozvrh.style.display = 'block';
            kalendar.style.display = 'none';
            params.set('z', 't');
        } else {
            rozvrh.style.display = 'none';
            kalendar.style.display = 'block';
            if (!kalendar.dataset.initialized) {
                await nastavitKalendar();
                kalendar.dataset.initialized = 'true';
            }
            params.set('z', 'k');
        }
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    });
});

async function nastavitKalendar() {
    const kalendar = document.getElementById('kalendar');
    kalendar.style.width = '100vw';
    kalendar.style.height = '100vh';

    const eventy = await nacitatEventyZRozvrhu();
    const allEvents = [];

    for (let tyzdenOffset = 0; tyzdenOffset < POCET_TYZDNOV; tyzdenOffset++) {
        const aktualnyDatumTyzdna = new Date(ZACIATOK_SEMESTRA);
        aktualnyDatumTyzdna.setDate(ZACIATOK_SEMESTRA.getDate() + tyzdenOffset * 7);
        const tyzden = cisloTyzdna(aktualnyDatumTyzdna);

        const eventsForWeek = eventy.filter(event => {
            const denVTyzdni = event.daysOfWeek[0];
            if (denVTyzdni === 6 || denVTyzdni === 7) {
                return false; // Exclude Saturday and Sunday
            }

            if (event.extendedProps.pravidelnost === "N.T" && tyzden % 2 !== 0) {
                return true; // Odd weeks
            } else if (event.extendedProps.pravidelnost === "P.T" && tyzden % 2 === 0) {
                return true; // Even weeks
            } else if (event.extendedProps.pravidelnost === "TYZ") {
                return true; // Every week
            }
            return false;
        }).map(event => ({
            ...event,
            startRecur: aktualnyDatumTyzdna.toISOString().split('T')[0],
            endRecur: new Date(aktualnyDatumTyzdna.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }));

        allEvents.push(...eventsForWeek);
    }

    const fullCalendar = new window.FullCalendar.Calendar(kalendar, {
        initialView: 'timeGridWeek',
        initialDate: ZACIATOK_SEMESTRA.toISOString().split('T')[0],
        slotMinTime: '00:00:00',
        slotMaxTime: '24:00:00',
        events: allEvents,
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        expandRows: true,
        contentHeight: 'auto',
        aspectRatio: 1.5,
        slotMinTime: '07:00:00',
        slotMaxTime: '19:00:00',
        hiddenDays: [0, 6],
        locale: 'sk',
    });
    fullCalendar.render();
}

function cisloTyzdna(datum) {
    const zaciatocnyDatum = new Date(datum.getFullYear(), 0, 1);
    const dni = Math.floor((datum - zaciatocnyDatum) / (24 * 60 * 60 * 1000));
    return Math.ceil((dni + zaciatocnyDatum.getDay() + 1) / 7);
}

async function nacitatEventyZRozvrhu() {
    const kombinovanyRozvrh = await nacitajRozvrhy();
    const s = new URLSearchParams(window.location.search).get("s");
    const SKUPINA = (s !== null && s.length > 0 && s !== "0") ? parseInt(s) : null;
    const hodiny = kombinovanyRozvrh.filtrujPodlaSkupiny(SKUPINA)

    const eventy = hodiny.map(hodina => {
        const denIndex = Object.keys(dni).indexOf(hodina.den);

        return {
            title: hodina.nazov,
            daysOfWeek: [denIndex + 1], // 1 je pondelok, 7 je nedela
            startTime: hodina.casZaciatku(),
            endTime: hodina.casKonca(),
            display: 'block',
            extendedProps: {
                pravidelnost: hodina.pravidelnost
            }
        };
    });

    return eventy;
}
