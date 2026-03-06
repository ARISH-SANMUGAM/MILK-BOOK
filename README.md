# MilkBook v2.1 🥛

**MilkBook** is a professional dairy delivery and billing management application designed for small to medium-scale dairy businesses. It provides a robust system for tracking daily milk deliveries, managing customer records, generating professional invoices, and syncing data to the cloud.

## 🚀 Key Features

-   **Admin Dashboard**: High-level overview of daily deliveries, collections, and business performance.
-   **Dual-Storage Sync**: Works instantly using local storage (offline) and automatically syncs to **Firebase Firestore** for cloud backup.
-   **Customer Management**: Easily add, edit, or delete members.
-   **Daily Entry System**: Quick recording for morning/evening milk sessions with auto-calculation of amounts.
-   **Professional Reports**: 
    -   Generate detailed monthly **PDF Invoices** for customers.
    -   Export data to **CSV** for spreadsheet analysis.
    -   Business summary reports for general oversight.
-   **Payment Tracking**: Record and monitor payments, balances, and outstanding dues.
-   **Custom Branding**: Set your business name, address, and upload a **Payment QR Code** for digital invoices.
-   **App Lock**: Optional PIN protection for administrative security.
-   **Dynamic Themes**: Multiple color themes including Royal Blue, Emerald, Crimson, and Dark Mode.

## 🛠️ Technology Stack

-   **Frontend**: Vanilla HTML5, CSS3, and Modern JavaScript (ES6+ Modules).
-   **Database/Backend**: Firebase Firestore (NoSQL).
-   **Authentication**: Firebase Anonymous Authentication.
-   **Icons/Visuals**: System emojis and SVG-based UI elements.
-   **Libraries**:
    -   [jsPDF](https://github.com/parallax/jsPDF) — PDF generation.
    -   [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) — Table formatting in PDFs.
    -   [Cropper.js](https://github.com/fengyuanchen/cropperjs) — Image cropping for QR codes.

## ⚙️ Setup Instructions

### 1. Initialize Local Repository
```bash
git init
git add .
git commit -m "Initial commit: MilkBook v2.1"
```

### 2. Configure Firebase
-   Create a new project at [Firebase Console](https://console.firebase.google.com/).
-   Enable **Firestore Database** and **Anonymous Authentication**.
-   Copy your Firebase configuration into `firebase-config.js`.
-   Deploy the security rules from `firestore.rules`.

### 3. Running Locally
Simply open `index.html` in any modern web browser. For a better experience, use a local development server like **Live Server** (VS Code) or `npx serve`.

---
*Created with ❤️ for professional dairy management.*
