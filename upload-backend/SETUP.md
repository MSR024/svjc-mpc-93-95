# Upload page setup (one time, about 15 minutes)

The upload page (`/upload`) sends photos and videos into **your** Google Drive through a small
Google Apps Script that runs under your account. Visitors don't sign in. Files use your storage.

## 1. Create the script
1. Open **https://script.google.com** (signed in as the Google account with the 5 TB plan) → **New project**.
2. Click **Untitled project** at the top → rename to `SVJC Reunion Upload`.
3. Click the **gear (Project Settings)** on the left → tick **Show "appsscript.json" manifest file in editor**.
4. Back in the **Editor** (`< >` icon):
   - Open `Code.gs`, delete everything, paste the contents of **Code.gs**.
   - Open `appsscript.json`, delete everything, paste the contents of **appsscript.json**.
   - Press **Ctrl+S / ⌘+S** to save.

## 2. Run setup once (creates the uploads folder)
1. In the toolbar, choose the function **setup** and click **Run**.
2. **Review permissions** → pick your account.
3. Google shows *"Google hasn't verified this app"* — that's normal for your own script.
   Click **Advanced → Go to SVJC Reunion Upload (unsafe) → Allow**.
   The script asks only to *see and manage files it creates* and *connect to Google's servers*.
4. The **Execution log** prints a link to the new folder **SVJC Reunion 2026 – Uploads**.

## 3. Put the uploads folder inside your reunion folder
1. Open Google Drive → **My Drive** → find **SVJC Reunion 2026 – Uploads**.
2. Drag it into your reunion folder (the one you created for the photos).
   Uploads will now appear there, sorted into one sub-folder per uploader name.

## 4. Publish the script as a web app
1. Click **Deploy → New deployment**.
2. Click the gear next to *Select type* → **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**. → **Deploy**.
4. Copy the **Web app URL** (it ends in `/exec`) and send it to Claude. It goes into `upload/config.js`.

## Later changes to the script
Edit the code, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
The URL stays the same.

## Good to know
- If your reunion folder is shared "Anyone with the link", anyone with that link can also see the uploads.
- To close uploads after the event: **Deploy → Manage deployments → Archive**. The page then shows an error; ask Claude to switch it to "Uploads are closed".
