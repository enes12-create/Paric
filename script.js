'use strict';

/**
 * =====================================================================
 * Hyperparic – script.js
 * -----------------------------------------------------------------------
 * Enthält die komplette Logik der App:
 *   1) Dynamisches Erzeugen der Raster & Felder
 *   2) Tipp-Logik (zyklisch 1–9) & Doppeltipp-Logik (Feld leeren)
 *   3) Header-Aktion "Neue Seite" (setzt alle Felder zurück)
 *
 * Der Code ist bewusst modular aufgebaut, sodass z.B. die Anzahl der
 * Raster, Spalten/Reihen oder der maximale Zahlenwert leicht angepasst
 * werden können, ohne die Kernlogik zu verändern.
 * =====================================================================
 */

// ---------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------
const CONFIG = {
  MAIN_GRID_COUNT: 4, // Anzahl der großen Raster nebeneinander
  MAIN_GRID_COLUMNS: 2,
  MAIN_GRID_ROWS: 3,

  EXTRA_GRID_COLUMNS: 8, // 1 Reihe x 8 Spalten, genauso breit wie die Hauptraster-Reihe
  EXTRA_GRID_ROWS: 1,

  MAX_VALUE: 9, // höchster zyklischer Wert pro Feld (1–9)
  DOUBLE_TAP_DELAY: 260, // ms – Zeitfenster für Doppeltipp-Erkennung

  PULSE_CLASS: 'field--pulse',
};

// ---------------------------------------------------------------------
// DOM-Erzeugung: Felder & Raster
// ---------------------------------------------------------------------

/**
 * Erstellt ein einzelnes Spielfeld (Zelle) inkl. Zahlenanzeige und
 * optionalen HUD-Eckmarkierungen.
 *
 * @param {boolean} withCorners - ob die vier L-förmigen Eckmarkierungen
 *                                 gerendert werden sollen
 * @returns {HTMLDivElement}
 */
function createField(withCorners) {
  const field = document.createElement('div');
  field.className = 'field';
  field.setAttribute('role', 'button');
  field.setAttribute('tabindex', '0');
  field.setAttribute('aria-label', 'Leeres Feld');

  // Zahlenanzeige (wird von attachFieldInteraction befüllt)
  const value = document.createElement('span');
  value.className = 'field__value';
  field.appendChild(value);

  // HUD-Eckmarkierungen (an allen 4 Ecken, außer beim Zusatzraster)
  if (withCorners) {
    ['tl', 'tr', 'bl', 'br'].forEach((corner) => {
      const mark = document.createElement('span');
      mark.className = `field__corner field__corner--${corner}`;
      field.appendChild(mark);
    });
  }

  return field;
}

/**
 * Erstellt ein großes Raster aus mehreren Feldern, angeordnet in
 * "columns" Spalten und "rows" Reihen.
 *
 * @param {number} columns
 * @param {number} rows
 * @param {boolean} withCorners
 * @returns {HTMLDivElement}
 */
function createGrid(columns, rows, withCorners) {
  const grid = document.createElement('div');
  grid.className = 'grid';

  // Spalten-/Reihenzahl wird als CSS-Variable übergeben,
  // damit style.css das Layout flexibel per grid-template-* setzen kann.
  grid.style.setProperty('--grid-columns', columns);
  grid.style.setProperty('--grid-rows', rows);

  const totalFields = columns * rows;
  for (let i = 0; i < totalFields; i++) {
    grid.appendChild(createField(withCorners));
  }

  return grid;
}

// ---------------------------------------------------------------------
// Interaktion: Einfacher Tipp (zyklisch) & Doppeltipp (leeren)
// ---------------------------------------------------------------------

/**
 * Hängt die Tipp-/Doppeltipp-Logik an ein einzelnes Feld an.
 *
 * Verhalten:
 *  - Einmal tippen  -> Wert erhöht sich zyklisch: leer -> 1 -> 2 ... -> 9 -> 1
 *  - Doppeltippen   -> Feld wird sofort geleert
 *
 * Die Unterscheidung zwischen einfachem und doppeltem Tipp erfolgt über
 * ein Zeitfenster (CONFIG.DOUBLE_TAP_DELAY): Der einfache Tipp wird erst
 * ausgeführt, wenn innerhalb dieses Fensters kein zweiter Tipp erfolgt.
 *
 * @param {HTMLDivElement} field
 */
function attachFieldInteraction(field) {
  const valueEl = field.querySelector('.field__value');

  let currentValue = 0; // 0 bedeutet "leer"
  let pendingTapTimer = null;
  let lastTapTimestamp = 0;

  /** Aktualisiert die sichtbare Zahl sowie das Accessibility-Label. */
  const render = () => {
    valueEl.textContent = currentValue === 0 ? '' : String(currentValue);
    field.setAttribute(
      'aria-label',
      currentValue === 0 ? 'Leeres Feld' : `Feld mit Wert ${currentValue}`
    );
  };

  /** Spielt die kleine, weiche Tipp-Animation ab. */
  const pulse = () => {
    field.classList.remove(CONFIG.PULSE_CLASS);
    void field.offsetWidth; // Reflow erzwingen -> Animation neu starten
    field.classList.add(CONFIG.PULSE_CLASS);
  };

  /** Erhöht den Wert zyklisch (leer/1 -> 2 -> ... -> 9 -> 1). */
  const incrementValue = () => {
    currentValue = currentValue >= CONFIG.MAX_VALUE ? 1 : currentValue + 1;
    render();
    pulse();
  };

  /** Leert das Feld vollständig. */
  const clearValue = () => {
    currentValue = 0;
    render();
    pulse();
  };

  /** Zentrale Tap-Behandlung inkl. Doppeltipp-Erkennung. */
  const handleTap = () => {
    const now = Date.now();
    const elapsedSinceLastTap = now - lastTapTimestamp;

    const isDoubleTap =
      lastTapTimestamp > 0 && elapsedSinceLastTap < CONFIG.DOUBLE_TAP_DELAY;

    if (isDoubleTap) {
      // Doppeltipp erkannt: ausstehenden einfachen Tipp abbrechen und leeren
      clearTimeout(pendingTapTimer);
      clearValue();
      lastTapTimestamp = 0;
      return;
    }

    // Möglicher einfacher Tipp: kurz warten, ob ein zweiter Tipp folgt
    lastTapTimestamp = now;
    pendingTapTimer = setTimeout(() => {
      incrementValue();
    }, CONFIG.DOUBLE_TAP_DELAY);
  };

  field.addEventListener('click', handleTap);

  // Tastatur-Zugänglichkeit: Enter/Leertaste lösen ebenfalls einen Tipp aus
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTap();
    }
  });

  // Reset-Funktion am Element hinterlegen, damit "Neue Seite" jedes
  // Feld direkt zurücksetzen kann, ohne die interne Logik zu kennen.
  field._resetField = () => {
    clearTimeout(pendingTapTimer);
    lastTapTimestamp = 0;
    currentValue = 0;
    render();
  };
}

// ---------------------------------------------------------------------
// Board-Aufbau
// ---------------------------------------------------------------------

/**
 * Baut das komplette Spielfeld auf:
 *   - 4 große Raster (2 Spalten x 3 Reihen) mit HUD-Eckmarkierungen
 *   - 1 Zusatzraster (8 Spalten x 1 Reihe, volle Breite) ohne Eckmarkierungen
 */
function initBoard() {
  const gridRowMain = document.getElementById('gridRowMain');
  const gridRowExtra = document.getElementById('gridRowExtra');

  // Hauptraster nebeneinander erzeugen
  for (let i = 0; i < CONFIG.MAIN_GRID_COUNT; i++) {
    const grid = createGrid(
      CONFIG.MAIN_GRID_COLUMNS,
      CONFIG.MAIN_GRID_ROWS,
      true // mit Eckmarkierungen
    );
    gridRowMain.appendChild(grid);
  }

  // Zusatzraster darunter erzeugen (ohne Eckmarkierungen)
  const extraGrid = createGrid(
    CONFIG.EXTRA_GRID_COLUMNS,
    CONFIG.EXTRA_GRID_ROWS,
    false // ohne Eckmarkierungen
  );
  extraGrid.classList.add('grid--extra');
  gridRowExtra.appendChild(extraGrid);

  // Interaktion an alle soeben erzeugten Felder anhängen
  document.querySelectorAll('.field').forEach(attachFieldInteraction);
}

/** Setzt alle Felder im gesamten Board auf "leer" zurück. */
function resetAllFields() {
  document.querySelectorAll('.field').forEach((field) => {
    if (typeof field._resetField === 'function') {
      field._resetField();
    }
  });
}

/** Verknüpft den "Neue Seite"-Button im Header mit der Reset-Funktion. */
function initHeaderActions() {
  const newPageBtn = document.getElementById('newPageBtn');
  newPageBtn.addEventListener('click', resetAllFields);
}

// ---------------------------------------------------------------------
// App-Start
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initBoard();
  initHeaderActions();
});
