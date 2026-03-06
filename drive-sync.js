/**
 * drive-sync.js
 * Handles Google Drive backup/restore for MilkBook.
 */

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // User would need to provide this for full prod
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;

export function initDriveSync() {
    // Load GAPI and GIS
    gapi.load('client', async () => {
        await gapi.client.init({
            // apiKey: 'YOUR_API_KEY', // Optional for just Drive
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiInited = true;
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined at request time
    });
    gisInited = true;
}

export async function syncToDrive(data) {
    return new Promise((resolve, reject) => {
        if (!gisInited || !gapiInited) {
            reject("Drive API not initialized");
            return;
        }

        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                reject(resp);
                return;
            }

            try {
                // Search for existing backup
                const response = await gapi.client.drive.files.list({
                    q: "name = 'milkbook_backup.json' and trashed = false",
                    fields: 'files(id, name)',
                    spaces: 'drive',
                });

                const files = response.result.files;
                const fileContent = JSON.stringify(data, null, 2);
                const metadata = {
                    name: 'milkbook_backup.json',
                    mimeType: 'application/json',
                };

                if (files.length > 0) {
                    // Update existing
                    const fileId = files[0].id;
                    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': 'Bearer ' + gapi.client.getToken().access_token,
                            'Content-Type': 'application/json',
                        },
                        body: fileContent,
                    });
                } else {
                    // Create new
                    const form = new FormData();
                    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                    form.append('file', new Blob([fileContent], { type: 'application/json' }));

                    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + gapi.client.getToken().access_token,
                        },
                        body: form,
                    });
                }
                resolve(true);
            } catch (err) {
                reject(err);
            }
        };

        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
}
