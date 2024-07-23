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

globalThis.window.addEventListener("load", async () => {
    const s = new URLSearchParams(window.location.search).get("s");
    const SKUPINA = (s != null && s.length > 0) ? parseInt(s) : null;

    const skup_element = document.getElementById("skupina");
    if (SKUPINA != null) {
        skup_element.innerHTML = `Skupina ${SKUPINA}`;
    } else {
        skup_element.innerHTML = "Všetky skupiny";
    }

    let rozvrh = document.getElementById("rozvrh");

    for (let subor of await vsetkySuboryRozvrhov()) {
        let htmlRozvrhu = await (await fetch(subor)).text();

        let rozvrhObjekt = new Rozvrh().zHtml(htmlRozvrhu);
        rozvrh.appendChild(rozvrhObjekt.tabulka(SKUPINA));
    }
});
