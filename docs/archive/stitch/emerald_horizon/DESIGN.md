# The Design System: Editorial Fintech v1.0

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Human Ledger."** In emerging markets, fintech often feels either overly clinical or cheaply utilitarian. We break this mold by leaning into a high-end editorial aesthetic that prioritizes clarity, organic movement, and "breathable" luxury.

We move away from the "app-in-a-box" look by utilizing intentional asymmetry, oversized display typography, and a rejection of traditional structural lines. By treating the screen like a premium broadsheet rather than a data table, we build deeper trust through sophisticated simplicity.

---

### 2. Colors & Tonal Architecture
Our palette transitions from the sterile white of traditional banking into a lush, forest-inspired depth.

| Token | Value | Role |
| :--- | :--- | :--- |
| `primary` | `#00694C` | Actionable intent; the brand's heartbeat. |
| `primary-container` | `#008560` | High-emphasis surfaces and prominent CTAs. |
| `surface` | `#F4FAFF` | The "Paper" – our primary canvas. |
| `surface-container-low` | `#E7F6FF` | Subtle sectioning; soft depth. |
| `surface-container-high` | `#D7EBF7` | Elevated prominence for secondary cards. |
| `on-surface` | `#0B1E26` | Deep ink for maximum readability. |
| `accent` | `#5DCAA5` | Prosperity; used exclusively for positive growth/inflow. |

**The "No-Line" Rule:**
Standard 1px borders are strictly prohibited for sectioning. We define boundaries through background shifts—specifically by nesting `surface-container-low` elements against a `surface` background. This creates a "molded" look rather than a "sketched" one.

**The Glass & Gradient Rule:**
To inject "soul" into the UI, use subtle linear gradients on primary CTAs (from `primary` to `primary-container`). For floating modals or navigation bars, utilize Glassmorphism: `surface` color at 80% opacity with a `20px` backdrop-blur.

---

### 3. Typography: The Editorial Voice
We use a dual-typeface system to balance authority with accessibility.

*   **Display & Headlines (Plus Jakarta Sans):** Our "Voice." Bold, wide, and modern. Use `display-lg` (3.5rem) for balance screens to create a sense of monumental stability.
*   **Body & Labels (Manrope):** Our "Function." Highly legible at small scales. Manrope’s geometric yet warm structure ensures that even complex transaction details feel "human."

**Hierarchy as Identity:**
Don't be afraid of scale. A `headline-lg` transaction amount paired with a `label-sm` timestamp creates a high-contrast, editorial rhythm that guides the eye better than uniform sizing ever could.

---

### 4. Elevation & Depth: Tonal Layering
In this design system, shadows are a last resort, not a default. 

*   **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` (#FFFFFF) card placed atop a `surface-container-low` (#E7F6FF) background creates a natural, soft lift.
*   **Ambient Shadows:** If an element must "float" (e.g., a bottom sheet), use a shadow tinted with the `on-surface` color at 4% opacity with a `32px` blur. Avoid grey shadows; they muddy the interface.
*   **The Ghost Border:** For accessibility in input fields, use the `outline-variant` (#BCCAC1) at 20% opacity. It should be felt, not seen.

---

### 5. Components

#### Buttons
*   **Primary:** Height 46px, `radius-sm` (8px). Use the `primary` gradient. Text: SemiBold Manrope.
*   **Secondary:** Ghost style. No background, `primary` text. Use for "Cancel" or "Back" actions.

#### Balance Cards (The Signature Element)
*   **Surface:** Use `surface-dark` (#1A2830).
*   **Typography:** `text-on-dark` (#D4E4EC). 
*   **Visual Interest:** Incorporate the "Organic Node" logo symbol as a large, 10% opacity watermark in the background to add texture.

#### Input Fields
*   **Style:** Minimalist. No containing box; only a 1px "Ghost Border" at the bottom.
*   **Focus State:** The bottom border transitions to 2px `primary`.

#### Chips & Badges
*   **Status:** Use `primary-xlight` (#E1F5EE) for positive states. 
*   **Shape:** `full` (9999px) for an organic, pill-like feel that contrasts with the architectural buttons.

#### Lists & Cards
*   **Rule:** Never use divider lines. Use `spacing-4` (1rem) of vertical white space or a shift to `surface-container-lowest` to separate items.

---

### 6. Do’s and Don'ts

**Do:**
*   **Embrace Asymmetry:** Align headings to the left while keeping action buttons floated or centered to create a dynamic layout.
*   **Use Generous Padding:** When in doubt, increase spacing. We are building a "premium" experience; luxury is defined by unused space.
*   **Color-Coded Meaning:** Use `accent` only for money entering the account. Use `primary` for all navigation and actions.

**Don't:**
*   **Don't use #000000:** Always use `on-surface` (#0B1E26) for text. True black is too harsh for the "Human" tone.
*   **Don't use standard shadows:** If the shadow looks like a "drop shadow," it’s too heavy. It should look like an "outer glow" of darkness.
*   **Don't use 1px dividers:** If you feel the need to separate content, use a background color shift or a `12px` gap. Lines are for ledgers; we are building a "Digital Curator."