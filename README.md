# DodiFile 🗄️ – Il Cassetto Digitale Intelligente

Scansiona la burocrazia di casa, lascia che l'app legga **date e categoria**, e non dimenticare più una scadenza.
**Tutto resta sul telefono**: nessun server, nessun account, nessun costo.

Sviluppato da **Adry Doditech** · Licenza MIT

Il repository contiene due versioni con le stesse funzioni:

| Cartella | Cos'è | Come si usa |
|---|---|---|
| `android/` | App **Android nativa** (Kotlin + Jetpack Compose, MVVM) | Apri la cartella `android/` con Android Studio |
| `pwa/` | App **web installabile** (HTML/JS, offline) | GitHub Pages → link da aprire/installare dal telefono |

---

## ✨ Funzioni

- **Un grande tasto centrale**: scansiona con la fotocamera (ritaglio automatico, multi-pagina) o carica PDF/foto.
- **OCR locale** (ML Kit su Android, Tesseract.js sul web): nessun dato lascia il dispositivo.
- **Scadenze automatiche**: riconosce `scadenza 15/12/2026`, `entro il 5 novembre 2026`, `valido fino al…`; calcola la **fine garanzia** da "garanzia 24 mesi" + data d'acquisto. Se non è sicuro, *non inventa* nulla.
- **Categorie automatiche**: Casa, Auto, Salute, Tasse, Spese, Lavoro, Altro.
- **Promemoria**: 7 giorni prima, 1 giorno prima e il giorno stesso alle 9:00 (Android: notifiche locali via WorkManager; web: file calendario `.ics` con allarmi).
- **Ricerca semantica semplificata**: "caldaia" trova anche il documento che parla di "riscaldamento"; tollera piccoli errori di battitura/OCR.
- **Accessibilità**: testo scalabile (Normale / Grande / Molto grande), contrasto alto, tasti ≥ 48 dp, modalità scura, semaforo con icone e testo (non solo colore).
- **Sezione DEV** nelle Impostazioni: crediti, ringraziamento e link GitHub.

### 💡 Funzioni originali aggiunte
1. **Semaforo scadenze** in Home (scadute / entro 7 giorni / più avanti).
2. **Schermata "Controlla il documento"** dopo ogni scansione: l'utente conferma titolo, categoria e data letti dall'OCR (fiducia + niente errori silenziosi).
3. **Fine garanzia calcolata** automaticamente.
4. **Ricerca con sinonimi e tolleranza agli errori** (anche dell'OCR).
5. **Tre promemoria per scadenza**, non uno solo.
6. **Tocco sulla notifica → apre direttamente il documento.**
7. **Scala del testo indipendente** dal sistema, per chi non sa dove trovare le impostazioni di Android.
8. **Esporta le scadenze nel calendario** (versione web) per avvisi garantiti anche ad app chiusa.

## 🆕 Versione 2 della PWA (novità)

- **Nuovo design**: navigazione a schede (Cassetto · Scadenze · Riepilogo · Impostazioni) con grande tasto di scansione al centro, icone vettoriali, tema chiaro/scuro e 5 colori a scelta.
- **Blocco app**: PIN (4 o 6 cifre, salvato come hash PBKDF2) + **impronta / volto / blocco schermo** (WebAuthn), blocco automatico configurabile, protezione contro i tentativi ripetuti.
- **Scadenze**: elenco per urgenza, "Segna come fatto", **ricorrenze** (mensile, trimestrale, annuale) con storico, promemoria personalizzabili (giorni e ora).
- **Riepilogo spese**: importi letti dai documenti, totale del mese, grafico per categoria e degli ultimi 6 mesi, "da pagare nei prossimi 30 giorni".
- **Impostazioni**: nome, tema, colore, dimensione testo (4 livelli), contrasto alto, elenco compatto, animazioni ridotte, modalità privacy, lingua OCR, backup/ripristino, spazio usato, archivio protetto, installazione app.
- **Altro**: preferiti, ordinamento, ricerche recenti, lettura ad alta voce, promemoria senza documento, presentazione iniziale, tasto "indietro" del telefono che chiude le finestre.

> Il blocco protegge l'accesso all'app; i documenti restano nel browser del dispositivo e **non sono cifrati**. Il PIN dimenticato non è recuperabile: l'unica via è cancellare i dati (per questo esiste il backup).

---

## 🧱 Architettura Android (MVVM)

```
android/
├── settings.gradle.kts · build.gradle.kts · gradle.properties
└── app/
    ├── build.gradle.kts                     ← dipendenze (tutte gratuite)
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml          ← unico permesso: POST_NOTIFICATIONS (niente INTERNET)
        │   ├── res/                         ← icona adattiva, temi, FileProvider
        │   └── java/it/doditech/dodifile/
        │       ├── DodiFileApp.kt · AppContainer.kt · MainActivity.kt
        │       ├── core/AppInfo.kt          ← nome sviluppatore + URL GitHub
        │       ├── data/
        │       │   ├── local/               ← Room: DocumentEntity, DocumentDao, AppDatabase
        │       │   └── repository/          ← DocumentRepository, FileStorage, SettingsStore
        │       ├── domain/                  ← logica pura e testabile
        │       │   ├── OcrEngine · DateExtractor · Categorizer · SemanticSearch
        │       │   └── DocumentAnalyzer · Urgency · TextNormalizer
        │       ├── reminder/                ← ReminderScheduler + ReminderWorker (WorkManager)
        │       └── ui/                      ← Jetpack Compose
        │           ├── theme/ · components/ · navigation/
        │           ├── home/    (HomeScreen + HomeViewModel)
        │           ├── detail/  (DetailScreen + DetailViewModel)
        │           └── settings/ (SettingsScreen + DevSection)
        └── test/AnalyzerTest.kt             ← test su scadenze, categorie, ricerca
```

Flusso dati: `UI (Compose) → ViewModel (StateFlow) → Repository → Room / FileStorage / OcrEngine / ReminderScheduler`.

### Avvio
1. Installa [Android Studio](https://developer.android.com/studio) (gratuito) e apri la cartella **`android/`**.
2. Attendi la sincronizzazione Gradle, poi **Run ▶** su un telefono o emulatore (Android 8.0+).
3. In `core/AppInfo.kt` sostituisci `GITHUB_URL` con il tuo profilo/repo reale.

> Lo scanner di documenti ML Kit richiede **Google Play Services** (presente sulla quasi totalità dei telefoni). Se manca, l'app mostra un messaggio e resta disponibile «Carica PDF o foto».
> Sull'ultima parte della richiesta: *Google Code Scanner* legge solo QR/codici a barre, non documenti; per i documenti è più adatto **ML Kit Document Scanner** (gratuito, on-device). Il Code Scanner è già predisposto, commentato, in `build.gradle.kts` per una funzione futura.

---

## 🌐 Versione web (PWA) su GitHub Pages

1. Crea il repository su GitHub e carica **tutto il contenuto di questa cartella**.
2. In **Settings → Pages → Build and deployment → Source** scegli **GitHub Actions**.
3. Ad ogni push su `main` il workflow `pages.yml` pubblica la cartella `pwa/`.
4. Apri `https://TUO-UTENTE.github.io/NOME-REPO/` dal telefono → menu del browser → **Aggiungi a schermata Home**.
5. Cambia il link GitHub nella scheda DEV in `pwa/app.js` (costante `DEV`).

Note oneste sulla PWA:
- Il motore OCR (Tesseract.js, ~10 MB) e pdf.js si scaricano **la prima volta** da CDN pubbliche e poi restano in cache: da lì l'app funziona offline.
- I browser non permettono promemoria affidabili ad app chiusa: per questo ogni scadenza si può aggiungere al **calendario** del telefono (`.ics` con allarmi). All'apertura l'app mostra anche una notifica per le scadenze entro 7 giorni (se autorizzata).
- I dati stanno nel browser (IndexedDB): se l'utente cancella i dati del sito, si perdono.

---

## 🚀 Verso il Google Play Store

Già predisposto:
- `targetSdk 35`, `minSdk 26`, R8/ProGuard e shrink risorse in release, icona adattiva + monocromatica.
- **Nessun permesso INTERNET** e nessun SDK pubblicitario/analytics → "Data safety": *nessun dato raccolto né condiviso*.
- `allowBackup=false` (i documenti non finiscono nei backup cloud), file in archiviazione interna privata, condivisione solo via `FileProvider`.
- Permesso notifiche richiesto a runtime (Android 13+).
- Back predittivo (`enableOnBackInvokedCallback`), edge-to-edge.

Da fare prima di pubblicare:
1. Account sviluppatore Play (**una tantum 25 $** – è l'unico costo, solo per la pubblicazione).
2. Firma dell'app e build **AAB** (`Build → Generate Signed Bundle`); conserva il keystore in un posto sicuro (non su GitHub).
3. **Informativa privacy** (anche breve: "i dati restano sul dispositivo") pubblicata su una pagina web — ad esempio GitHub Pages.
4. Scheda store: screenshot, descrizione, classificazione dei contenuti; compila il modulo *Data safety* (nessun dato raccolto).
5. Test chiuso con almeno il numero di tester richiesto da Google per i nuovi account personali (verifica le regole correnti in Play Console).
6. Traduzioni: le stringhe sono in italiano nel codice; per più lingue spostale in `res/values*/strings.xml`.

## 🛣️ Idee per la roadmap
- Blocco con impronta/PIN (BiometricPrompt) per i documenti sensibili.
- Backup/ripristino manuale in un file ZIP (scelto dall'utente, nessun cloud).
- Widget "Prossime scadenze".
- Scadenze ricorrenti (bollo auto, assicurazione) con rinnovo automatico.
- Lettura di QR/codici (Google Code Scanner) per garanzie e bollettini.
- Importa da "Condividi con DodiFile" (share target).

## ⚠️ Stato del progetto
La logica di analisi (date, categorie, ricerca) è identica in Kotlin e JavaScript; la versione JS è stata verificata con test automatici e in browser. Il codice **Kotlin/Android non è stato compilato in questo ambiente** (manca l'Android SDK): alla prima apertura in Android Studio potrebbero servire piccoli ritocchi (versioni di librerie, import). Il workflow `android.yml` esegue test e build ad ogni push per scoprirli subito.

Con affetto, per chi odia la carta sul tavolo. — *DodiFile*

## Pubblicazione su Google Play (aggiornamento 2.1)
- `pwa/privacy.html` → informativa privacy (URL da inserire in Play Console: `https://doditech83.github.io/DodiFile/privacy.html`).
- `store/scheda-store.md` → titoli, descrizioni, note di rilascio, risposte Data safety e classificazione contenuti.
- `store/` → icona 512, immagine in evidenza 1024×500, screenshot del telefono.
- `store/assetlinks.template.json` → copia il contenuto in `pwa/.well-known/assetlinks.json` inserendo l'impronta SHA-256 della chiave di firma (Play Console → Integrità dell'app). Il workflow `pages.yml` ora pubblica anche la cartella `.well-known`.
- Passi: PWABuilder (pwabuilder.com) con l'URL del sito → Android → package `it.doditech.dodifile` → scarica il pacchetto `.aab` e conserva la chiave di firma in un posto sicuro.
