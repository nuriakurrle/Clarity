# Clarity – Frontend (Expo / React Native)

Statische Screens der Clarity-App. **Noch keine Backend-Anbindung** – alle
Daten sind Mock-Daten.

## Setup

```bash
cd frontend
npm install
npm start        # danach i = iOS, a = Android, w = Web
```

## Stand

| Screen          | Status            | Verantwortlich |
| --------------- | ----------------- | -------------- |
| Insight Screen  | ✅ statisch fertig | Aicha          |
| Calendar Screen | ✅ statisch fertig | Aicha          |
| Home Screen     | offen             | Teammate       |
| Search Screen   | offen             | Teammate       |
| Eintrag schreiben | offen           | Teammate       |

## Struktur

```
frontend/
├── App.tsx                     # TEMPORÄR: Vorschau-Umschalter, wird durch echtes Routing ersetzt
└── src/
    ├── theme/colors.ts         # gemeinsame Farb-/Stimmungspalette
    ├── components/             # wiederverwendbare UI-Bausteine (Design-System)
    │   ├── index.ts            #   Sammel-Export: import { Card } from '../components'
    │   ├── ScreenHeader.tsx    #   Titel + Untertitel
    │   ├── Card.tsx            #   Karte mit Titel/Inhalt
    │   ├── SegmentedControl.tsx#   Umschalter (Woche/Monat/Jahr)
    │   ├── StatBox.tsx         #   Kennzahl
    │   ├── MoodBarChart.tsx    #   Stimmungs-Balkendiagramm
    │   ├── MoodDot.tsx         #   farbiger Stimmungs-Punkt
    │   ├── Tag.tsx             #   Themen-Chip mit Zähler
    │   ├── Bullet.tsx          #   Aufzählungszeile
    │   ├── NumberedItem.tsx    #   nummerierte Zeile
    │   ├── MonthNav.tsx        #   Monats-Navigation
    │   ├── CalendarGrid.tsx    #   Monatsgitter
    │   ├── MoodLegend.tsx      #   Stimmungs-Legende
    │   ├── MoodPill.tsx        #   Stimmungs-Label (Pille)
    │   └── EntryCard.tsx       #   einzelner Journal-Eintrag
    └── screens/
        ├── InsightScreen.tsx   # nutzt Komponenten + Mock-Daten
        └── CalendarScreen.tsx  # nutzt Komponenten + Mock-Daten
```

### Komponenten wiederverwenden

Alle Bausteine kommen aus einem Sammel-Export:

```tsx
import { Card, ScreenHeader, MoodDot } from '../components';
```

Sie sind rein darstellend (bekommen ihre Daten per Props) – dadurch nutzbar in
allen Screens und unabhängig vom späteren Backend.

## Hinweis zum Routing

Das Routing wird **gemeinsam** eingerichtet, sobald alle Screens stehen.
`App.tsx` ist nur ein provisorischer Umschalter zum Ansehen der beiden Screens.
Die Komponenten unter `src/screens/` sind eigenständig (kein Router-Zwang) und
lassen sich später direkt in expo-router / React Navigation einhängen.
