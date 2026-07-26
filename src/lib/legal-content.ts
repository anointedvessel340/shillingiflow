export const LEGAL_VERSION = "2026-07-26";

export type LegalSection = { heading?: string; paragraphs: string[] };
export type LegalDoc = {
  title: string;
  lastUpdated: string;
  intro: string[];
  sections: LegalSection[];
  footer: string;
};

export const PRIVACY_POLICY: LegalDoc = {
  title: "SHILLINGITRACK — Privacy Policy",
  lastUpdated: "Last updated: July 26, 2026",
  intro: [
    'Owned and operated by: AV Productions ("we," "us," "our")',
    "Contact: projectfilesav@gmail.com",
  ],
  sections: [
    {
      heading: "1. Introduction",
      paragraphs: [
        "SHILLINGITRACK is a personal and business financial tracking system. It is not a bank, payment processor, or financial institution — it does not hold, move, or transfer real money. It records financial activity that you manually enter, and calculates balances, reports, and analytics from that recorded information.",
        "This Privacy Policy explains what information we collect, why, how it's stored and protected, and what rights you have over it.",
      ],
    },
    {
      heading: "2. What We Collect",
      paragraphs: [
        "Account information: email address, and any display name or profile details you provide.",
        "Financial records you enter: transactions, categories, accounts, budgets, goals, debts, savings/investment records, clients, projects, invoices, and equipment/asset records you create within the app. This data is entered by you — we do not connect to your bank, mobile money, or any financial institution to pull this information automatically.",
        "Attachments: any receipts, photos, or documents you choose to upload and attach to records.",
        "Technical information: device type, browser type, IP address, and login timestamps, collected automatically for security and fraud-prevention purposes (see Section 6).",
        "Security data: login history, session information, two-factor authentication status, and security event logs (e.g. password changes, backup activity) — collected to protect your account, not to monitor your financial behavior.",
      ],
    },
    {
      heading: "3. What We Do NOT Collect or Do",
      paragraphs: [
        "We do not sell your data to anyone, for any reason.",
        "We do not use your financial data for advertising or share it with advertisers.",
        "We do not use third-party analytics or tracking scripts that collect your financial information.",
        "We do not access your bank accounts, mobile money accounts, or any external financial systems.",
        "We do not read, analyze, or use your individual financial data for any purpose other than displaying it back to you.",
      ],
    },
    {
      heading: "4. How We Use Your Information",
      paragraphs: [
        "To provide the core functionality of the app (storing and displaying your records, calculating dashboards and reports).",
        "To authenticate you and protect your account (login, 2FA, session management, security logging).",
        "To provide customer support if you contact us.",
        "To send you account-related notifications (e.g. budget alerts, backup confirmations) that you have enabled — never promotional or advertising messages without your separate, explicit consent.",
        'In aggregate, anonymized form only, to understand overall product usage (e.g. "how many users use the Business workspace") — never in a way that identifies your individual financial data to us or anyone else.',
      ],
    },
    {
      heading: "5. Where Your Data Is Stored",
      paragraphs: [
        "Your data is stored in an encrypted database hosted by our infrastructure provider (Supabase, running on Supabase infrastructure). Row-level access controls ensure your data is only ever visible to your own authenticated account. Attachments are stored in private, non-public storage accessible only via your authenticated session.",
      ],
    },
    {
      heading: "6. Security",
      paragraphs: [
        "We take the following measures to protect your data:",
        "Encryption of data in transit (HTTPS/TLS) and at rest.",
        "Row-Level Security enforced at the database layer, not just the application layer, so your data cannot be accessed by other users even in the event of an application-level bug.",
        "Optional two-factor authentication and passkey/biometric login.",
        "Automatic session locking after inactivity.",
        "Rate-limiting and lockout on repeated failed login attempts.",
        "A security event log so you can review login activity on your own account.",
        "No system can guarantee absolute security. If we become aware of a data breach affecting your account, we will notify you within a reasonable time as required by applicable law.",
      ],
    },
    {
      heading: "7. Your Rights",
      paragraphs: [
        "Subject to applicable law (including Kenya's Data Protection Act, 2019, where applicable), you have the right to:",
        "Access the personal data we hold about you (in practice, this is simply your account data, visible to you directly in the app).",
        "Request a full export of your data at any time (built into the app's Backup & Export feature).",
        "Request correction of inaccurate data.",
        "Request deletion of your account and associated data, subject to any legal retention requirements.",
        "Withdraw consent for optional communications at any time.",
        "To exercise any of these rights, contact us at projectfilesav@gmail.com.",
      ],
    },
    {
      heading: "8. Data Retention",
      paragraphs: [
        "We retain your data for as long as your account is active. If you delete your account, your data will be permanently removed from our active systems within 30 days, except where retention is required by law or for legitimate backup/disaster-recovery purposes for a limited additional period.",
        'Deleted transactions within the app move to a recoverable "Trash" state for 30 days before permanent deletion, giving you a window to recover accidental deletions.',
      ],
    },
    {
      heading: "9. Backups You Control",
      paragraphs: [
        "You may generate your own encrypted backup export at any time. Encrypted backups are protected with a passphrase that only you hold — we do not store this passphrase and cannot recover a backup for you if it is lost. This is a deliberate design choice: it means we, as the operators of SHILLINGITRACK, cannot read your encrypted backup files even if we wanted to.",
      ],
    },
    {
      heading: "10. Children's Privacy",
      paragraphs: [
        "SHILLINGITRACK is not directed at children under 18. We do not knowingly collect data from anyone under this age.",
      ],
    },
    {
      heading: "11. Changes to This Policy",
      paragraphs: [
        "We may update this Privacy Policy from time to time. Material changes will be communicated via in-app notice or email before they take effect.",
      ],
    },
    {
      heading: "12. Contact Us",
      paragraphs: [
        "Questions about this policy or your data can be directed to:",
        "AV Productions",
        "projectfilesav@gmail.com",
        "Nairobi, Kenya",
      ],
    },
  ],
  footer:
    "© 2026 AV Productions. All rights reserved. SHILLINGITRACK is a product of AV Productions.",
};

export const TERMS_OF_SERVICE: LegalDoc = {
  title: "SHILLINGITRACK — Terms of Service",
  lastUpdated: "Last updated: July 26, 2026",
  intro: [
    'Provided by: AV Productions ("we," "us," "our")',
    "Contact: projectfilesav@gmail.com",
    'By creating an account or using SHILLINGITRACK ("the Service"), you agree to these Terms of Service ("Terms"). If you do not agree, do not use the Service.',
  ],
  sections: [
    {
      heading: "1. What SHILLINGITRACK Is — and Is Not",
      paragraphs: [
        "SHILLINGITRACK is a personal and business financial tracking and record-keeping tool. It is:",
        "Not a bank. We do not hold, custody, transfer, or move real money on your behalf.",
        "Not a payment processor. Any subscription payments made for paid tiers are processed by a separate, licensed third-party payment provider, not by SHILLINGITRACK directly.",
        'Not a financial, tax, accounting, or investment advisor. Nothing displayed in the app — including forecasts, insights, or "financial health" indicators — constitutes professional financial, tax, legal, or investment advice. All figures are mathematical calculations based on data you personally enter, and their accuracy depends entirely on the accuracy of what you enter.',
        "You are solely responsible for the accuracy of the information you input and for any financial decisions you make based on the app's output.",
      ],
    },
    {
      heading: "2. Eligibility",
      paragraphs: [
        "You must be at least 18 years old (or the age of legal majority in your jurisdiction) to create an account and use the Service.",
      ],
    },
    {
      heading: "3. Account Responsibilities",
      paragraphs: [
        "You are responsible for maintaining the confidentiality of your login credentials, including any password, passkey, or two-factor authentication method.",
        "You are responsible for all activity that occurs under your account.",
        "You must notify us immediately at projectfilesav@gmail.com if you suspect unauthorized access to your account.",
        "You agree to provide accurate information during account setup and to keep it up to date.",
      ],
    },
    {
      heading: "4. Acceptable Use",
      paragraphs: [
        "You agree not to:",
        "Use the Service for any unlawful purpose, including money laundering, tax evasion, or fraud.",
        "Attempt to gain unauthorized access to any account other than your own, or to any part of the Service's infrastructure.",
        "Attempt to reverse-engineer, scrape, or extract the Service's underlying code, design, or database structure.",
        "Use the Service to store or transmit content that is illegal, defamatory, or infringes on the rights of others.",
        "Circumvent any access controls, rate limits, or security measures built into the Service.",
        "We reserve the right to suspend or terminate accounts that violate these Terms.",
      ],
    },
    {
      heading: "5. Subscriptions & Payment",
      paragraphs: [
        'Certain features (the "Business" workspace and related tools) may require a paid subscription or one-time purchase, as described at the time of purchase.',
        "Payments are processed by a third-party payment provider. We do not store your full payment card details.",
        "Subscription fees are billed on the cycle disclosed at checkout (e.g. monthly) and are non-refundable except where required by law or expressly stated otherwise at time of purchase.",
        "We reserve the right to change pricing with reasonable advance notice to existing subscribers; changes will not apply retroactively to an already-paid billing period.",
        "You may cancel a subscription at any time; cancellation takes effect at the end of the current billing period, and you retain access to paid features until then.",
      ],
    },
    {
      heading: "6. Your Data",
      paragraphs: [
        "You retain ownership of the financial data and content you enter into SHILLINGITRACK.",
        "We do not claim ownership over your transactions, notes, documents, or other records you create.",
        "Our Privacy Policy governs how we collect, store, and protect this data — see the Privacy Policy page within the app.",
        "You are responsible for maintaining your own backups; while we provide backup and export tools, you are encouraged to periodically export your own copy of your data.",
      ],
    },
    {
      heading: "7. Intellectual Property",
      paragraphs: [
        "SHILLINGITRACK — including its name, logo, design, source code, user interface, documentation, and all underlying software — is the exclusive property of AV Productions and is protected by applicable copyright, trademark, and intellectual property laws. Except for the limited right to use the Service as intended under these Terms, no part of SHILLINGITRACK may be copied, modified, distributed, sold, or reverse-engineered without the prior written consent of AV Productions.",
        "© 2026 AV Productions. All rights reserved.",
      ],
    },
    {
      heading: "8. Availability & Changes to the Service",
      paragraphs: [
        "We aim to keep the Service available and reliable but do not guarantee uninterrupted access. We may modify, suspend, or discontinue features of the Service at any time, with reasonable notice where changes materially affect paid functionality.",
      ],
    },
    {
      heading: "9. Disclaimer of Warranties",
      paragraphs: [
        'The Service is provided "as is" and "as available," without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be error-free, uninterrupted, or that calculations, forecasts, or reports will be free from error — accuracy depends on the data you provide.',
      ],
    },
    {
      heading: "10. Limitation of Liability",
      paragraphs: [
        "To the maximum extent permitted by law, AV Productions shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunity, arising out of or related to your use of the Service — including any financial decisions made based on information displayed within it.",
        "Our total liability for any claim arising from these Terms or your use of the Service shall not exceed the amount you paid us, if any, in the twelve (12) months preceding the claim.",
      ],
    },
    {
      heading: "11. Termination",
      paragraphs: [
        "You may stop using the Service and delete your account at any time. We may suspend or terminate your account if you violate these Terms, engage in fraudulent or illegal activity, or if required by law. Upon termination, your right to access the Service ends, though data export/deletion follows our Privacy Policy.",
      ],
    },
    {
      heading: "12. Governing Law",
      paragraphs: [
        "These Terms are governed by the laws of the Republic of Kenya, without regard to conflict-of-law principles. Any disputes shall be subject to the exclusive jurisdiction of the courts of Kenya, unless otherwise required by applicable law.",
      ],
    },
    {
      heading: "13. Changes to These Terms",
      paragraphs: [
        "We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms. Material changes will be communicated via in-app notice or email in advance.",
      ],
    },
    {
      heading: "14. Contact",
      paragraphs: ["AV Productions", "projectfilesav@gmail.com", "Nairobi, Kenya"],
    },
  ],
  footer:
    "© 2026 AV Productions. All rights reserved. SHILLINGITRACK™ and its associated design system are proprietary to AV Productions.",
};
