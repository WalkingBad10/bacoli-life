import { ITEM_CATALOG, type ItemId } from '../core/config';
import type { GameState } from '../core/types';
import { TimeSystem } from '../systems/TimeSystem';
import type { Wallet } from '../systems/Economy';

export interface ShopCallbacks {
  buy: (item: ItemId) => void;
  sell: (item: ItemId) => void;
  exit: () => void;
}

export interface PhoneSection {
  title: string;
  rows: { label: string; action: () => void }[];
}

export interface PhoneCallbacks {
  order: (item: ItemId) => void;
  call: (name: string) => void;
  tickets: () => void;
  jobs: () => void;
  map: () => void;
  exit: () => void;
  /** Sezioni extra mostrate in tutti i tab, senza perderle al cambio scheda. */
  sections?: PhoneSection[];
}

export class Hud {
  readonly move = { x: 0, y: 0 };
  running = false;
  onInteract: (() => void) | null = null;
  onPhone: (() => void) | null = null;
  onSave: (() => void) | null = null;
  onLoad: (() => void) | null = null;

  private readonly clock: HTMLElement;
  private readonly weather: HTMLElement;
  private readonly money: HTMLElement;
  private readonly energy: HTMLElement;
  private readonly hunger: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly toastEl: HTMLElement;
  private activeTab = 'mappa';

  constructor(root: HTMLElement) {
    root.id = 'ui';
    root.innerHTML = `
      <div class="topbar">
        <div class="chip" id="hud-clock">08:00</div>
        <div class="chip" id="hud-weather"><b>☀</b> Sereno</div>
        <div class="chip">€ <b id="hud-money">500.00</b></div>
        <div class="chip">Giorno <b id="hud-day">1</b></div>
        <button class="chip bl" id="hud-save">Salva</button>
        <button class="chip bl" id="hud-load">Carica</button>
      </div>
      <div class="bars">
        <div class="bar-row"><span>Energia</span><div class="bar-track"><div class="bar-fill energy" id="hud-energy"></div></div></div>
        <div class="bar-row"><span>Fame</span><div class="bar-track"><div class="bar-fill hunger" id="hud-hunger"></div></div></div>
      </div>
      <div class="panel" id="hud-panel"></div>
      <div class="toast" id="hud-toast"></div>
      <div class="hint">WASD / frecce: muoviti · Shift: corri · E: interagisci · T: smartphone · F5/F9: salva/carica</div>
      <div class="mobile">
        <div class="joystick" id="hud-stick"><div class="knob" id="hud-knob"></div></div>
        <div class="touch-buttons">
          <button class="touch-btn" id="hud-run">CORRI</button>
          <button class="touch-btn" id="hud-interact">E</button>
          <button class="touch-btn" id="hud-phone">PHONE</button>
          <button class="touch-btn" id="hud-action">SALVA</button>
        </div>
      </div>`;

    this.clock = this.byId('hud-clock');
    this.weather = this.byId('hud-weather');
    this.money = this.byId('hud-money');
    this.energy = this.byId('hud-energy');
    this.hunger = this.byId('hud-hunger');
    this.panel = this.byId('hud-panel');
    this.toastEl = this.byId('hud-toast');

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch');
    }
    this.bindTouch();
    this.byId('hud-interact').onclick = () => this.onInteract?.();
    this.byId('hud-phone').onclick = () => this.onPhone?.();
    this.byId('hud-action').onclick = () => this.onSave?.();
    this.byId('hud-save').onclick = () => this.onSave?.();
    this.byId('hud-load').onclick = () => this.onLoad?.();

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'F5') { ev.preventDefault(); this.onSave?.(); }
      if (ev.key === 'F9') { ev.preventDefault(); this.onLoad?.(); }
    });
  }

  private byId(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemento UI mancante: ${id}`);
    return el;
  }

  private bindTouch(): void {
    const stick = this.byId('hud-stick');
    const knob = this.byId('hud-knob');
    let active = false;

    const update = (clientX: number, clientY: number) => {
      const rect = stick.getBoundingClientRect();
      let dx = clientX - (rect.left + rect.width / 2);
      let dy = clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      const max = rect.width / 2 - 22;
      if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move.x = dx / max;
      this.move.y = dy / max;
    };

    stick.addEventListener('touchstart', (ev) => {
      active = true;
      update(ev.touches[0].clientX, ev.touches[0].clientY);
      ev.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (ev) => {
      if (!active) return;
      update(ev.touches[0].clientX, ev.touches[0].clientY);
      ev.preventDefault();
    }, { passive: false });
    const stop = () => {
      active = false;
      this.move.x = 0;
      this.move.y = 0;
      knob.style.transform = 'translate(0,0)';
    };
    stick.addEventListener('touchend', stop);
    stick.addEventListener('touchcancel', stop);

    const run = this.byId('hud-run');
    run.addEventListener('touchstart', () => { this.running = true; }, { passive: true });
    run.addEventListener('touchend', () => { this.running = false; }, { passive: true });
  }

  update(state: GameState, time: TimeSystem): void {
    this.clock.textContent = `${time.clock} · G${time.day}`;
    const icon = time.weather === 'rain' ? '☂' : time.weather === 'cloud' ? '☁' : '☀';
    const label = time.weather === 'rain' ? 'Pioggia' : time.weather === 'cloud' ? 'Nuvoloso' : 'Sereno';
    this.weather.innerHTML = `<b>${icon}</b> ${label}`;
    this.weather.className = `chip weather-${time.weather}`;
    this.money.textContent = state.player.money.toFixed(2);
    this.energy.style.width = `${Math.max(0, Math.min(100, state.player.energy))}%`;
    this.hunger.style.width = `${Math.max(0, Math.min(100, state.player.hunger))}%`;
    const dayEl = document.getElementById('hud-day');
    if (dayEl) dayEl.textContent = String(time.day);
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    window.setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  get panelOpen(): boolean {
    return this.panel.classList.contains('open');
  }

  closePanel(): void {
    this.panel.classList.remove('open');
    this.panel.innerHTML = '';
  }

  openInfo(title: string, lines: string[], buttons: { label: string; action: () => void }[]): void {
    this.panel.innerHTML = `<h2>${title}</h2>${lines.map((l) => `<p>${l}</p>`).join('')}
      <div class="row" id="panel-actions"></div>`;
    this.panel.classList.add('open');
    const holder = this.panel.querySelector('#panel-actions') as HTMLElement;
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'bl';
      btn.textContent = b.label;
      btn.onclick = b.action;
      holder.appendChild(btn);
    });
  }

  openShop(title: string, wallet: Wallet, cb: ShopCallbacks): void {
    const items = (Object.keys(ITEM_CATALOG) as ItemId[])
      .filter((id) => ITEM_CATALOG[id].category === 'food'
        || ['souvenir', 'detersivo', 'giornale', 'sigarette', 'candela'].includes(id));
    this.panel.innerHTML = `<h2>${title}</h2>
      <p>Saldo: <b>€ ${wallet.money.toFixed(2)}</b></p>
      ${items.map((id) => `<div class="list-item"><span>${ITEM_CATALOG[id].name} · € ${ITEM_CATALOG[id].price.toFixed(2)}</span>
        <span>${wallet.inventory[id] ?? 0} posseduti
        <button class="bl" data-buy="${id}">Compra</button>
        <button class="bl" data-sell="${id}">Vendi</button></span></div>`).join('')}
      <div class="row"><button class="bl primary" id="shop-exit">Esci</button></div>`;
    this.panel.classList.add('open');
    this.panel.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((btn) => {
      btn.onclick = () => { cb.buy(btn.dataset.buy as ItemId); this.openShop(title, wallet, cb); };
    });
    this.panel.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((btn) => {
      btn.onclick = () => { cb.sell(btn.dataset.sell as ItemId); this.openShop(title, wallet, cb); };
    });
    (this.panel.querySelector('#shop-exit') as HTMLButtonElement).onclick = cb.exit;
  }

  openPhone(cb: PhoneCallbacks): void {
    const render = () => {
      const tabs: Record<string, string> = {
        mappa: 'Mappa', contatti: 'Contatti', ordini: 'Ordini',
        trasporti: 'Trasporti', lavori: 'Lavori',
      };
      let content = '';
      if (this.activeTab === 'mappa') {
        content = `<p><b>Bacoli — zona Via Ortensio / Via Spiaggia</b></p>
          <p>La mappa del telefono mostra la tua posizione, i negozi vicini e la costa.</p>
          <div class="row"><button class="bl" id="phone-map">Apri mappa</button></div>`;
      } else if (this.activeTab === 'contatti') {
        content = ['Bar Pina', 'Talent Caffè', 'Farmacia Guardascione', 'Murphy’s Law Bacoli']
          .map((n) => `<div class="list-item"><span>${n}</span><button class="bl" data-call="${n}">Chiama</button></div>`).join('');
      } else if (this.activeTab === 'ordini') {
        content = `<p>Consegna a domicilio — scegli cosa ordinare:</p>
          ${(['pizza', 'cornetto', 'spesa'] as ItemId[]).map((id) => `
            <div class="list-item"><span>${ITEM_CATALOG[id].name} · € ${ITEM_CATALOG[id].price.toFixed(2)}</span>
            <button class="bl" data-order="${id}">Ordina</button></div>`).join('')}`;
      } else if (this.activeTab === 'trasporti') {
        content = `<p><b>Orari indicativi (EAV / autobus)</b></p>
          <div class="list-item"><span>Autobus Torregaveta → Bacoli</span><span>ogni 20 min</span></div>
          <div class="list-item"><span>Cumana Torregaveta → Napoli</span><span>ogni 30 min</span></div>
          <div class="row"><button class="bl" id="phone-tickets">Acquista biglietto</button></div>`;
      } else {
        content = `<p><b>Offerte di lavoro a Bacoli</b></p>
          <div class="list-item"><span>Barista · Bar Pina</span><span>€ 9/h</span></div>
          <div class="list-item"><span>Pizzaiolo · Pizzeria</span><span>€ 11/h</span></div>
          <div class="list-item"><span>Bagnino · Stabilimento</span><span>€ 8/h</span></div>
          <div class="row"><button class="bl" id="phone-jobs">Candidati</button></div>`;
      }
      const sections = (cb.sections ?? []).map((section, sectionIndex) =>
        `<div class="panel-title">${section.title}</div>`
        + section.rows.map((row, rowIndex) =>
          `<button class="bl" data-section="${sectionIndex}-${rowIndex}">${row.label}</button>`).join(''),
      ).join('');
      this.panel.innerHTML = `<h2>📱 Smartphone</h2>
        <div class="tabs">${Object.entries(tabs).map(([key, label]) =>
          `<button class="tab ${this.activeTab === key ? 'active' : ''}" data-tab="${key}">${label}</button>`).join('')}</div>
        <div id="hud-panel-body">${content}${sections}</div>
        <div class="row"><button class="bl primary" id="phone-exit">Chiudi</button></div>`;
      this.panel.classList.add('open');
      this.panel.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
        btn.onclick = () => { this.activeTab = btn.dataset.tab as string; render(); };
      });
      this.panel.querySelectorAll<HTMLButtonElement>('[data-call]').forEach((btn) => {
        btn.onclick = () => cb.call(btn.dataset.call as string);
      });
      this.panel.querySelectorAll<HTMLButtonElement>('[data-order]').forEach((btn) => {
        btn.onclick = () => cb.order(btn.dataset.order as ItemId);
      });
      this.panel.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((btn) => {
        btn.onclick = () => {
          const [sectionIndex, rowIndex] = (btn.dataset.section ?? '').split('-').map(Number);
          cb.sections?.[sectionIndex]?.rows[rowIndex]?.action();
        };
      });
      const map = this.panel.querySelector('#phone-map') as HTMLButtonElement | null;
      if (map) map.onclick = cb.map;
      const tickets = this.panel.querySelector('#phone-tickets') as HTMLButtonElement | null;
      if (tickets) tickets.onclick = cb.tickets;
      const jobs = this.panel.querySelector('#phone-jobs') as HTMLButtonElement | null;
      if (jobs) jobs.onclick = cb.jobs;
      (this.panel.querySelector('#phone-exit') as HTMLButtonElement).onclick = cb.exit;
    };
    render();
  }
}
