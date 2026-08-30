# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# i18n — every string ships in French AND English

The app is fully bilingual (fr/en) via i18next. Non-negotiable rules for any change:

- **Never hardcode a user-facing string** (JSX text, labels, placeholders, Alert/toasts, option arrays). Use `t()` from `useTranslation('<namespace>')` and add the key to BOTH `src/i18n/en/<ns>.json` and `src/i18n/fr/<ns>.json` in the same change. Namespaces are per feature (auth, common, poker, dashboard, finder, degen, profile, games, bluff, ofc, replayer, stats).
- Plurals use i18next `_one`/`_other` suffixes with `{ count }` — never `` `${n} mot${n > 1 ? 's' : ''}` `` (wrong for English `n=0`).
- Never concatenate sentence fragments; make one whole-sentence key per variant, with `{{interpolation}}`.
- Pure logic in `src/lib/**` stays free of react/i18n imports: return stable codes/ids (see `bluff/engine.ts` error codes, `pokerHandEvaluator.ts` `categoryId`) and translate at render, or accept a `t: TFunction` parameter (see `bluff/labels.ts`).
- Dates/amounts: use the locale-aware helpers in `src/lib/format.ts`. Never call `toLocaleDateString`/`toLocaleString` with a hardcoded locale, never hand-build `€` strings.
- Do-not-translate glossary: positions (BTN/SB/BB/UTG/CO/HJ/LJ/MP), SB/BB/Ante, ITM, ROI, stakes (1/2…10/20), tournament proper names (Main Event…), brand names, "UPK", "Ultimate Poker Kit".
- Enforcement: `npm test` runs `src/i18n/__tests__/parity.test.ts` (fails on en/fr key or `{{placeholder}}` divergence) and `src/i18n/__tests__/keys.test.ts` (fails when a literal `t('…')` names a key that does not exist); `npm run lint` flags hardcoded JSX strings (`i18next/no-literal-string`). Run both before finishing, plus `npx tsc --noEmit`.
- **`tsc` does NOT check t() keys**, despite `src/i18n/types.d.ts` looking like it should — the augmentation targets the wrong module and i18next's `strictKeyChecks` defaults to off. A misspelled key compiles clean. `keys.test.ts` is what catches it; see the comment in `types.d.ts` for what enabling real typing would cost.
