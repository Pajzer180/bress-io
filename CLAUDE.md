# CLAUDE.md — Pamięć Projektu Bress.io

## Opis projektu

**Bress.io** to autonomiczny Agent SEO B2B. Analizuje intencje klientów z wyszukiwarki i automatycznie nanosi optymalizacje SEO na ich strony WWW (np. WordPress).

Produkt składa się z dwóch elementów:
1. **Panel Eksperta** – webowa aplikacja Next.js, w której ekspert SEO wysyła wytyczne przez czat tekstowy i zarządza optymalizacjami.
2. **JS Snippet** – czysty JavaScript wklejany przez klienta na swoją stronę, który pobiera i wdraża optymalizacje z naszego API.

## Tech Stack

| Warstwa | Technologia |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Stylowanie | Tailwind CSS |
| Baza danych | Firebase Firestore |
| Autentykacja | Firebase Authentication |
| Logika agentowa | OpenAI API (analiza SEO, chat) |
| Hosting | Vercel (docelowo) |

## Komendy

```bash
# Uruchomienie serwera deweloperskiego
npm run dev

# Budowanie produkcyjne
npm run build

# Uruchomienie produkcyjne
npm run start

# Linting
npm run lint
```

## Architektura Firebase

- `projects/{projectId}` — projekty klientów (URL strony, nazwa, ustawienia)
- `guidelines/{guidelineId}` — wytyczne eksperta (wiadomości z czatu tekstowego)
- `optimizations/{optimizationId}` — wygenerowane optymalizacje SEO (status: pending/published)
- `clients/{uid}` — profil klienta (plan, tryb autonomiczny, snippet token)

Pola Firestore: camelCase (`siteUrl`, `isAutonomous`, `createdAt`, `publishedAt` itp.)

### Wzorce Firebase w Next.js (App Router)
- `lib/firebase/admin.ts` → eksportuje `getAdminAuth()` i `getAdminDb()` jako lazy funkcje
- `lib/firebase/client.ts` → eksportuje `getClientAuth()` i `getClientDb()` jako lazy funkcje
- `next.config.ts`: `serverExternalPackages: ['firebase-admin']`

## Zasady Projektu

### UI i język
- **Interfejs użytkownika wyłącznie w języku polskim**
- Komunikaty błędów, etykiety, przyciski — wszystko po polsku

### Podejście
- **Mobile-first** — projektuję od najmniejszego ekranu wzwyż
- **App Router** — wyłącznie Next.js App Router (nie Pages Router)
- `'use client'` tylko tam, gdzie naprawdę potrzebna jest interaktywność
- Server Components i Server Actions jako domyślne podejście
- `export const dynamic = 'force-dynamic'` na stronach serwerowych czytających dane sesji

### Kod
- TypeScript strict mode
- Tailwind CSS do wszystkich stylów (bez CSS Modules / styled-components)
- Komponenty UI: shadcn/ui
- Żadnych zbędnych abstrakcji — minimum kodu do osiągnięcia celu
- Walidacja danych wejściowych tylko na granicach systemu (API routes, Server Actions)

### Bezpieczeństwo
- Snippet komunikuje się z API przez unikalny token klienta (nie ujawnia kluczy Firebase)
- HttpOnly cookies do sesji użytkownika
- Tryb autonomiczny wymaga jawnej zgody klienta (flaga `isAutonomous`)

## Struktura katalogów (docelowa)

```
src/
├── app/
│   ├── (auth)/          # logowanie, rejestracja
│   ├── (dashboard)/     # panel eksperta
│   ├── api/             # API routes (snippet, webhooks)
│   └── layout.tsx
├── components/
│   ├── ui/              # shadcn/ui
│   └── ...              # komponenty własne
├── lib/
│   ├── firebase/        # admin.ts, client.ts, session.ts
│   ├── openai/          # klient OpenAI, prompty
│   └── utils.ts
└── types/               # typy TypeScript
```
