// Gedeelde helpers voor de overzichtspagina's (buildings, vehicles, missions, pois, ...)

const LOAD_ERROR = {
    nl: "Data kon niet geladen worden. Probeer het later opnieuw.",
    de: "Daten konnten nicht geladen werden. Bitte später erneut versuchen.",
    en: "Data could not be loaded. Please try again later."
};
const UNKNOWN = { nl: "onbekend", de: "unbekannt", en: "unknown" };

function pageLang() {
    return typeof currentLang !== 'undefined' ? currentLang : 'en';
}

// JSON ophalen met foutcontrole; elk bestand wordt maar één keer gedownload
const jsonCache = new Map();
function getJSON(url) {
    if (!jsonCache.has(url)) {
        const p = fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
                return res.json();
            })
            .catch(e => { jsonCache.delete(url); throw e; });
        jsonCache.set(url, p);
    }
    return jsonCache.get(url);
}

// Tekst uit externe data veilig in HTML zetten
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// Voert een render uit. Wordt er (bv. door snel van taal te wisselen) een nieuwere render gestart,
// dan stopt de oudere vóórdat hij de tabel tekent. Laadfouten worden op de pagina getoond.
let renderSeq = 0;
async function runRender(fn) {
    const seq = ++renderSeq;
    const isCurrent = () => seq === renderSeq;
    try {
        await fn(isCurrent);
    } catch (e) {
        console.error(e);
        if (!isCurrent()) return;
        const container = document.getElementById('sheet-data');
        const msg = document.createElement('p');
        msg.className = 'load-error';
        msg.textContent = LOAD_ERROR[pageLang()] || LOAD_ERROR.en;
        container.innerHTML = '';
        container.appendChild(msg);
    }
}

// Zoekfilter opnieuw toepassen nadat de tabel opnieuw is opgebouwd
function reapplySearch() {
    const input = document.querySelector('#mission-search, #vehicle-search');
    if (input && input.value) input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function fetchLastUpdate(file) {
    const res = await fetch(file);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    const date = new Date((await res.text()).trim());
    if (isNaN(date)) throw new Error(`${file}: invalid date`);
    return date;
}

// Mobiel: elke cel krijgt de kolomnaam als data-label, zodat de tabel op een smal scherm
// als kaartjes getoond kan worden (zie styles.css, @media max-width 640px).
function labelTableCells(root) {
    root.querySelectorAll('#sheet-data table').forEach(table => {
        const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        if (!heads.length) return;
        table.querySelectorAll('tbody > tr').forEach(tr => {
            const cells = tr.children;
            if (cells.length !== heads.length) return;   // detail-rijen (colspan) niet
            tr.classList.add('data-row');
            [...cells].forEach((td, i) => { if (!td.dataset.label) td.dataset.label = heads[i]; });
        });
    });
}
document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('sheet-data');
    if (!target) return;
    let pending = false;
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; labelTableCells(document); });
    }).observe(target, { childList: true, subtree: true });
    labelTableCells(document);
});
