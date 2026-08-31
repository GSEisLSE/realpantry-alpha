Real Pantry founder feedback patch v0.3.4

Replace these four files in the GitHub repository, preserving their paths:
- src/screens/ChildSetup.jsx
- src/screens/FoodSeed.jsx
- src/lib/planService.js
- src/lib/repository.js

Changes:
- Weekly lunch budget can be N/A / not sure.
- Max weekday prep can be N/A / varies and now supports 30, 45, 60+ minutes.
- Removes the confusing “Typical lunch planning / week” field from onboarding.
- Adds Jewel-Osco, The Fresh Market, and Mariano's.
- Supports up to 4 children in setup.
- Step 2 uses 3 choices: Yes / Sometimes / No.
- Step 2 shows a 12-food quick start first; the rest are optional.
- “No fixed max prep” no longer silently defaults to 15 minutes in the recommendation engine.
- New households no longer receive fake $40 / 15-minute defaults.
