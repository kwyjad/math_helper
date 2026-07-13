math_helper — character assets
==============================

Drop this whole `characters/` folder into your repo at:  public/characters/
Final paths become:  public/characters/zeb/lost.png , public/characters/loftus/proud.png , etc.

Transparent PNGs, cropped and aligned so all 4 states of each character share the
same frame (clean cross-fade). ~600px tall.

Teach-back meter mapping  (progress 0-100 + done):
  band                    Zeb            Sir Loftus
  ----------------------  -------------  --------------
  done = true (finale)    zeb/win.png    loftus/beaten.png
  progress  0-33          zeb/lost.png   loftus/proud.png
  progress 34-66          zeb/warming.png loftus/rattled.png
  progress 67-99          zeb/close.png  loftus/grudging.png

Zeb climbs (lost -> thrilled); Loftus deflates (proud -> defeated).
The finale image fires only on a true `done`.
