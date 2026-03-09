title: DTE-Rates-for-Home-Assistant
type: Home Automation
year: 2025
technologies: Python, Home Assistant, HACS, Lovelace, PDF Parsing, Custom Integration

# DTE Rates for Home Assistant

## Real-Time DTE Electric Rates in Your Smart Home

DTE Rates for Home Assistant is a custom integration that pulls the official DTE residential electric rate card PDF, parses plans and time-of-use windows dynamically, and exposes import/export price sensor entities that update based on time-of-day and season.

## Why It Matters
- Eliminates manually hardcoding rate schedules that change with every DTE tariff update.
- Enables energy automations and dashboards to react to live pricing (off-peak charging, export decisions, cost tracking).
- Integrates directly with the Home Assistant Energy Dashboard as a `USD/kWh` price entity.
- HACS-installable — no manual file copying required for most users.

## What It Exposes

| Entity | Type | Description |
|---|---|---|
| `sensor.dte_import_rate` | monetary | Current import price (USD/kWh) |
| `sensor.dte_export_rate` | monetary | Current export/generation price (USD/kWh) |
| `sensor.dte_current_rate_name` | string | Active period name (e.g. `Winter Off-Peak`) |
| `sensor.dte_rate_schedule` | structured | Full parsed schedule with attributes for dashboards |

## Architecture
```
DTE Rate Card PDF (dteenergy.com)
        ↓ (weekly refresh)
PDF Parser → Plan/Period/Window/Component extraction
        ↓
Home Assistant Config Flow (rate plan + net metering selection)
        ↓
Sensor entities (updated on time boundary events)
        ↓
Energy Dashboard / Automations / Lovelace Cards
```

## Key Features
- **Dynamic PDF parsing:** Rates are parsed live from the official DTE PDF — no hardcoded values that go stale.
- **Time-of-use awareness:** Sensors reflect the correct rate for the current time window and season automatically.
- **Net metering support:** Export calculation adjusts based on whether net metering is enabled.
- **Warning system:** Persistent notifications and `warning` attributes fire when a previously selected rate plan disappears from the latest card.
- **Custom Lovelace card:** Ships a `custom:dte-rates-card` for at-a-glance rate display on any dashboard.
- **Service calls:** Force refresh, inspect the parsed schedule, and generate card YAML examples via HA services.

## Custom Lovelace Card
```yaml
type: custom:dte-rates-card
title: DTE Residential Rates
import_entity: sensor.dte_import_rate
export_entity: sensor.dte_export_rate
name_entity: sensor.dte_current_rate_name
schedule_entity: sensor.dte_rate_schedule
```

## Services

| Service | Description |
|---|---|
| `dte_rates.refresh_rate_card` | Force re-download and re-parse of the DTE PDF |
| `dte_rates.show_rate_schedule` | Dumps parsed schedule to a persistent notification |
| `dte_rates.show_lovelace_card_example` | Generates card resource + YAML example notification |

## Status
- **State:** Active, publicly available via HACS.
- **Role:** Full design + implementation (PDF parsing pipeline, HA integration, config flow, Lovelace card).
- **Next Up:** Support for additional DTE rate plans, multi-utility expansion.

[GitHub](https://github.com/javaDevJT/DTE-Rates-for-Home-Assistant)
