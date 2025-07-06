import { Rozvrh, dni } from "./triedy.mjs";

// Konštanty
const ZACIATOK_SEMESTRA = new Date('2025-02-17');
const POCET_TYZDNOV = 13;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hodín v milisekundách
const DEBOUNCE_DELAY = 300; // Debounce pre vyhľadávanie

// Globálne premenné
let kombinovanyRozvrh = null;
let aktualnaSkupina = null;
let aktualneZobrazenie = 't'; // 't' = tabuľka, 'k' = kalendár
let searchTimeout = null;

/**
 * Cache manager pre localStorage
 */
class CacheManager {
    /**
     * Uloží dáta do cache s expiráciou
     * @param {string} key Kľúč
     * @param {any} data Dáta na uloženie
     */
    static set(key, data) {
        try {
            const cacheItem = {
                data: data,
                timestamp: Date.now(),
                expires: Date.now() + CACHE_EXPIRY
            };
            localStorage.setItem(`rozvrh_cache_${key}`, JSON.stringify(cacheItem));
        } catch (error) {
            console.warn('Chyba pri ukladaní do cache:', error);
        }
    }

    /**
     * Načíta dáta z cache
     * @param {string} key Kľúč
     * @returns {any|null} Dáta alebo null ak neexistujú/expirovali
     */
    static get(key) {
        try {
            const cached = localStorage.getItem(`rozvrh_cache_${key}`);
            if (!cached) return null;

            const cacheItem = JSON.parse(cached);
            if (Date.now() > cacheItem.expires) {
                localStorage.removeItem(`rozvrh_cache_${key}`);
                return null;
            }

            return cacheItem.data;
        } catch (error) {
            console.warn('Chyba pri načítavaní z cache:', error);
            return null;
        }
    }

    /**
     * Vymaže celú cache
     */
    static clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('rozvrh_cache_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Chyba pri mazaní cache:', error);
        }
    }
}

/**
 * Vráti zoznam HTML súborov všetkých rozvrhov s cachovaním
 * @returns {Promise<string[]>}
 */
async function vsetkySuboryRozvrhov() {
    try {
        const cached = CacheManager.get('subory_rozvrhov');
        if (cached) return cached;

        const response = await fetch("/rozvrhy/zoznam.json");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        const subory = json["subory"].map((subor) => "/rozvrhy/" + subor);

        CacheManager.set('subory_rozvrhov', subory);
        return subory;
    } catch (error) {
        console.error('Chyba pri načítavaní súborov rozvrhov:', error);
        return [];
    }
}

/**
 * Načíta a skombinuje všetky rozvrhy s cachovaním
 * @returns {Promise<Rozvrh>}
 */
async function nacitajRozvrhy() {
    try {
        // Pokús sa načítať z cache
        const cached = CacheManager.get('kombinovany_rozvrh');
        if (cached) {
            // Deserializuj cache späť na Rozvrh objekt
            const rozvrh = new Rozvrh();
            rozvrh.hodiny = cached.hodiny || [];
            return rozvrh;
        }

        zobrazLoadingStav(true);

        const subory = await vsetkySuboryRozvrhov();
        kombinovanyRozvrh = new Rozvrh();

        // Parallelné načítanie súborov pre lepšiu výkonnosť
        const rozvrhyPromises = subory.map(async (subor) => {
            try {
                const response = await fetch(subor);
                if (!response.ok) {
                    throw new Error(`Chyba pri načítavaní ${subor}: ${response.status}`);
                }
                return await response.text();
            } catch (error) {
                console.warn(`Preskakujem súbor ${subor}:`, error);
                return null;
            }
        });

        const htmlRozvrhy = await Promise.all(rozvrhyPromises);

        htmlRozvrhy.forEach((htmlRozvrhu, index) => {
            if (htmlRozvrhu) {
                try {
                    const rozvrhObjekt = Rozvrh.zHtml(htmlRozvrhu);
                    kombinovanyRozvrh.hodiny = kombinovanyRozvrh.hodiny.concat(rozvrhObjekt.hodiny);
                } catch (error) {
                    console.warn(`Chyba pri spracovaní súboru ${subory[index]}:`, error);
                }
            }
        });

        // Uloženie do cache
        CacheManager.set('kombinovany_rozvrh', {
            hodiny: kombinovanyRozvrh.hodiny,
            timestamp: Date.now()
        });

        zobrazLoadingStav(false);
        return kombinovanyRozvrh;

    } catch (error) {
        console.error('Kritická chyba pri načítavaní rozvrhov:', error);
        zobrazChybovuSpravu('Chyba pri načítavaní rozvrhov. Skúste obnoviť stránku.');
        zobrazLoadingStav(false);
        return new Rozvrh();
    }
}

/**
 * Zobrazí alebo skryje loading indikátor
 * @param {boolean} zobraz 
 */
function zobrazLoadingStav(zobraz) {
    let loading = document.getElementById('loading');

    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading';
        loading.className = 'loading-spinner';
        loading.innerHTML = `
            <div class="spinner"></div>
            <p>Načítavam rozvrhy...</p>
        `;
        document.body.appendChild(loading);
    }

    loading.style.display = zobraz ? 'flex' : 'none';
}

/**
 * Zobrazí chybovú správu
 * @param {string} sprava 
 */
function zobrazChybovuSpravu(sprava) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <span class="error-icon">⚠️</span>
        <span>${sprava}</span>
        <button onclick="this.parentElement.remove()">✕</button>
    `;

    document.body.insertBefore(errorDiv, document.body.firstChild);

    // Automatické odstránenie po 5 sekundách
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

/**
 * Vytvorí informačný element s lepším formátovaním
 * @param {string} nadpis 
 * @param {string} obsah 
 * @returns {HTMLElement}
 */
function vytvorInfoElement(nadpis, obsah) {
    const element = document.createElement('div');
    element.className = 'info-karta';
    element.innerHTML = `
        <h3 class="info-nadpis">${nadpis}</h3>
        <div class="info-obsah">${obsah}</div>
    `;
    return element;
}

/**
 * Vytvorí tabuľku prestávok s lepším formátovaním
 * @param {Object} prestavkyData 
 * @returns {string}
 */
function tabulkaPrestavok(prestavkyData) {
    const riadky = Object.entries(prestavkyData).flatMap(([den, prestavky]) =>
        prestavky.map(p => `
            <tr>
                <td class="den-cell">${den}</td>
                <td class="cas-cell">${p.zaciatok}</td>
                <td class="cas-cell">${p.koniec}</td>
                <td class="dlzka-cell">${p.formatovanaDlzka || p.dlzka + ' min'}</td>
            </tr>
        `)
    ).join('');

    if (!riadky) {
        return '<p class="no-data">Žiadne dlhé prestávky</p>';
    }

    return `
        <table class="prestavky-tabulka">
            <thead>
                <tr>
                    <th>Deň</th>
                    <th>Začiatok prestávky</th>
                    <th>Koniec prestávky</th>
                    <th>Trvanie</th>
                </tr>
            </thead>
            <tbody>
                ${riadky}
            </tbody>
        </table>
    `;
}

/**
 * Vytvorí ovládacie prvky pre skupiny
 * @param {number|null} aktualnaSkupina 
 * @returns {HTMLElement}
 */
function vytvorOvladanieSkupiny(aktualnaSkupina) {
    const container = document.createElement('div');
    container.className = 'skupina-controls';

    const label = document.createElement('label');
    label.textContent = 'Skupina: ';
    label.className = 'skupina-label';

    const select = document.createElement('select');
    select.id = 'skupina-select';
    select.className = 'skupina-select';

    // Možnosti pre výber skupiny
    const options = [
        { value: 0, text: 'Všetky skupiny' },
        ...Array.from({ length: 7 }, (_, i) => ({ value: i + 1, text: `Skupina ${i + 1}` }))
    ];

    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.text;
        optionEl.selected = (aktualnaSkupina || 0) == option.value;
        select.appendChild(optionEl);
    });

    select.addEventListener('change', (event) => {
        const novaSkupina = parseInt(event.target.value) || null;
        zmenSkupinu(novaSkupina);
    });

    container.appendChild(label);
    container.appendChild(select);

    return container;
}

/**
 * Vytvorí vyhľadávací panel
 * @returns {HTMLElement}
 */
function vytvorVyhladavanie() {
    const container = document.createElement('div');
    container.className = 'search-container';

    container.innerHTML = `
        <div class="search-box">
            <input type="text" id="search-input" placeholder="Vyhľadať predmet, učiteľa alebo miestnosť..." />
            <button id="search-clear" title="Vymazať">✕</button>
        </div>
        <div class="filter-options">
            <label><input type="checkbox" id="filter-c" checked> Cvičenia</label>
            <label><input type="checkbox" id="filter-s" checked> Semináre</label>
            <label><input type="checkbox" id="filter-p" checked> Prednášky</label>
        </div>
    `;

    // Event listeners
    const searchInput = container.querySelector('#search-input');
    const clearButton = container.querySelector('#search-clear');
    const filterCheckboxes = container.querySelectorAll('input[type="checkbox"]');

    const performSearch = debounce(() => {
        aplikujFiltreAVyhladavanie();
    }, DEBOUNCE_DELAY);

    searchInput.addEventListener('input', performSearch);
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        aplikujFiltreAVyhladavanie();
    });

    filterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', aplikujFiltreAVyhladavanie);
    });

    return container;
}

/**
 * Debounce funkcia pre optimalizáciu
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(searchTimeout);
            func(...args);
        };
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(later, wait);
    };
}

/**
 * Aplikuje filtre a vyhľadávanie
 */
function aplikujFiltreAVyhladavanie() {
    if (!kombinovanyRozvrh) return;

    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const filterC = document.getElementById('filter-c')?.checked !== false;
    const filterS = document.getElementById('filter-s')?.checked !== false;
    const filterP = document.getElementById('filter-p')?.checked !== false;

    // Vytvor nový rozvrh s filtrovanými hodinami
    const filtrovanePredmety = kombinovanyRozvrh.hodiny.filter(hodina => {
        // Filter podľa typu
        const typOk = (filterC && hodina.typ === 'C') ||
            (filterS && hodina.typ === 'S') ||
            (filterP && hodina.typ === 'P');

        if (!typOk) return false;

        // Filter podľa vyhľadávacieho reťazca
        if (searchTerm) {
            const searchableText = `${hodina.nazov} ${hodina.vyucujuci} ${hodina.miestnost}`.toLowerCase();
            return searchableText.includes(searchTerm);
        }

        return true;
    });

    const filtrovanyRozvrh = new Rozvrh(filtrovanePredmety);
    aktualizujZobrazenie(filtrovanyRozvrh);
}

/**
 * Aktualizuje zobrazenie rozvrhu
 * @param {Rozvrh} rozvrh 
 */
function aktualizujZobrazenie(rozvrh = kombinovanyRozvrh) {
    if (!rozvrh) return;

    const rozvrhDiv = document.getElementById("rozvrh");
    const staraTabulka = rozvrhDiv.querySelector('.rozvrh-tabulka');

    if (staraTabulka) {
        staraTabulka.remove();
    }

    try {
        const novaTabulka = rozvrh.tabulka(aktualnaSkupina);
        rozvrhDiv.appendChild(novaTabulka);

        // Aktualizuj informácie
        aktualizujInformacie(rozvrh);
    } catch (error) {
        console.error('Chyba pri aktualizácii zobrazenia:', error);
        zobrazChybovuSpravu('Chyba pri zobrazení rozvrhu');
    }
}

/**
 * Vytvorí informácie o rozvrhu
 * @param {Rozvrh} rozvrh 
 * @returns {HTMLElement[]}
 */
function vytvorInformacie(rozvrh) {
    try {
        const prestavky = rozvrh.dlhePrestavky(aktualnaSkupina);
        const prvaPosledna = rozvrh.skoreADlheDni(aktualnaSkupina);
        const nepovinneDni = rozvrh.ibaNepovinneDni(aktualnaSkupina);

        const prestavkyElement = vytvorInfoElement(
            'Dlhé prestávky (≥ 30 minút)',
            tabulkaPrestavok(prestavky)
        );

        const casovyFormat = (items) => items.length > 0
            ? items.map(item => `${item.den} (${item.cas})`).join(', ')
            : 'Nie sú dostupné dáta';

        const najskorsiNajneskorsiInfo = vytvorInfoElement(
            'Informácie o začiatkoch a koncoch',
            `<div class="cas-info">
                <p><strong>Najskorší začiatok:</strong> ${casovyFormat(prvaPosledna.najskorsi)}</p>
                <p><strong>Najneskorší koniec:</strong> ${casovyFormat(prvaPosledna.najneskorsi)}</p>
            </div>`
        );

        const nepovinneDniText = nepovinneDni.length > 0 ? nepovinneDni.join(', ') : 'Žiadne';
        const nepovinneDniInfo = vytvorInfoElement('Nepovinné dni', nepovinneDniText);

        // Štatistiky
        const statistiky = vytvorStatistiky(rozvrh);

        return [prestavkyElement, najskorsiNajneskorsiInfo, nepovinneDniInfo, statistiky];
    } catch (error) {
        console.error('Chyba pri vytváraní informácií:', error);
        return [vytvorInfoElement('Chyba', 'Nepodarilo sa načítať informácie o rozvrhu')];
    }
}

/**
 * Vytvorí štatistiky rozvrhu
 * @param {Rozvrh} rozvrh 
 * @returns {HTMLElement}
 */
function vytvorStatistiky(rozvrh) {
    const hodiny = rozvrh.filtrujPodlaSkupiny(aktualnaSkupina);

    const pocetCviceni = hodiny.filter(h => h.typ === 'C').length;
    const pocetSeminarov = hodiny.filter(h => h.typ === 'S').length;
    const pocetPrednasky = hodiny.filter(h => h.typ === 'P').length;

    const unikatnePremedty = new Set(hodiny.map(h => h.skratka)).size;
    const celkovyPocetHodin = hodiny.reduce((sum, h) => sum + h.pocetHodin, 0);

    const statistikyHTML = `
        <div class="statistiky-grid">
            <div class="stat-item">
                <span class="stat-number">${hodiny.length}</span>
                <span class="stat-label">Celkovo blokov</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${celkovyPocetHodin}</span>
                <span class="stat-label">Hodín týždenne</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${unikatnePremedty}</span>
                <span class="stat-label">Predmetov</span>
            </div>
            <div class="stat-item typ-c">
                <span class="stat-number">${pocetCviceni}</span>
                <span class="stat-label">Cvičení</span>
            </div>
            <div class="stat-item typ-s">
                <span class="stat-number">${pocetSeminarov}</span>
                <span class="stat-label">Seminárov</span>
            </div>
            <div class="stat-item typ-p">
                <span class="stat-number">${pocetPrednasky}</span>
                <span class="stat-label">Prednášok</span>
            </div>
        </div>
    `;

    return vytvorInfoElement('Štatistiky rozvrhu', statistikyHTML);
}

/**
 * Aktualizuje informácie o rozvrhu
 * @param {Rozvrh} rozvrh 
 */
function aktualizujInformacie(rozvrh) {
    let infoDiv = document.getElementById('informacie');

    if (infoDiv) {
        infoDiv.remove();
    }

    infoDiv = document.createElement('div');
    infoDiv.id = 'informacie';
    infoDiv.className = 'informacie-container';

    const informacie = vytvorInformacie(rozvrh);
    informacie.forEach(info => infoDiv.appendChild(info));

    const rozvrhContainer = document.getElementById('rozvrh').parentNode;
    rozvrhContainer.appendChild(infoDiv);
}

/**
 * Zmení skupinu a aktualizuje URL
 * @param {number|null} novaSkupina 
 */
function zmenSkupinu(novaSkupina) {
    aktualnaSkupina = novaSkupina;

    const params = new URLSearchParams(window.location.search);
    if (novaSkupina) {
        params.set('s', novaSkupina.toString());
    } else {
        params.delete('s');
    }

    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);

    // Aktualizuj zobrazenie
    aplikujFiltreAVyhladavanie();

    // Aktualizuj kalendár ak je aktívny
    if (aktualneZobrazenie === 'k') {
        obnovKalendar();
    }
}

/**
 * Vytvorí prepínač tmavého režimu
 * @returns {HTMLElement}
 */
function vytvorPrepinacTmavehoRezimu() {
    const container = document.createElement('div');
    container.className = 'theme-toggle';

    const button = document.createElement('button');
    button.className = 'theme-toggle-btn';
    button.innerHTML = `
        <span class="theme-icon">🌙</span>
        <span class="theme-text">Tmavý režim</span>
    `;

    button.addEventListener('click', () => {
        const tmaveStyly = document.getElementById('tmave-styly');
        const isCurrentlyDark = !tmaveStyly.disabled;

        tmaveStyly.disabled = isCurrentlyDark;
        localStorage.setItem('tmavyRezim', isCurrentlyDark ? 'nie' : 'ano');

        // Aktualizuj ikonu a text
        button.innerHTML = `
            <span class="theme-icon">${isCurrentlyDark ? '🌙' : '☀️'}</span>
            <span class="theme-text">${isCurrentlyDark ? 'Tmavý režim' : 'Svetlý režim'}</span>
        `;
    });

    container.appendChild(button);
    return container;
}

/**
 * Vytvorí panel nástrojov
 * @returns {HTMLElement}
 */
function vytvorToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    toolbar.appendChild(vytvorOvladanieSkupiny(aktualnaSkupina));
    toolbar.appendChild(vytvorPrepinacTmavehoRezimu());

    // Tlačidlo pre vymazanie cache
    const clearCacheBtn = document.createElement('button');
    clearCacheBtn.className = 'btn btn-secondary';
    clearCacheBtn.textContent = 'Obnoviť dáta';
    clearCacheBtn.title = 'Vymaže cache a znovu načíta rozvrhy';
    clearCacheBtn.addEventListener('click', async () => {
        CacheManager.clear();
        if (kombinovanyRozvrh) {
            kombinovanyRozvrh.vycistiCache();
        }
        kombinovanyRozvrh = await nacitajRozvrhy();
        aktualizujZobrazenie();
    });

    toolbar.appendChild(clearCacheBtn);

    return toolbar;
}

/**
 * Obnoví kalendár s aktuálnymi dátami
 */
async function obnovKalendar() {
    const kalendar = document.getElementById('kalendar');
    if (kalendar.dataset.initialized === 'true') {
        kalendar.dataset.initialized = 'false';
        kalendar.innerHTML = '';
        await nastavitKalendar();
    }
}

/**
 * Inicializuje aplikáciu
 */
async function inicializacia() {
    try {
        // Načítaj parametre z URL
        const params = new URLSearchParams(window.location.search);
        const s = params.get("s");
        aktualneZobrazenie = params.get('z') || 't';
        aktualnaSkupina = (s !== null && s.length > 0 && s !== "0") ? parseInt(s) : null;

        // Nastav tmavý režim
        nastavTmavyRezim();

        // Vytvor UI komponenty
        const skupinaElement = document.getElementById("skupina");
        skupinaElement.innerHTML = '';

        const nadpis = document.createElement('h1');
        nadpis.textContent = aktualnaSkupina ? `Skupina ${aktualnaSkupina}` : "Všetky skupiny";
        nadpis.className = 'main-title';

        const toolbar = vytvorToolbar();
        const vyhladavanie = vytvorVyhladavanie();

        skupinaElement.appendChild(nadpis);
        skupinaElement.appendChild(toolbar);
        skupinaElement.appendChild(vyhladavanie);

        // Načítaj a zobraz rozvrhy
        kombinovanyRozvrh = await nacitajRozvrhy();

        const rozvrhDiv = document.getElementById("rozvrh");
        const kalendarDiv = document.getElementById("kalendar");

        // Nastav zobrazenie
        if (aktualneZobrazenie === 'k') {
            rozvrhDiv.style.display = 'none';
            kalendarDiv.style.display = 'block';
            await nastavitKalendar();
            kalendarDiv.dataset.initialized = 'true';
        } else {
            rozvrhDiv.style.display = 'block';
            kalendarDiv.style.display = 'none';
            aktualizujZobrazenie();
        }

        // Nastav prepínač zobrazenia
        nastavPrepinacZobrazenia();

    } catch (error) {
        console.error('Chyba pri inicializácii aplikácie:', error);
        zobrazChybovuSpravu('Chyba pri spustení aplikácie. Skúste obnoviť stránku.');
    }
}

/**
 * Nastaví tmavý režim podľa preferencií
 */
function nastavTmavyRezim() {
    let tmavyRezim = localStorage.getItem('tmavyRezim');
    if (!tmavyRezim) {
        tmavyRezim = window.matchMedia("(prefers-color-scheme: dark)").matches ? 'ano' : 'nie';
        localStorage.setItem('tmavyRezim', tmavyRezim);
    }

    const tmaveStyly = document.getElementById("tmave-styly");
    tmaveStyly.disabled = tmavyRezim === 'nie';
}

/**
 * Nastaví prepínač zobrazenia
 */
function nastavPrepinacZobrazenia() {
    const prepinacBtn = document.getElementById('prepnut-zobrazenie');
    prepinacBtn.textContent = aktualneZobrazenie === 'k' ? 'Zobraziť tabuľku' : 'Zobraziť kalendár';
    prepinacBtn.className = 'btn btn-primary view-toggle-btn';

    prepinacBtn.addEventListener('click', async () => {
        const params = new URLSearchParams(window.location.search);
        const rozvrhDiv = document.getElementById("rozvrh");
        const kalendarDiv = document.getElementById("kalendar");

        if (aktualneZobrazenie === 't') {
            // Prepni na kalendár
            rozvrhDiv.style.display = 'none';
            kalendarDiv.style.display = 'block';

            if (kalendarDiv.dataset.initialized !== 'true') {
                await nastavitKalendar();
                kalendarDiv.dataset.initialized = 'true';
            }

            aktualneZobrazenie = 'k';
            params.set('z', 'k');
            prepinacBtn.textContent = 'Zobraziť tabuľku';
        } else {
            // Prepni na tabuľku
            rozvrhDiv.style.display = 'block';
            kalendarDiv.style.display = 'none';
            aktualneZobrazenie = 't';
            params.set('z', 't');
            prepinacBtn.textContent = 'Zobraziť kalendár';
        }

        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    });
}

// Existujúce funkcie pre kalendár (necháme pôvodné)
async function nastavitKalendar() {
    try {
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
                    return false;
                }

                if (event.extendedProps.pravidelnost === "N.T" && tyzden % 2 !== 0) {
                    return true;
                } else if (event.extendedProps.pravidelnost === "P.T" && tyzden % 2 === 0) {
                    return true;
                } else if (event.extendedProps.pravidelnost === "TYZ") {
                    return true;
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
            slotMinTime: '07:00:00',
            slotMaxTime: '19:00:00',
            events: allEvents,
            slotLabelFormat: {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            },
            expandRows: true,
            contentHeight: 'auto',
            aspectRatio: 1.5,
            hiddenDays: [0, 6],
            locale: 'sk',
            allDaySlot: false,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridWeek,timeGridDay'
            },
            eventDidMount: function (info) {
                // Pridaj tooltip s detailmi
                info.el.title = `${info.event.title}\nMiestnosť: ${info.event.extendedProps.miestnost || 'Neurčená'}\nVyučujúci: ${info.event.extendedProps.vyucujuci || 'Neurčený'}`;
            }
        });

        fullCalendar.render();
    } catch (error) {
        console.error('Chyba pri nastavovaní kalendára:', error);
        zobrazChybovuSpravu('Chyba pri zobrazení kalendára');
    }
}

function cisloTyzdna(datum) {
    const zaciatocnyDatum = new Date(datum.getFullYear(), 0, 1);
    const dni = Math.floor((datum - zaciatocnyDatum) / (24 * 60 * 60 * 1000));
    return Math.ceil((dni + zaciatocnyDatum.getDay() + 1) / 7);
}

async function nacitatEventyZRozvrhu() {
    if (!kombinovanyRozvrh) return [];

    const hodiny = kombinovanyRozvrh.filtrujPodlaSkupiny(aktualnaSkupina);

    const eventy = hodiny.map(hodina => {
        const denIndex = Object.keys(dni).indexOf(hodina.den);

        return {
            title: `${hodina.nazov} (${hodina.typ})`,
            daysOfWeek: [denIndex + 1],
            startTime: hodina.casZaciatku(),
            endTime: hodina.casKonca(),
            display: 'block',
            extendedProps: {
                pravidelnost: hodina.pravidelnost,
                miestnost: hodina.miestnost,
                vyucujuci: hodina.vyucujuci,
                skupiny: hodina.skupiny
            },
            backgroundColor: {
                'C': '#ff6b6b',
                'S': '#ffd93d',
                'P': '#6bcf7f'
            }[hodina.typ] || '#gray'
        };
    });

    return eventy;
}

// Spustenie aplikácie
if (typeof window !== 'undefined') {
    window.addEventListener("load", inicializacia);

    // Pridaj error handler pre nechytené chyby
    window.addEventListener('error', (event) => {
        console.error('Nechytená chyba:', event.error);
        zobrazChybovuSpravu('Nastala neočakávaná chyba v aplikácii');
    });

    // Pridaj warning pre offline stav
    window.addEventListener('offline', () => {
        zobrazChybovuSpravu('Aplikácia je offline. Niektoré funkcie nemusia fungovať správne.');
    });
}
