// The configurator: a second Solid island on the same page as the watch.
// It only ever writes to the shared `config` store; the watch, the price and the
// address bar all follow from that one value.

import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
  complications,
  config,
  decode,
  defaults,
  dials,
  encode,
  ENGRAVING_MAX,
  ENGRAVING_PRICE,
  euros,
  hands,
  metals,
  pick,
  priceOf,
  referenceOf,
  sizes,
  straps,
  view,
  type Config,
  type Option,
} from '../../lib/atelier/catalog';
import type { Store } from '../../lib/store';
import './atelier.css';

function fromStore<T>(store: Store<T>) {
  const [value, setValue] = createSignal(store.get(), { equals: false });
  onCleanup(store.subscribe((next) => setValue(() => next)));
  return value;
}

const swatch = (colors: readonly string[]) =>
  colors.length >= 4
    ? `linear-gradient(135deg, ${colors[0]}, ${colors[1]} 45%, ${colors[2]} 75%, ${colors[3]})`
    : colors[0];

export default function Configurator() {
  let root!: HTMLDivElement;
  const c = fromStore(config);
  const set = <K extends keyof Config>(key: K, value: Config[K]) => config.set({ ...config.get(), [key]: value });

  const price = createMemo(() => priceOf(c()));
  const reference = createMemo(() => referenceOf(c()));
  const names = createMemo(() => pick(c()));

  // The displayed price rolls toward the real one instead of jumping.
  const [shown, setShown] = createSignal(priceOf(config.get()));
  const [copied, setCopied] = createSignal(false);
  const [reserved, setReserved] = createSignal(false);

  onMount(() => {
    // A link is a watch: restore the configuration from the address bar.
    const readUrl = () => {
      const code = new URLSearchParams(location.hash.slice(1)).get('c');
      if (code && code !== encode(config.get())) config.set(decode(code));
    };
    readUrl();
    setShown(priceOf(config.get()));
    // Pasting another watch's link into the same tab only changes the hash.
    addEventListener('hashchange', readUrl);
    onCleanup(() => removeEventListener('hashchange', readUrl));

    let raf = 0;
    const roll = () => {
      raf = requestAnimationFrame(roll);
      const gap = price() - shown();
      if (Math.abs(gap) < 1) {
        if (gap !== 0) setShown(price());
        return;
      }
      setShown(shown() + gap * 0.14);
    };
    raf = requestAnimationFrame(roll);

    // Pose the watch for building while this section is on screen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) view.set('build');
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    observer.observe(root);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    });
  });

  // ...and keep the address bar in step with every change, without adding history entries.
  createEffect(() => {
    const code = encode(c());
    const same = code === encode(defaults);
    if (typeof history === 'undefined') return;
    history.replaceState(history.state, '', same ? location.pathname : `#c=${code}`);
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the link is in the address bar anyway.
    }
  };

  const Group = <T extends Option>(props: {
    title: string;
    field: 'metal' | 'dial' | 'hands' | 'comp' | 'strap';
    options: readonly T[];
    swatches?: boolean;
  }) => {
    const chosen = () => props.options.find((option) => option.id === c()[props.field])!;
    return (
      <fieldset class="atl-group">
        <legend>
          <span class="label-md">{props.title}</span>
          <span class="label-sm muted">
            {chosen().name}
            {chosen().note ? ` · ${chosen().note}` : ''}
          </span>
        </legend>
        <div class="atl-options">
          <For each={props.options}>
            {(option) => (
              <button
                type="button"
                class="atl-option body-md"
                classList={{
                  current: c()[props.field] === option.id,
                  'has-swatch': !!props.swatches && option.colors.length > 0,
                }}
                aria-pressed={c()[props.field] === option.id}
                onClick={() => set(props.field, option.id as never)}
              >
                <Show when={props.swatches && option.colors.length > 0}>
                  <span
                    class="atl-swatch"
                    style={{
                      background:
                        option.id === 'bracelet' ? swatch(names().metal.colors) : swatch(option.colors),
                    }}
                  />
                </Show>
                {option.name}
                <Show when={option.price > 0}>
                  <span class="atl-plus">+{option.price}</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </fieldset>
    );
  };

  return (
    <div class="atl-config" ref={root}>
      <Group title="Case" field="metal" options={metals} swatches />
      <Group title="Dial" field="dial" options={dials} swatches />
      <Group title="Hands" field="hands" options={hands} />
      <Group title="Complication" field="comp" options={complications} />
      <Group title="Strap" field="strap" options={straps} swatches />

      <fieldset class="atl-group">
        <legend>
          <span class="label-md">Size</span>
          <span class="label-sm muted">{c().size} mm across</span>
        </legend>
        <div class="atl-options">
          <For each={sizes}>
            {(size) => (
              <button
                type="button"
                class="atl-option body-md"
                classList={{ current: c().size === size }}
                aria-pressed={c().size === size}
                onClick={() => set('size', size)}
              >
                {size} mm
              </button>
            )}
          </For>
        </div>
      </fieldset>

      <fieldset class="atl-group">
        <legend>
          <span class="label-md">Engraving</span>
          <span class="label-sm muted">On the caseback · +{ENGRAVING_PRICE}</span>
        </legend>
        <label class="atl-engrave">
          <input
            type="text"
            maxLength={ENGRAVING_MAX}
            placeholder="A name, a date, a reason"
            aria-label="Engraving text"
            value={c().engraving}
            onInput={(e) => set('engraving', e.currentTarget.value)}
            // Turn the watch over while the words are being written.
            onFocus={() => view.set('engrave')}
            onBlur={() => view.set('build')}
          />
          <span class="label-sm faint">
            {c().engraving.length}/{ENGRAVING_MAX}
          </span>
        </label>
      </fieldset>

      <div class="atl-summary">
        <div>
          <div class="label-sm atl-ref">{reference()}</div>
          <div class="data-lg">{euros(shown())}</div>
        </div>
        <div class="atl-actions">
          <button type="button" class="label-sm" onClick={copyLink}>
            {copied() ? 'Copied ✓' : 'Copy link'}
          </button>
          <button type="button" class="label-sm primary" onClick={() => setReserved(true)}>
            {reserved() ? 'It doesn’t exist, sorry' : 'Reserve'}
          </button>
        </div>
      </div>
    </div>
  );
}
