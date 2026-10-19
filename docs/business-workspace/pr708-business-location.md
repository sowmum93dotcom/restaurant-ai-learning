# Selling business location

The existing **My Business** workspace now collects a country and structured address instead of asking the owner to enter one free-text location. This is the same vendor dashboard intended for business accounts.

- Country selection includes the 249 ISO 3166-1 countries and territories, with localized country names and flag characters. Country names remain available when a device cannot display flag characters.
- Street address and city/town/locality are required. Address line two, state/province/region and postcode are optional, including for countries that do not use postcodes. No US-only address or ZIP format is imposed.
- The optional service/delivery area is stored separately. It describes the owner's declared coverage; it does not implement delivery pricing, map coverage, distance calculation or geocoding.
- Phone numbers entered through this form must include `+` and an international calling code, with 7–15 digits. This is a format check, not verification of ownership or reachability.
- Country is chosen by the owner. Browser language, IP, device position, phone number and old location labels do not silently assign a country.
- Existing records remain readable. An old label such as “Isolated Preview” is not converted into an address. The owner must enter the country and address when saving this form.
- The server validates the address fields and country code, stores them on the existing owned JSONB profile, and derives the short legacy `location` display from locality, region and country. No database migration or backfill is required.
- Existing SQL ownership, access grants, revision checks and owner accuracy confirmation apply. Address editing does not grant Selling access, verify the address externally or publish a business.
- All added form text is supplied in the existing ten Selling languages. Country selection and unsaved address text survive language switching. Arabic uses the existing RTL layout.

Validation: the complete Node suite passed **1,549 tests**, with zero failures or skipped tests. New SQL coverage checks persistence/reload, invalid country rejection, cross-owner rejection, stale revision rejection and unchanged access grants. Browser coverage checks the actual My Business form, saving/reloading, 250 country options including the empty prompt, and preservation of unsaved address fields across all ten languages. The complete existing Selling browser gate passed at widths 375, 390, 430, 761, 820, 1024, 1280 and 1440 in local Chromium 134.0.6998.35. Mobile and desktop form screenshots were visually reviewed. This is not a physical-device Safari check.

This change is prepared for PR #708. No Production deployment, merge, live database edits or Runpod activation is part of this change. Authenticated acceptance on the deployed Preview remains separate from local browser checks.
