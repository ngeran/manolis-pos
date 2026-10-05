# Plan — Order-flow improvements (feedback round)

Tracked progress for the current feedback round. Each phase is committed
and verified before the next starts.

## Phase 1 — Item comments & predefined options

- [x] Schema: `menu_items.modifier_options` (jsonb array of strings)
- [x] Migration applied to Neon (+ examples: Μοσχαρίσια Γάλακτος doneness,
      Χωριάτικη Σαλάτα without-onion options)
- [x] Admin Μενού: modifier options editor (create + inline edit)
- [x] POS: item with options opens a selection modal (predefined option +
      free comment) before entering the cart; options combine into the
      item's notes so kitchen/board/detail all show them

## Phase 2 — Παραγγελίες: item-level status + ready notifications

- [ ] Board cards list item statuses (Εκκρεμεί / Στο ψήσιμο / Έτοιμο ✓)
- [ ] Ready notification: sound + pulse when an order turns Έτοιμο
      (sound toggle, persisted)
- [ ] Accuracy check: done/total on cards matches kitchen state

## Phase 3 — Roles & access

- [ ] Greek nav per role: staff sees Νέα Παραγγελία / Παραγγελίες /
      Κουζίνα; admin sees everything
- [ ] Admin-only pages guarded (Κρατήσεις, Πελάτες, Μενού, Τραπέζια,
      Κατηγορίες)
- [ ] Παραγγελίες scoping: staff sees the orders HE took; admin sees all
- [ ] Server-side scoping on the orders list API

## Phase 4 — Validation

- [ ] Live E2E: modifiers → kitchen shows them → bump per item → board
      reflects → notify fires → serve → pay
- [ ] Role checks: staff blocked from admin pages/APIs, scoping verified
- [ ] Lint + production build

## Deferred (known, not forgotten)

- Printing / receipts, card payments, campaigns — additive, later rounds
- Modifiers as required (mandatory) choices — current design is optional
