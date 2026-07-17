# How to use Kheru

Kheru is a **local browser studio** for multi-speaker TTS. You write a script, pick voices, generate audio with Kokoro in the browser, then export.

Nothing is sent to a remote TTS server. First generate downloads the model into your browser (~5–15 MB).

---

## 1. Start the app

### Docker (easiest for a friend)

```bash
docker pull ictx0780/kheru:latest
docker run --rm -p 3000:3000 -e HOST=0.0.0.0 -e PORT=3000 ictx0780/kheru:latest
```

Open **http://127.0.0.1:3000**

### From source

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru
nvm use
pnpm install
pnpm dev
```

Open **http://127.0.0.1:3000**

---

## 2. Create or open a project

1. On the **Projects** home screen, create a new project (or open an existing one).
2. You land in the **Studio**: script on the left/center, inspector on the right, player along the bottom.

Projects and audio stay in **this browser** (IndexedDB / OPFS). Clearing site data removes them.

---

## 3. Write the script

1. Add or edit **paragraphs** — each block is one spoken segment.
2. For each paragraph, set:
   - **Voice** (Kokoro catalog)
   - **Speed** if you want
   - Optional **speaker** label (handy for multi-host scripts)
3. Or use **Import → Import script** to paste a labeled dialogue / outline and turn it into paragraphs.

Sample scripts (Kokoro-friendly, paste via Import):

- [`samples/kokoro-friendly-demo.txt`](../samples/kokoro-friendly-demo.txt) — short product walkthrough (two speakers)
- [`samples/kokoro-tech-explainer.txt`](../samples/kokoro-tech-explainer.txt) — mini system-design show

Use the left **Script** rail to jump between paragraphs.

---

## 4. Generate audio

1. Select a paragraph → **Generate one** (creates a take for that block).
2. Or **Generate all** — synthesizes every paragraph with text, then stitches a **full mix**.
3. First run may show model download progress — wait for it once.

Takes: you can keep multiple generations per paragraph and pick the active one in the inspector.

---

## 5. Listen and tweak

1. **Play** in the toolbar / bottom player runs the full mix (or sequenced clips).
2. **Play selection** in the inspector plays only the selected paragraph.
3. Edit text or voice, then regenerate that paragraph (or Generate all again).
4. Watch the timeline for where you are in the script.

---

## 6. Export

When you have audio:

| Export | What you get |
|--------|----------------|
| **Full mix (WAV)** | One continuous file |
| **Paragraph audio (ZIP)** | One WAV per paragraph |

Open **Export** in the toolbar.

---

## Tips

- Prefer **Chrome / Edge** (best WebGPU support for faster synth).
- Keep the tab open during long **Generate all** runs.
- If audio disappears after a refresh, re-generate — OPFS usually restores clips when available.
- This free build exports **WAV / ZIP** only (no subtitle export).

---

## Feedback

Bugs or ideas: [GitHub Issues](https://github.com/iCTX0780/kheru/issues)  
Image: [ictx0780/kheru on Docker Hub](https://hub.docker.com/r/ictx0780/kheru)
